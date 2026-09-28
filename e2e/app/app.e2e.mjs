// The Android app's JavaScript (Expo web export) against the same locked stack
// as the web e2e: login, sync through the server proxy, join. Run by
// e2e/run-auth-e2e.sh when APP_EXPORT_DIR points at
//   EXPO_PUBLIC_WEB_URL=http://localhost:8081 npx expo export -p web --output-dir <dir>
// The export is served on :8081 and /api/* is passed to the web server on :3100,
// like the real app calling https://www.tripmate.boats.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, devices } from 'playwright'

const ROOT = path.resolve(process.env.APP_EXPORT_DIR)
const WEB = 'http://127.0.0.1:3100'
const B = 'http://localhost:8081'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' }
const apiCalls = []
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    apiCalls.push({ url: req.url, cookie: req.headers.cookie ?? '', client: req.headers['x-tm-client'] ?? '', access: !!req.headers['x-tm-access'] })
    const up = http.request(WEB + req.url, { method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res) })
    up.on('error', e => { res.writeHead(502); res.end(String(e)) })
    return req.pipe(up)
  }
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]))
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, 'index.html')
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
}).listen(8081)

let pass = 0, fail = 0
const check = (l, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  app: ${l}${x ? '  — ' + x : ''}`) }
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

{
  const ctx = await browser.newContext({ ...devices['Pixel 7'] })
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto(`${B}/login`); await page.getByTestId('login-mobile').waitFor({ timeout: 30000 })
  await page.getByTestId('login-mobile').fill('9876543210')
  await page.getByTestId('login-find-trips-btn').click()
  await page.getByTestId('login-trip-TRP-GOA1').waitFor({ timeout: 20000 })
  const order = await page.locator('[data-testid^="login-trip-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  check('server lookup lists both trips, live first', JSON.stringify(order) === JSON.stringify(['login-trip-TRP-GOA1', 'login-trip-TRP-MNL1']), order.join(','))
  await page.getByTestId('login-trip-TRP-GOA1').click()
  await page.getByTestId('login-pin').waitFor()
  await page.getByTestId('login-pin').fill('0000'); await page.getByTestId('login-submit-btn').click()
  await page.getByText(/doesn.t match this trip/).first().waitFor({ timeout: 15000 })
  check('wrong PIN rejected by the server', true)
  await page.getByTestId('login-pin').fill('1234'); await page.getByTestId('login-submit-btn').click()
  await page.waitForURL(/\/dashboard/, { timeout: 20000 })
  check('right PIN opens the trip', page.url().includes('/dashboard'), page.url())
  await page.getByText('Beach shack dinner').first().waitFor({ timeout: 20000 })
  check('trip data arrives through the server proxy with the app token', apiCalls.some(c => c.url.startsWith('/api/sb/rest/v1/') && c.client === 'app' && c.access))
  check('Manali data never reaches the phone', !(await page.locator('body').innerText()).includes('Manali ski passes'))
  check('the app sends no cookies (tokens only)', apiCalls.every(c => !/tm_(at|rt)=/.test(c.cookie)))
  const stored = await page.evaluate(() => JSON.stringify(localStorage))
  check('no token saved in app storage', !/eyJhbGci|refreshToken/.test(stored))
  check('no uncaught errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}
{
  // Join through the app: the server checks the password and adds the member.
  const ctx = await browser.newContext({ ...devices['Pixel 7'] })
  const page = await ctx.newPage()
  await page.goto(`${B}/join-trip`); await page.getByTestId('join-trip-code-input').waitFor({ timeout: 30000 })
  await page.getByTestId('join-trip-code-input').fill('TRP-GOA1')
  await page.getByTestId('join-password-input').fill('wrong')
  await page.getByTestId('find-trip-btn').click()
  await page.getByText(/Wrong trip password/).first().waitFor({ timeout: 15000 })
  check('wrong trip password refused by the server', true)
  await page.getByTestId('join-password-input').fill('pw')
  await page.getByTestId('find-trip-btn').click()
  await page.getByPlaceholder('Your name').waitFor({ timeout: 15000 })
  await page.getByPlaceholder('Your name').fill('Zoya')
  await page.getByPlaceholder('10-digit mobile').fill('9700000077')
  await page.getByRole('button', { name: /continue|next/i }).first().click()
  const pins = page.getByPlaceholder('••••')
  await pins.first().waitFor({ timeout: 10000 })
  await pins.nth(0).fill('4242'); await pins.nth(1).fill('4242')
  await page.getByTestId('join-final-btn').click()
  await page.getByTestId('join-go-dashboard-btn').waitFor({ timeout: 20000 })
  const joined = apiCalls.find(c => c.url === '/api/trips/join')
  check('join goes through the server and succeeds', !!joined && joined.client === 'app')
  await ctx.close()
}

await browser.close(); server.close()
console.log(`\napp: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
