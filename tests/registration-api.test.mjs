import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseListing, parseMarketHtml, normalizeTransaction, loadRegistration, validateTarget } from '../functions/api/registration-adapters.mjs';
const saleHtml = `<title>東煒泰和</title><script type="application/ld+json">${JSON.stringify({'@graph':[{'@type':['Product','Apartment'],name:'東煒泰和雙車位',offers:{price:59960000},floorSize:{value:80.91,unitText:'坪'},address:{addressRegion:'新北市',addressLocality:'三重區',streetAddress:'三德街'},numberOfRooms:4}]})}</script><a href="https://market.591.com.tw/999">推薦社區</a><n-house-entrust-entry community-id="10007" community-name="東煒泰和"></n-house-entrust-entry><div class="detail-house-key">車位</div><div class="detail-house-value">12.217坪，平面式，已含售金內</div>`;
const item = (id, extra={}) => ({id,trans_date:'2025-11-09',month:'114-11',address:'三德街62號 | 2樓',shift_floor_val:'2',building_area:{area:'52.7',unit:'坪'},building_total_price:{price:'3,428',unit:'萬'},real_park_area:{area:'6.1',unit:'坪',estimate:0},real_park_total_price_v:{price:'200',unit:'萬',estimate:1},total_price_v:'3,628',has_park:'1',community:{id:10007,name:'東煒泰和'},...extra});
const html='<title>新北東煒泰和實價登錄查詢</title><div>共有<strong>4</strong>筆實價登錄</div>';
test('property matches its explicit community ID, never recommendation links, and reads actual parking area',()=>{
 const p=parseListing(saleHtml,'https://sale.591.com.tw/home/house/detail/2/21046507.html');
 assert.equal(p.communityId,'10007');assert.equal(p.community,'東煒泰和');assert.equal(p.parkingAreaPing,12.217);assert.equal(p.parkingPriceWan,null);assert.equal(p.askingPrice,5996);assert.equal(p.size,80.91);
});
test('empty or blocked pages cannot become synthetic properties',()=>{
 assert.throws(()=>parseListing('<title>Just a moment...</title>','https://sale.591.com.tw/123'),/blocked/);
 assert.throws(()=>parseListing('<title>不存在</title>','https://sale.591.com.tw/123'),/parse/);
});
test('split digit spans in parking area are reconstructed without dropping decimals',()=>{
 const h=saleHtml.replace('12.217坪','<span>12.</span> <span>21</span><span>7</span>坪');
 assert.equal(parseListing(h,'https://sale.591.com.tw/123').parkingAreaPing,12.217);
});
test('unknown source parking price is null, never zero',()=>{
 assert.equal(normalizeTransaction(item(7,{real_park_total_price_v:{price:'待定',unit:'萬'}}),10007).parkingPriceWan,null);
});
test('untrusted target and redirected private addresses are rejected',()=>{
 for(const u of ['http://127.0.0.1','https://evil591.com.tw/a','https://sale.591.com.tw.evil.test','https://u:p@sale.591.com.tw/a','https://192.168.1.2'])assert.throws(()=>validateTarget(u));
 assert.equal(validateTarget('https://sale.591.com.tw/123').hostname,'sale.591.com.tw');
});
test('normalize explicit source units and preserve estimated parking and original row identifiers',()=>{
 const r=normalizeTransaction(item(7),10007);
 assert.equal(r.id,'7');assert.equal(r.date,'2025-11');assert.equal(r.housePriceWan,3428);assert.equal(r.houseAreaPing,52.7);assert.equal(r.parkingEstimated,true);assert.equal(r.totalPriceWan,3628);
 assert.throws(()=>normalizeTransaction(item(7,{community:{id:999}}),10007),/community/);
});
test('load all public list pages and verify the reported count',async()=>{
 const urls=[];
 const fetcher=async (u,options)=>{assert.equal(options.redirect,'manual','Cloudflare requires explicit manual redirect handling');urls.push(String(u));if(String(u).includes('/10007/price'))return new Response(html);const page=Number(new URL(u).searchParams.get('page'));return Response.json({status:1,data:{total:4,page,items:page===1?[item(1),item(2)]:[item(3),item(4)]}});};
 const reg=await loadRegistration('10007','東煒泰和',fetcher,{pageSize:2});
 assert.equal(reg.rows.length,4);assert.equal(reg.status,'complete');assert.equal(reg.reportedCount,4);assert.ok(urls.some(u=>u.includes('page=2')));
});
test('a failed or repeated page remains partial, not complete and not silently replaced',async()=>{
 const fetcher=async u=>String(u).includes('/10007/price')?new Response(html):Response.json({status:1,data:{total:4,page:1,items:[item(1),item(2)]}});
 const reg=await loadRegistration('10007','東煒泰和',fetcher,{pageSize:2});assert.equal(reg.status,'partial');assert.equal(reg.rows.length,2);assert.ok(reg.error);
});
test('an upstream block is reported without attempting a bypass route',async()=>{
 let n=0;const reg=await loadRegistration('10007','東煒泰和',async()=>{n++;return new Response('Forbidden',{status:403});});
 assert.equal(reg.status,'blocked');assert.equal(reg.rows.length,0);assert.equal(n,1);
});
test('community page mismatch never enters the property valuation',async()=>{
 const reg=await loadRegistration('10007','東煒泰和',async()=>new Response('<title>另一社區實價登錄</title>'));
 assert.equal(reg.status,'mismatch');assert.equal(reg.rows.length,0);
});

test('missing source flags remain unknown instead of becoming confirmed negative',()=>{
 const r=normalizeTransaction(item(1,{has_park:undefined,is_special:undefined,shift_floor_val:undefined}),10007);
 assert.equal(r.hasParking,null);assert.equal(r.parkingPriceWan,null);assert.equal(r.special,null);assert.equal(r.floor,null);
 const p=normalizeTransaction(item(2,{real_park_total_price_v:{price:'200',unit:'萬'},real_park_area:{area:'6',unit:'坪'}}),10007);assert.equal(p.parkingEstimated,null);
});
test('overlapping pages preserve raw receive and duplicate counts',async()=>{
 const fetcher=async u=>{if(String(u).includes('/10007/price'))return new Response(html);const page=Number(new URL(u).searchParams.get('page'));return Response.json({status:1,data:{total:4,page,items:page===1?[item(1),item(2)]:[item(2),item(3),item(4)]}})};
 const reg=await loadRegistration('10007','東煒泰和',fetcher,{pageSize:2});assert.equal(reg.status,'complete');assert.equal(reg.rows.length,5);
 const {default:Core}=await import('../registration-core.js');const s=Core.summarize(reg);assert.equal(s.rawCount,5);assert.equal(s.uniqueCount,4);assert.equal(s.excluded.duplicate,1);
});

test('a temporary page timeout retries the same public request once',async()=>{
 let attempts=0;const fetcher=async u=>{if(String(u).includes('/10007/price'))return new Response(html);attempts++;if(attempts===1)throw new DOMException('timeout','TimeoutError');return Response.json({status:1,data:{total:4,page:1,items:[item(1),item(2),item(3),item(4)]}})};
 const reg=await loadRegistration('10007','東煒泰和',fetcher);assert.equal(reg.status,'complete');assert.equal(attempts,2);
});

test('listing parking label can contain nested presentation spans',()=>{
 const h=saleHtml.replace('>車位</div>','><span>車位</span></div>');assert.equal(parseListing(h,'https://sale.591.com.tw/123').parkingAreaPing,12.217);
});
