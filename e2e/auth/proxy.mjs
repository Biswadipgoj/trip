import http from 'node:http'
http.createServer((req, res) => {
  if (!req.url.startsWith('/rest/v1')) { res.writeHead(404); return res.end() }
  const up = http.request({ host: '127.0.0.1', port: 3001, path: req.url.slice('/rest/v1'.length) || '/', method: req.method, headers: { ...req.headers, host: '127.0.0.1:3001' } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res) })
  up.on('error', e => { res.writeHead(502); res.end(String(e)) })
  req.pipe(up)
}).listen(54321)
