// Run before the body is painted, so installed users never see an install banner flash.
(() => {
  const storageKey = 'hts-pwa-installed';
  const standaloneMedia = window.matchMedia('(display-mode: standalone)');
  const isStandalone = () => standaloneMedia.matches || navigator.standalone === true;
  const readInstalled = () => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  };
  let installed = isStandalone() || readInstalled();
  let deferredPrompt = null;
  function rememberInstalled(value) {
    installed = value;
    try {
      if (value) localStorage.setItem(storageKey, '1');
      else localStorage.removeItem(storageKey);
    } catch { /* Standalone detection also works with storage disabled. */ }
    syncVisibility();
  }
  function syncVisibility() {
    const hide = installed || isStandalone();
    document.documentElement.dataset.pwaInstalled = String(hide);
    for (const id of ['pwaInstallBtn', 'pwaHeroBanner']) {
      const element = document.getElementById(id);
      if (element) element.hidden = hide;
    }
    if (hide) document.getElementById('pwaGuideModal')?.classList.add('hidden');
  }
  if (isStandalone()) rememberInstalled(true);
  else syncVisibility();

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    rememberInstalled(true);
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (isStandalone()) return;
    // A fresh installability event is evidence that an earlier installation was removed.
    deferredPrompt = event;
    rememberInstalled(false);
  });
  const refresh = () => {
    if (isStandalone()) rememberInstalled(true);
    else { installed = readInstalled(); syncVisibility(); }
  };
  standaloneMedia.addEventListener?.('change', refresh);
  window.addEventListener('pageshow', refresh);
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) refresh();
  });

  function init() {
    syncVisibility();
    const modal = document.getElementById('pwaGuideModal');
    const content = document.getElementById('pwaGuideContent');
    const close = () => modal?.classList.add('hidden');
    document.getElementById('closePwaModal')?.addEventListener('click', close);
    document.getElementById('confirmPwaModal')?.addEventListener('click', close);
    modal?.addEventListener('click', event => { if (event.target === modal) close(); });
    async function install() {
      if (installed || isStandalone()) { syncVisibility(); return; }
      if (deferredPrompt) {
        const prompt = deferredPrompt;
        deferredPrompt = null;
        try { await prompt.prompt(); await prompt.userChoice; }
        catch { /* The browser may invalidate a previously saved prompt. */ }
        // Only appinstalled, not accepting the prompt, confirms a completed installation.
        return;
      }
      if (!content || !modal) return;
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      content.innerHTML = isIos
        ? '<p class="text-sm text-slate-200 leading-relaxed">在 Safari 開啟本網站，點選「分享」→「加入主畫面」→「新增」。安裝後，請從主畫面的圖示開啟房商智庫。</p>'
        : '<p class="text-sm text-slate-200 leading-relaxed">點選瀏覽器網址列的「安裝」圖示，或在「⋮」選單選擇「安裝應用程式／加到主畫面」。</p>';
      modal.classList.remove('hidden');
    }
    for (const id of ['pwaInstallBtn', 'pwaHeroInstallBtn']) {
      document.getElementById(id)?.addEventListener('click', install);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
