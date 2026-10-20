const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../registration-core.js');
const row = (id, unit = 60, extra = {}) => ({ id, date: '2025-01', address: '三德街60號', floor: 9, houseAreaPing: 50, housePriceWan: unit * 50, totalPriceWan: unit * 50 + 200, parkingAreaPing: 6, parkingPriceWan: 200, hasParking: true, parkingEstimated: false, special: false, ...extra });
const registration = (rows, extra = {}) => ({ status: 'complete', reportedCount: rows.length, fetchedAt: '2026-10-20T00:00:00Z', sourceUrl: 'https://market.591.com.tw/10007/price', rows, ...extra });

test('unknown and legacy estimates never become transaction references', () => {
  const p = Core.migrateProperty({ id: 'x', regPrice: 5066, regDetails: { recentAvg: 66.9 }, knives: [1,2,3,4,5,6,7,8,9] });
  assert.equal(Core.derivePricing(p).reference, null);
  assert.equal(p.legacySnapshot.regPrice, 5066);
  assert.equal(Core.evaluateKnives(p).states[9], 'unknown');
});
test('no default asking price, size, household count or cashflow approval', () => {
  const p = Core.emptyProperty();
  assert.equal(p.askingPrice, null); assert.equal(p.totalAreaPing, null); assert.equal(p.households, null);
  assert.equal(Core.evaluateKnives(p).unknown.length, 9);
});
test('estimated parking is excluded by default and can only be opted into as a labeled reference', () => {
  const reg = registration([row('a',65.1,{parkingEstimated:true}),row('b',73.9,{parkingEstimated:true})]);
  const strict = Core.summarize(reg,{now:'2026-10-20'});
  assert.equal(strict.usedCount,0); assert.equal(strict.excluded.estimatedParking,2);
  const included=Core.summarize(reg,{now:'2026-10-20',includeEstimatedParking:true});
  assert.equal(included.usedCount,2); assert.equal(included.medianUnit,69.5); assert.equal(included.sufficient,false);
});
test('filters and counts are independently reproducible without hiding a partial fetch', () => {
  const a=row('a');
  const reg=registration([a,a,row('b',60,{special:true}),row('c',60,{floor:1}),row('d',60,{date:'2012-06'}),row('e',60,{parkingEstimated:true})],{reportedCount:64,status:'partial'});
  const s=Core.summarize(reg,{now:'2026-10-20'});
  assert.equal(s.rawCount,6);assert.equal(s.uniqueCount,5);assert.equal(s.excluded.duplicate,1);
  assert.equal(s.usedCount,1);assert.equal(s.complete,false);assert.equal(s.sufficient,false);
  assert.equal(s.excluded.special,1);assert.equal(s.excluded.firstFloor,1);assert.equal(s.excluded.outsidePeriod,1);
});
test('median and area weighted mean use real house prices and net areas', () => {
  const s=Core.summarize(registration([row('a',50),row('b',55),row('c',60),row('d',65),row('e',70)]),{now:'2026-10-20'});
  assert.equal(s.medianUnit,60); assert.equal(s.weightedUnit,60); assert.equal(s.sufficient,true);
});
test('unknown target parking price prevents a total reference even with sufficient trades', () => {
  const p={modelVersion:2,askingPrice:5996,totalAreaPing:80.91,parkingAreaPing:12.217,parkingPriceWan:null,hasParking:true,registration:registration([1,2,3,4,5].map(i=>row(String(i))))};
  assert.equal(Core.derivePricing(p,{now:'2026-10-20'}).reference,null);
  p.parkingPriceWan=400;
  const price=Core.derivePricing(p,{now:'2026-10-20'});
  assert.equal(price.reference,4521.58);assert.equal(price.trueBottom,3617);
  assert.equal(price.netSeller,5756);
});
test('missing or invalid reference never produces a zero offer or a negative premium', () => {
  const p=Core.derivePricing({modelVersion:2,askingPrice:2000});
  assert.equal(p.trueBottom,null);assert.equal(p.premiumPct,null);assert.equal(p.reference,null);
});
test('manual reference is explicitly manual and updates all offer stages', () => {
  const p=Core.derivePricing({modelVersion:2,askingPrice:2500,manualReferenceWan:2000});
  assert.equal(p.source,'manual');assert.equal(p.fake1,1200);assert.equal(p.fake2,1360);assert.equal(p.fake3,1500);assert.equal(p.trueBottom,1600);
  assert.equal(p.premiumPct,25);assert.equal(p.netSeller,2400);
});
test('large price or absent risk keywords cannot pass finance, commute or product checks', () => {
  const k=Core.evaluateKnives({modelVersion:2,askingPrice:2000,district:'新北市三重區',mrt:'近捷運7分鐘',households:null});
  assert.equal(k.states[2],'unknown'); assert.equal(k.states[3],'unknown');assert.equal(k.states[6],'unknown');assert.equal(k.states[9],'unknown');
  assert.equal(k.states[5],'pass');
});
test('manual per-knife verification is explicit and can be returned to unknown', () => {
  const p={modelVersion:2,knifeOverrides:{9:'pass',6:'fail'}};
  assert.equal(Core.evaluateKnives(p).states[9],'pass');assert.equal(Core.evaluateKnives(p).states[6],'fail');
  p.knifeOverrides[9]='unknown';assert.equal(Core.evaluateKnives(p).states[9],'unknown');
});
test('unknown parking components are not silently treated as zero', () => {
  const s=Core.summarize(registration([row('a',60,{parkingPriceWan:null,housePriceWan:null})]),{now:'2026-10-20'});
  assert.equal(s.usedCount,0);assert.equal(s.excluded.missingValues,1);
});
test('only five years explicitly selected includes older records', () => {
  const reg=registration([row('a',60,{date:'2022-05'})]);
  assert.equal(Core.summarize(reg,{now:'2026-10-20'}).usedCount,0);
  assert.equal(Core.summarize(reg,{now:'2026-10-20',months:60}).usedCount,1);
});

test('legacy unverified listing defaults cannot remain active evidence',()=>{
 const p=Core.migrateProperty({id:'old',name:'舊案',askingPrice:2380,size:'32.5坪',mrt:'步行7分鐘',district:'新北市',notes:'實登62.5萬'});
 assert.equal(p.askingPrice,null);assert.equal(p.totalAreaPing,null);assert.equal(p.mrt,'');assert.equal(p.notes,'');assert.equal(p.legacySnapshot.askingPrice,2380);assert.equal(Core.evaluateKnives(p).states[5],'unknown');
});
test('unknown filter evidence excludes a trade rather than treating it as safe',()=>{
 for(const extra of [{hasParking:null},{special:null},{floor:null},{parkingEstimated:null}]){
 const s=Core.summarize(registration([1,2,3,4,5].map(i=>row(String(i),60,extra))),{now:'2026-10-20'});assert.equal(s.usedCount,0);assert.equal(s.sufficient,false);
 }
});
