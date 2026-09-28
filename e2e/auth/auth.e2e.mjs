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
const trace = []
const t0 = Date.now()
ctx.on('request', async rq => {
  if (!/\/api\/(auth|sb)/.test(rq.url())) return
  const h = await rq.allHeaders().catch(() => ({}))
  const rtc = /tm_rt=([^;]+)/.exec(h.cookie ?? '')?.[1]?.slice(0, 6) ?? '-'
  const atc = /tm_at=([^;]+)/.exec(h.cookie ?? '')?.[1]?.slice(-6) ?? '-'
  const res = await rq.response().catch(() => null)
  trace.push(`${Date.now() - t0}ms ${rq.method()} ${rq.url().replace(B, '').slice(0, 60)} rt=${rtc} at=${atc} -> ${res?.status()} ${(res && (await res.allHeaders().catch(() => ({})))['set-cookie'] || '').replace(/\n/g, ' | ').slice(0, 80)}`)
})

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
// Leave the page first: Playwright's filtered clearCookies() briefly removes
// every cookie, and a request from a still-open page in that gap would log out.
await page.goto('about:blank')
await ctx.clearCookies({ name: 'tm_at' })
await page.goto(DASH)
check('expired/missing access token is renewed from the refresh cookie', page.url() === DASH, page.url())
const rt2 = (await ctx.cookies()).find(c => c.name === 'tm_rt')
check('refresh token rotated on renewal', rt2 && rt2.value !== rt.value)
if (process.env.E2E_TRACE && (page.url() !== DASH)) console.log(trace.join('\n'))

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

// ── Data lock: the database only answers with a server-signed trip pass ───────
const SB = 'http://localhost:54321'
const MNL = '22222222-2222-4222-8222-222222222222'
const anonHeaders = { apikey: process.env.ANON, Authorization: `Bearer ${process.env.ANON}` }
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  const direct = async (path, init = {}) => {
    const r = await page.request.fetch(SB + path, { ...init, headers: { ...anonHeaders, ...(init.headers ?? {}) } })
    return { status: r.status(), body: await r.text() }
  }
  const trips = await direct('/rest/v1/trips?select=id,trip_code,password')
  const members = await direct('/rest/v1/members?select=name,mobile,upi_id')
  const expenses = await direct('/rest/v1/expenses?select=title,amount')
  check('public key straight to the database: no trips, members or expenses', trips.body === '[]' && members.body === '[]' && expenses.body === '[]',
    `${trips.body} ${members.body} ${expenses.body}`)
  const forged = await direct('/rest/v1/trips?select=id', { headers: { 'x-tm-auth': `v1.9999999999.${TRIP}.${'0'.repeat(64)}` } })
  check('a forged trip pass sees nothing', forged.body === '[]', forged.body)
  const rpc = await direct('/rest/v1/rpc/tm_find_trips_by_mobile', { method: 'POST', data: { p_mobile: '9876543210' } })
  const pin = await direct('/rest/v1/rpc/tm_verify_member_pin', { method: 'POST', data: { p_member_id: 'aaaaaaaa-0000-4000-8000-000000000001', p_pin: '1234' } })
  check('public key cannot call the mobile lookup or PIN check', rpc.status >= 400 && pin.status >= 400, `${rpc.status}/${pin.status}`)
  const create = await direct('/rest/v1/trips', { method: 'POST', data: { trip_code: 'TRP-EVIL', name: 'x', password: 'x' } })
  check('public key cannot create trips', create.status >= 400, String(create.status))
  const sessions = await direct('/rest/v1/auth_sessions?select=*')
  check('public key cannot read login sessions', sessions.status >= 400 || sessions.body === '[]', `${sessions.status}`)
  const out = await page.request.get(`${B}/api/sb/rest/v1/trips?select=id`)
  check('app proxy without a session → 401', out.status() === 401)
  await ctx.close()
}
{
  // Asha logs in to Goa only.
  const ctx = await newCtx(); const page = await ctx.newPage()
  await post(page, '/api/auth/login', { memberId: 'aaaaaaaa-0000-4000-8000-000000000001', pin: '1234' })
  const get = async (path, headers = {}) => {
    const r = await page.request.get(`${B}/api/sb${path}`, { headers })
    return { status: r.status(), json: await r.json().catch(() => null) }
  }
  const t = await get('/rest/v1/trips?select=trip_code')
  check('through the app: a Goa session sees exactly Goa', JSON.stringify(t.json) === '[{"trip_code":"TRP-GOA1"}]', JSON.stringify(t.json))
  const spoof = await get(`/rest/v1/expenses?select=title&trip_id=eq.${MNL}`, { 'x-tm-auth': 'anything', 'x-tm-client': 'web' })
  check('asking for Manali (and sending a fake pass) returns nothing', JSON.stringify(spoof.json) === '[]', JSON.stringify(spoof.json))
  const priv = await get('/rest/v1/auth_sessions?select=*')
  const rpcPin = await page.request.post(`${B}/api/sb/rest/v1/rpc/tm_verify_member_pin`, { headers: { Origin: B }, data: { p_member_id: 'aaaaaaaa-0000-4000-8000-000000000003', p_pin: '5678' } })
  check('the proxy exposes only trip tables (not sessions or the PIN check)', priv.status === 404 && rpcPin.status() === 404)

  // What the app does, from the page itself (same-origin fetch, cookie sent).
  await page.goto(DASH)
  await page.getByText('Beach shack dinner').first().waitFor({ timeout: 20000 })
  check('dashboard shows Goa expenses loaded through the proxy', true)
  check('dashboard never shows Manali data', !(await page.locator('body').innerText()).includes('Manali ski passes'))
  const res = await page.evaluate(async ({ trip, mnl }) => {
    const ins = (tripId, id) => fetch('/api/sb/rest/v1/expenses', {
      method: 'POST', headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ id, trip_id: tripId, title: 'Scooters', amount: 600, paid_by: 'aaaaaaaa-0000-4000-8000-000000000001' }),
    }).then(r => r.status)
    return {
      own: await ins(trip, 'eeeeeeee-0000-4000-8000-0000000000a1'),
      other: await ins(mnl, 'eeeeeeee-0000-4000-8000-0000000000a2'),
      pw: await fetch(`/api/sb/rest/v1/trips?id=eq.${trip}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'owned' }) }).then(r => r.status),
    }
  }, { trip: TRIP, mnl: MNL })
  check('adding an expense to your own trip works', res.own === 201, String(res.own))
  check('adding an expense to another trip is refused by the database', res.other >= 400, String(res.other))
  check('the trip password cannot be changed through the app', res.pw >= 400, String(res.pw))
  const csrf = await page.request.post(`${B}/api/sb/rest/v1/expenses`, { headers: { Origin: 'https://evil.example' }, data: {} })
  check('cross-site write through the proxy is blocked (CSRF)', csrf.status() === 403)

  // Photos: the app server decides, Storage only ever sees the service key.
  const img = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const own = `${TRIP}/bills/eeeeeeee-0000-4000-8000-0000000000b1.jpg`
  const theirs = `${MNL}/bills/eeeeeeee-0000-4000-8000-0000000000b2.jpg`
  const up = p => page.request.post(`${B}/api/sb/storage/v1/object/trip-media/${p}`, { headers: { Origin: B, 'content-type': 'image/jpeg' }, data: img })
  const upOwn = await up(own), upOther = await up(theirs)
  const viewOther = await page.request.get(`${B}/api/sb/storage/v1/object/public/trip-media/${theirs}`, { maxRedirects: 0 })
  const listOther = await page.request.post(`${B}/api/sb/storage/v1/object/list/trip-media`, { headers: { Origin: B }, data: { prefix: `${MNL}/bills` } })
  const log = await (await page.request.get(`${SB}/__storage_log`)).json()
  check('photo upload to your own trip is passed on to Storage', upOwn.status() === 200 && log.some(l => l.path.endsWith(own) && l.auth === `Bearer ${process.env.SERVICE}`))
  check('photo upload, view or listing for another trip is refused', upOther.status() === 403 && viewOther.status() === 404 && listOther.status() === 404
    && !log.some(l => l.path.includes(MNL)), `${upOther.status()}/${viewOther.status()}/${listOther.status()}`)
  const notImg = await page.request.post(`${B}/api/sb/storage/v1/object/trip-media/${TRIP}/bills/eeeeeeee-0000-4000-8000-0000000000b3.jpg`, { headers: { Origin: B, 'content-type': 'text/html' }, data: '<script>' })
  check('only images can be uploaded', notImg.status() === 415)
  await ctx.close()
}
{
  // Trip password is checked on the server.
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  const wrong = await post(page, '/api/trips/find', { tripCode: 'TRP-GOA1', password: 'nope' })
  const right = await post(page, '/api/trips/find', { tripCode: 'trp-goa1', password: 'pw' })
  const rb = await right.json()
  check('trip find: wrong password 401, right password gives the trip without its password',
    wrong.status() === 401 && right.status() === 200 && rb.trip?.id === TRIP && !('password' in rb.trip) && rb.memberCount >= 2)
  await ctx.close()
}
{
  // The Android app: tokens in the body, never cookies.
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  const app = { 'x-tm-client': 'app' }
  const login = await page.request.post(`${B}/api/auth/login`, { headers: app, data: { memberId: 'aaaaaaaa-0000-4000-8000-000000000004', pin: '2222' } })
  const lb = await login.json()
  check('app login returns tokens and sets no cookies', login.status() === 200 && /^eyJ/.test(lb.accessToken) && lb.refreshToken?.length > 20
    && !(await ctx.cookies()).length)
  const t = await page.request.get(`${B}/api/sb/rest/v1/trips?select=trip_code`, { headers: { ...app, 'x-tm-access': lb.accessToken } })
  check('app token reaches its own trip only', JSON.stringify(await t.json()) === '[{"trip_code":"TRP-MNL1"}]')
  const bad = await page.request.get(`${B}/api/sb/rest/v1/trips?select=trip_code`, { headers: { ...app, 'x-tm-access': lb.accessToken.slice(0, -3) + 'abc' } })
  check('a tampered app token → 401', bad.status() === 401)
  await page.waitForTimeout(3500) // past the rotation grace window
  const ref = await page.request.post(`${B}/api/auth/refresh`, { headers: app, data: { refreshToken: lb.refreshToken } })
  const rb = await ref.json()
  check('app refresh returns a new access and refresh token', ref.status() === 200 && /^eyJ/.test(rb.accessToken) && rb.refreshToken && rb.refreshToken !== lb.refreshToken)
  const out = await page.request.post(`${B}/api/auth/logout`, { headers: app, data: { refreshToken: rb.refreshToken } })
  const again = await page.request.post(`${B}/api/auth/refresh`, { headers: app, data: { refreshToken: rb.refreshToken } })
  check('app logout ends the session on the server', out.status() === 200 && again.status() === 401)
  await ctx.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
