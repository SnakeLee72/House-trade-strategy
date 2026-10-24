// Stage only public assets; keep repository metadata and test tools out of deployments.
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.wrangler', 'ui-public');
const files = [
  'index.html', '吳淡如_房商必修課.html', '「談判大叔」陳侯勳｜買房投資與談判理論全集.html',
  'second_house.html', 'manifest.json', 'sw.js', 'pwa-install.js', 'home-mobile.css', 'chen-reading.css',
  'registration-core.js', 'registration-ui.js', 'site-ui.css', 'site-ui.js',
  'icons/lucide-license.txt', 'icons/icon.svg', 'icons/icon-192x192.png', 'icons/icon-512x512.png', 'icons/apple-touch-icon.png'
];
(async () => {
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true });
    await fs.copyFile(path.join(root, file), path.join(target, file));
  }
  console.log(`Staged ${files.length} public assets in ${target}`);
})();
