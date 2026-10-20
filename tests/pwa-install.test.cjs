const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.existsSync('pwa-install.js')
  ? fs.readFileSync('pwa-install.js', 'utf8')
  : fs.readFileSync('index.html', 'utf8').split('// --- Progressive Web App')[1].split('// 註冊 Service Worker')[0].replace(/^[^\n]*\n/, '');

function browser({ standalone = false, ios = false, saved = false, storageBlocked = false } = {}) {
  const events = {};
  const storage = new Map(saved ? [['hts-pwa-installed', '1']] : []);
  const root = { dataset: {} };
  const nodes = {};
  for (const id of ['pwaInstallBtn', 'pwaHeroInstallBtn', 'pwaHeroBanner', 'pwaGuideModal', 'pwaGuideContent', 'closePwaModal', 'confirmPwaModal']) {
    nodes[id] = { hidden: false, style: {}, innerHTML: '', classList: { add() {}, remove() {} }, addEventListener(type, cb) { this[type] = cb; } };
  }
  const media = { matches: standalone, addEventListener(type, cb) { this.change = cb; } };
  const localStorage = {
    getItem(k) { if (storageBlocked) throw Error('disabled'); return storage.get(k) || null; },
    setItem(k, v) { if (storageBlocked) throw Error('disabled'); storage.set(k, v); },
    removeItem(k) { if (storageBlocked) throw Error('disabled'); storage.delete(k); }
  };
  const document = { documentElement: root, readyState: 'complete', getElementById: id => nodes[id], addEventListener(type, cb) { events['doc:' + type] = cb; } };
  const navigator = { userAgent: ios ? 'iPhone' : 'Chrome', standalone: ios && standalone };
  const window = { navigator, matchMedia: () => media, localStorage, addEventListener(type, cb) { events[type] = cb; } };
  vm.runInNewContext(source, { window, document, navigator, localStorage, console });
  return { nodes, root, storage, media, fire: (type, event = {}) => events[type]?.(event) };
}
function hidden(b) {
  assert.equal(b.root.dataset.pwaInstalled, 'true');
  assert.equal(b.nodes.pwaHeroBanner.hidden, true);
  assert.equal(b.nodes.pwaInstallBtn.hidden, true);
}

test('installed Android PWA hides the entire banner and navigation install action on startup', () => hidden(browser({ standalone: true })));
test('installed iOS PWA hides the installation guide on startup', () => hidden(browser({ standalone: true, ios: true })));
test('appinstalled hides both entry points and persists for the next browser visit', () => {
  const b = browser(); b.fire('appinstalled'); hidden(b);
  assert.equal(b.storage.get('hts-pwa-installed'), '1');
  hidden(browser({ saved: true }));
});
test('a browser installability event after uninstall restores installation controls', () => {
  const b = browser({ saved: true });
  b.fire('beforeinstallprompt', { preventDefault() {} });
  assert.equal(b.nodes.pwaHeroBanner.hidden, false);
  assert.equal(b.root.dataset.pwaInstalled, 'false');
});
test('standalone display-mode changes update installation visibility immediately', () => {
  const b = browser(); b.media.matches = true; b.media.change(); hidden(b);
});
test('standalone detection still works when local storage is unavailable', () => hidden(browser({ standalone: true, storageBlocked: true })));
test('ordinary uninstalled browser keeps install actions available', () => {
  const b = browser(); assert.equal(b.nodes.pwaHeroBanner.hidden, false);
  assert.equal(b.root.dataset.pwaInstalled, 'false');
});
test('cross-tab installation updates hide the browser banner', () => {
  const b = browser(); b.storage.set('hts-pwa-installed', '1');
  b.fire('storage', { key: 'hts-pwa-installed' }); hidden(b);
});
test('accepting or dismissing a browser prompt does not claim the app is installed', async () => {
  for (const outcome of ['accepted', 'dismissed']) {
    const b = browser();
    b.fire('beforeinstallprompt', { preventDefault() {}, prompt: async () => {}, userChoice: Promise.resolve({ outcome }) });
    await b.nodes.pwaInstallBtn.click();
    assert.equal(b.nodes.pwaHeroBanner.hidden, false);
    assert.equal(b.storage.has('hts-pwa-installed'), false);
  }
});
test('a late installability event never reveals controls inside the installed app', () => {
  const b = browser({ standalone: true });
  b.fire('beforeinstallprompt', { preventDefault() {} }); hidden(b);
});
