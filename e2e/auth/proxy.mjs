// Supabase-shaped gateway for the e2e run on :54321.
//   /rest/v1/*     → PostgREST on :3001 (every header passes through, as on Supabase)
//   /storage/v1/*  → a recording fake: answers like Storage and remembers which
//                    key and path each request used, so the test can see what
//                    the app server let through.
//   /__storage_log → that record
import http from 'node:http'

const log = []
http.createServer((req, res) => {
  if (req.url === '/__storage_log') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(log))
  }
  if (req.url.startsWith('/storage/v1/')) {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const path = req.url.slice('/storage/v1'.length)
      log.push({ method: req.method, path, auth: req.headers.authorization ?? '', bytes: Buffer.concat(chunks).length })
      res.writeHead(200, { 'content-type': 'application/json' })
      if (path.startsWith('/object/sign/')) return res.end(JSON.stringify({ signedURL: path.replace('/object/sign/', '/object/sign/') + '?token=t' }))
      if (path.startsWith('/object/list/')) return res.end('[]')
      res.end(JSON.stringify({ Key: path }))
    })
    return
  }
  if (!req.url.startsWith('/rest/v1')) { res.writeHead(404); return res.end() }
  const up = http.request({ host: '127.0.0.1', port: 3001, path: req.url.slice('/rest/v1'.length) || '/', method: req.method, headers: { ...req.headers, host: '127.0.0.1:3001' } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res) })
  up.on('error', e => { res.writeHead(502); res.end(String(e)) })
  req.pipe(up)
}).listen(54321)
