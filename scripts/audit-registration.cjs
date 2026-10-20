// Read-only diagnostics for the two URLs supplied by the user.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const base = 'https://house-trade-strategy.snakelee72.workers.dev';
const listing = 'https://sale.591.com.tw/home/house/detail/2/21046507.html?itm_source=sale&itm_medium=list&itm_campaign=filter_results';
const market = 'https://market.591.com.tw/10007/price';
const root = path.resolve(__dirname, '..');
const rawDir = path.join(root, '.wrangler', 'registration-audit');
const page = '「談判大叔」陳侯勳｜買房投資與談判理論全集.html';
(async () => {
  await fs.mkdir(rawDir, { recursive: true });
  const jobs = [
    ['listing', listing], ['market', market],
    ['api-listing', base + '/api/parse-house?' + new URLSearchParams({ url: listing })],
    ['api-market', base + '/api/parse-house?' + new URLSearchParams({ url: market })],
    ['frontend', base + '/' + encodeURIComponent(page)]
  ];
  const results = await Promise.all(jobs.map(async ([name, url]) => {
    const started = Date.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), cache: 'no-store' });
      const body = await response.text();
      await fs.writeFile(path.join(rawDir, name + (name.startsWith('api') ? '.json' : '.html')), body);
      const result = { name, requestedUrl: url, finalUrl: response.url, status: response.status, ms: Date.now() - started, length: body.length };
      if (name.startsWith('api')) { try { result.result = JSON.parse(body); } catch { result.preview = body.slice(0, 160); } }
      else {
        result.title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
        result.sha256 = crypto.createHash('sha256').update(body).digest('hex');
        if (name === 'frontend') result.matchesLocal = body === await fs.readFile(path.join(root, page), 'utf8');
        result.marketLinks = [...new Set([...body.matchAll(/(?:https?:)?\/\/market\.591\.com\.tw\/\d+[^\s"'<>\\]*/g)].map(m => m[0]))].slice(0, 20);
        result.totalRecords = body.match(/共有\s*(\d+)\s*筆/ )?.[1] || null;
      }
      return result;
    } catch (error) { return { name, requestedUrl: url, error: error.message, ms: Date.now() - started }; }
  }));
  const summary = { fetchedAt: new Date().toISOString(), results };
  await fs.writeFile(path.join(rawDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
