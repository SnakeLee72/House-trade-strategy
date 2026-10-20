const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const upstreamFetch=globalThis.fetch;
globalThis.fetch=async (...args)=>{try{return await upstreamFetch(...args);}catch(error){console.error('Upstream error',new URL(String(args[0])).hostname,error.name,error.cause?.code,error.cause?.message);throw error;}};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name === '/api/parse-house') {
      const { onRequest } = await import('../functions/api/registration-endpoint.mjs');
      const result = await onRequest({ request: new Request(new URL(req.url, 'http://127.0.0.1:18743'), { method: req.method }) });
      res.writeHead(result.status, Object.fromEntries(result.headers)).end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    if (name === '/') name = '/index.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) || name.includes('/.') || !mime[path.extname(file)]) {
      res.writeHead(404).end(); return;
    }
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' }).end(data);
  } catch { res.writeHead(404).end(); }
}).listen(18743, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:18743'));
