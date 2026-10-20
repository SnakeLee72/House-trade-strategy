// Feasibility probe only: one sale URL -> verified community ID -> public price page.
// This is not a production parser and does not implement full-record pagination.
const fs = require('node:fs/promises');
const listingUrl = process.argv[2];
if (!listingUrl || new URL(listingUrl).hostname !== 'sale.591.com.tw') throw Error('Provide a 591 sale listing URL');
const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
async function read(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}
(async () => {
  const listingHtml = await read(listingUrl);
  const id = listingHtml.match(/\bcommunity-id=["'](\d+)["']/)?.[1] || listingHtml.match(/id=["']hid_communityId["'][^>]*value=["'](\d+)["']/)?.[1];
  const name = listingHtml.match(/\bcommunity-name=["']([^"']+)["']/)?.[1];
  if (!id) throw Error('No verified community ID; do not select a recommendation link');
  const priceUrl = `https://market.591.com.tw/${id}/price`;
  const html = await read(priceUrl);
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  if (!name || !title.includes(name)) throw Error('Community name mismatch');
  const blocks = [...html.matchAll(/<section\b[^>]*class="realprice-list-row\b[^>]*>[\s\S]*?<\/section>/g)].map(m => m[0]);
  const rows = blocks.map(row => {
    const house = row.match(/<div class="house-total"[\s\S]*?(?=<div class="park")/)?.[0] || '';
    const park = row.match(/<div class="park"[\s\S]*?(?=<div class="none total")/)?.[0] || '';
    const text = plain(row);
    return {
      month: plain(row.match(/class="row-ctn year-month"[^>]*>([\s\S]*?)<\/div>/)?.[1] || ''),
      floor: plain(row.match(/class="row-ctn floor"[^>]*>([\s\S]*?)<\/div>/)?.[1] || ''),
      unitPrice: plain(row.match(/class="price-detail"[^>]*>([\s\S]*?)<\/div>/)?.[1] || ''),
      house: plain(house), parking: plain(park), parkingEstimated: /class="estimate"/.test(park),
      special: text.includes('特殊交易'), address: plain(row.match(/<address[^>]*>([\s\S]*?)<\/address>/)?.[1] || '')
    };
  });
  const result = {
    fetchedAt: new Date().toISOString(), inputCount: 1, listingUrl,
    community: { id, name, evidence: 'listing community-id / hid_communityId; name checked against price page title' },
    priceUrl, sourceReportedCount: Number(plain(html).match(/共有\s*(\d+)\s*筆實價登錄/)?.[1]) || null,
    fetchedRowCount: rows.length, complete: false,
    latestRows: rows.slice(0, 5), rows
  };
  await fs.writeFile('.wrangler/registration-audit/single-listing-probe.json', JSON.stringify(result, null, 2));
  const { rows: omitted, ...summary } = result;
  console.log(JSON.stringify(summary, null, 2));
})();
