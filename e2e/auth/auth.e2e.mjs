// End-to-end checks for the server-side login (httpOnly cookie sessions).
// Runs against a real PostgreSQL + PostgREST with every migration applied.
// Start it with: npm run test:e2e:auth  (see e2e/run-auth-e2e.sh)
import { chromium, devices } from 'playwright'

const B = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const TRIP = '11111111-1111-4111-8111-111111111111'
const DASH = `${B}/dashboard/${TRIP}`
let pass = 0, fail = 0
const check = (label, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`) }
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const newCtx = () => browser.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, serviceWorkers: 'block' })
const post = (page, path, data) => page.request.post(B + path, { headers: { Origin: B }, data })

// ── Login, cookies, token handling, CSRF ──────────────────────────────────────
{
const ctx = await newCtx()
const page = await ctx.newPage()

// 1. Protected page without a session → login, with a way back.
await page.goto(DASH)
check('logged-out visit to a trip page lands on /login?next=…', page.url().startsWith(`${B}/login?next=`), page.url())

// 2. Log in through the UI.
await page.fill('#login-mobile', '9876543210')
await page.click('#login-find-trips-btn')
await page.getByText('Goa Beach Week').waitFor()
const cards = await page.locator('ul[aria-label="Your trips"] li').allInnerTexts()
check('server lookup lists both trips, live first', cards.length === 2 && cards[0].includes('Goa') && cards[1].includes('Manali'))
await page.getByText('Goa Beach Week').click()
await page.fill('#login-pin', '0000'); await page.click('#login-submit-btn')
await page.locator('p[role=alert]').waitFor()
check('wrong PIN rejected by the server', /doesn.t match/.test(await page.locator('p[role=alert]').innerText()))
await page.fill('#login-pin', '1234'); await page.click('#login-submit-btn')
await page.waitForURL(`**/dashboard/${TRIP}`, { timeout: 20000 })
check('right PIN opens the dashboard (back to ?next target)', page.url() === DASH)

// 3. Cookie properties.
const cookies = await ctx.cookies()
const at = cookies.find(c => c.name === 'tm_at'), rt = cookies.find(c => c.name === 'tm_rt')
check('access cookie is httpOnly + SameSite=Lax + path=/', !!at && at.httpOnly && at.sameSite === 'Lax' && at.path === '/')
check('refresh cookie is httpOnly, scoped to /api/auth, ~90 days', !!rt && rt.httpOnly && rt.path === '/api/auth' && rt.expires - Date.now() / 1000 > 89 * 86400)
check('page JavaScript cannot read either cookie', (await page.evaluate(() => document.cookie)) === '')
const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
check('no JWT or refresh token in localStorage/sessionStorage', !storage.includes(at.value.slice(0, 20)) && !storage.includes(rt.value) && !/eyJhbGci/.test(storage))
check('no PIN stored in the browser', !/"pin":"\d{4}"/.test(storage))

// 4. Server checks per trip.
const other = await page.goto(`${B}/dashboard/22222222-2222-4222-8222-222222222222`)
check('logged into trip A, trip B page is refused → /login', page.url().startsWith(`${B}/login?next=`))
await page.goto(DASH)

// 5. Tampered and expired access tokens.
await ctx.addCookies([{ ...at, value: at.value.slice(0, -4) + 'AAAA' }])
await page.goto(DASH)
check('tampered access token → silent refresh → still in', page.url() === DASH)
await ctx.clearCookies({ name: 'tm_at' })
await page.goto(DASH)
check('expired/missing access token is renewed from the refresh cookie', page.url() === DASH)
const rt2 = (await ctx.cookies()).find(c => c.name === 'tm_rt')
check('refresh token rotated on renewal', rt2 && rt2.value !== rt.value)

// 6. Stolen refresh token replayed after rotation (and after the grace window,
//    AUTH_ROTATION_GRACE_MS=3000 in the runner) → whole session killed.
await page.waitForTimeout(3500)
const thief = await browser.newContext({ serviceWorkers: 'block' })
await thief.addCookies([{ name: 'tm_rt', value: rt.value, domain: 'localhost', path: '/api/auth', httpOnly: true }])
const tp = await thief.newPage()
const r = await tp.request.get(`${B}/api/auth/session`)
check('old (rotated) refresh token is refused', r.status() === 401)
await thief.close()

// 7. API protections.
const cross = await page.request.post(`${B}/api/auth/login`, { headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, data: { memberId: 'aaaaaaaa-0000-4000-8000-000000000001', pin: '1234' } })
check('cross-site POST to /api/auth/login is blocked (CSRF)', cross.status() === 403)
const noOrigin = await page.request.post(`${B}/api/auth/lookup`, { data: { mobile: '9876543210' } })
check('POST without Origin is blocked', noOrigin.status() === 403)

}

// ── Create, logout, lockout, rate limits ──────────────────────────────────────
// A. Create a trip → the new trip gets a server session → dashboard opens.
{
  const ctx = await newCtx(); const page = await ctx.newPage()
  await page.goto(`${B}/create-trip`)
  await page.fill('#trip-name-input', 'Kerala Backwaters')
  await page.fill('#creator-name-input', 'Meera')
  await page.fill('#mobile-input', '9811122233')
  await page.fill('#trip-password-input', 'boat123')
  await page.click('#details-next-btn')
  await page.fill('#pin-input', '2468'); await page.fill('#pin-confirm-input', '2468')
  await page.click('#create-trip-final-btn')
  await page.getByText('Go to Dashboard').waitFor({ timeout: 20000 })
  await page.click('#go-to-dashboard-btn')
  await page.waitForURL('**/dashboard/**', { timeout: 20000 })
  check('new trip: creator lands on the dashboard with a server session', /\/dashboard\/[0-9a-f-]{36}$/.test(page.url()))
  check('new trip: session cookie issued', (await ctx.cookies()).some(c => c.name === 'tm_at' && c.httpOnly))
  const lookup = await post(page, '/api/auth/lookup', { mobile: '9811122233' })
  check('new trip: creator can later find it by mobile', (await lookup.json()).trips?.some(t => t.name === 'Kerala Backwaters'))
  await ctx.close()
}

// B. Logout ends the server session.
{
  const ctx = await newCtx(); const page = await ctx.newPage()
  const login = await post(page, '/api/auth/login', { memberId: 'aaaaaaaa-0000-4000-8000-000000000002', pin: '1111' })
  check('API login works (Ravi)', login.status() === 200)
  const rtBefore = (await ctx.cookies()).find(c => c.name === 'tm_rt').value
  await page.goto(`${B}/dashboard/${TRIP}`)
  check('dashboard reachable while logged in', page.url().endsWith(`/dashboard/${TRIP}`))
  await page.locator('#logout-btn-mobile').click()
  await page.waitForURL('**/login**')
  check('logout clears both cookies', !(await ctx.cookies()).some(c => c.name === 'tm_at' || c.name === 'tm_rt'))
  await page.goto(`${B}/dashboard/${TRIP}`)
  check('after logout the dashboard is refused', page.url().includes('/login'))
  const thief = await browser.newContext()
  await thief.addCookies([{ name: 'tm_rt', value: rtBefore, domain: 'localhost', path: '/api/auth', httpOnly: true }])
  const r = await (await thief.newPage()).request.get(`${B}/api/auth/session`)
  check('a copy of the logged-out refresh token is dead on the server', r.status() === 401)
  await thief.close(); await ctx.close()
}

// C. PIN lockout and rate limits.
{
  const ctx = await newCtx(); const page = await ctx.newPage()
  const codes = []
  for (let i = 0; i < 5; i++) codes.push((await post(page, '/api/auth/login', { memberId: 'aaaaaaaa-0000-4000-8000-000000000003', pin: '0000' })).status())
  const locked = await post(page, '/api/auth/login', { memberId: 'aaaaaaaa-0000-4000-8000-000000000003', pin: '5678' })
  check('5 wrong PINs → right PIN refused with 423 Locked', codes.every(c => c === 401) && locked.status() === 423, `${codes} → ${locked.status()}`)
  const burst = []
  for (let i = 0; i < 12; i++) burst.push((await post(page, '/api/auth/lookup', { mobile: '9123456780' })).status())
  check('lookup for one number is rate-limited after 10/10 min', burst.slice(0, 10).every(c => c === 200) && burst[10] === 429, burst.join(','))
  const bad = await post(page, '/api/auth/login', { memberId: "x' or 1=1 --", pin: '1234' })
  check('malformed member id rejected before touching the DB', bad.status() === 400)
  await ctx.close()
}


// ── Join ──────────────────────────────────────────────────────────────────────
async function join(mobile, pin, name) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' })
  const page = await ctx.newPage()
  await page.goto(`${B}/join-trip`)
  await page.fill('#join-trip-code-input', 'TRP-GOA1')
  await page.fill('#join-password-input', 'pw')
  await page.click('#find-trip-btn')
  await page.locator('#join-name-input').waitFor({ timeout: 15000 })
  await page.fill('#join-name-input', name)
  await page.fill('#join-mobile-input', mobile)
  await page.click('#join-next-btn')
  await page.fill('#join-pin-input', pin)
  await page.fill('#join-pin-confirm-input', pin)
  await page.click('#join-final-btn')
  await page.waitForTimeout(4000)
  return { ctx, page }
}
{
  const { ctx, page } = await join('9700000001', '1357', 'Dev')
  const txt = await page.locator('main').innerText()
  check('new member joins and gets a session cookie', /You're in|Welcome back/.test(txt) && (await ctx.cookies()).some(c => c.name === 'tm_at'))
  await ctx.close()
}
{
  const { ctx, page } = await join('9876543210', '9999', 'Impostor')
  const txt = await page.locator('main').innerText()
  check('rejoining with an existing number and the wrong PIN is refused', /already joined/.test(txt) && !(await ctx.cookies()).some(c => c.name === 'tm_at'))
  await ctx.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
