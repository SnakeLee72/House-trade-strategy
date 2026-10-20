/**
 * Service Worker: sw.js
 * HOUSE TRADE STRATEGY 房產交易策略與買房實戰雙師智庫
 * 支援 PWA 離線快取、即時網路優先策略與背景更新
 */

const CACHE_NAME = 'hts-cache-v20261020_07';

const PRECACHE_URLS = [
  './',
  './index.html',
  './pwa-install.js',
  './home-mobile.css',
  './chen-reading.css',
  './registration-core.js',
  './registration-ui.js',
  './吳淡如_房商必修課.html',
  './「談判大叔」陳侯勳｜買房投資與談判理論全集.html',
  './second_house.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon.svg',
  './icons/apple-touch-icon.png'
];

// 安裝 Service Worker 並預先載入核心資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] 正在預先快取核心資產...');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// 啟用新的 Service Worker，並清除舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] 刪除舊快取:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截網路請求：動態 API 永遠走網路，靜態文件採「網路優先，離線備援」策略
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. 後端即時解析 API（/api/parse-house）不經 SW 快取，確保永遠抓取最新即時資料
  if (url.pathname.includes('/api/')) {
    return;
  }

  // 2. 僅處理 GET 請求
  if (event.request.method !== 'GET') {
    return;
  }

  // 3. 網路優先 (Network First) 策略：優先連網獲取最新網頁，連網失敗則從快取讀取
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 離線時從快取提供
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 若為頁面導航且快取無完全比對，退回至 index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
