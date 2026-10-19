/**
 * Cloudflare Pages Advanced Mode / Cloudflare Worker: _worker.js
 * 整合靜態網站托管與 /api/parse-house 後端即時房屋解析服務
 */

import { onRequest } from './functions/api/parse-house.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 處理 /api/parse-house API 請求
    if (url.pathname === '/api/parse-house') {
      return onRequest({ request, env, ctx });
    }

    // 預設靜態檔案存取（Pages Assets）
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
