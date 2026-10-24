const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const site = 'https://house-trade-strategy.snakelee72.workers.dev';
const files = ['icons/lucide-license.txt','吳淡如_房商必修課.html','second_house.html','site-ui.css','site-ui.js','index.html', '「談判大叔」陳侯勳｜買房投資與談判理論全集.html', 'home-mobile.css', 'chen-reading.css', 'pwa-install.js', 'sw.js', 'registration-core.js', 'registration-ui.js'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  const results = await Promise.all(files.map(async file => {
    const response = await fetch(`${site}/${file.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' });
    const bytes = Buffer.from(await response.arrayBuffer());
    const expected = hash(await fs.readFile(file));
    return { file, status: response.status, sha256: hash(bytes), matches: hash(bytes) === expected };
  }));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(r => r.status !== 200 || !r.matches)) process.exitCode = 1;
})();
