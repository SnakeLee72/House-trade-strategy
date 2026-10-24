const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Core = require('../registration-core.js');
const uiCode = fs.readFileSync('registration-ui.js', 'utf8');

function setupTestEnvironment() {
  const nodes = {};
  const elementIds = [
    'input-asking-price', 'input-reg-price', 'calc-follow-active', 'calc-reference-status',
    'calc-true-bottom', 'calc-fake-1', 'calc-fake-2', 'calc-fake-3', 'calc-net-seller',
    'btn-save-prop-explicit', 'btn-del-prop', 'btn-recalc-knives', 'refresh-property-source',
    'prop-view-status-label', 'prop-saved-badge', 'prop-status-hint', 'prop-editing-title',
    'prop-count-badge', 'prop-tabs-container', 'prop-form-content', 'knives-container',
    'comparison-table-body', 'prop-score-num', 'prop-knives-count', 'prop-verdict-desc',
    'prop-badge-tier', 'prop-redline-alert', 'price-ceiling-val', 'price-asking-val',
    'val-fake-1', 'val-fake-2', 'val-fake-3', 'val-true-bottom', 'price-net-seller',
    'reg-card-asking-display', 'reg-card-ceiling-display', 'reg-card-avg-unit',
    'reg-card-unit-range', 'reg-card-parking-detail', 'reg-card-net-size',
    'reg-card-premium-pct', 'reg-card-formula-box', 'property-conditions', 'property-source-status',
    'link-google-maps', 'link-google-transit', 'transit-link-label', 'link-leju-search',
    'weapons-count-badge', 'bargaining-weapons-list', 'actionable-playbook-grid',
    'prop-input-community', 'prop-input-name', 'prop-input-district', 'prop-input-mrt',
    'prop-input-asking', 'prop-input-reg', 'prop-input-size', 'prop-input-households',
    'prop-input-has-parking', 'prop-input-parking-size', 'prop-input-parking-price', 'prop-input-notes'
  ];

  for (const id of elementIds) {
    nodes[id] = {
      id,
      value: '',
      checked: true,
      textContent: '',
      disabled: false,
      classList: {
        classes: new Set(),
        add(...c) { c.forEach(x => this.classes.add(x)); },
        remove(...c) { c.forEach(x => this.classes.delete(x)); },
        toggle(c, force) { if (force !== undefined) { if (force) this.classes.add(c); else this.classes.delete(c); } else { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); } },
        contains(c) { return this.classes.has(c); }
      },
      style: {},
      innerHTML: '',
      appendChild(child) { this.children = this.children || []; this.children.push(child); },
      addEventListener() {},
      scrollIntoView() {},
      focus() {}
    };
  }

  let toastMessage = '';
  const listeners = {};
  const ctx = {
    RegistrationCore: Core,
    console,
    nineKnivesData: [
      { id: 1, title: '第一把刀：定位強勢辦公區', rule: '房價跟著人跑', checkTip: '5km內' },
      { id: 2, title: '第二把刀：捷運通勤 30 分鐘內', rule: '30分鐘剎車距離', checkTip: '捷運站' },
      { id: 3, title: '第三把刀：走路到捷運 10 分鐘內', rule: '10分鐘邊界', checkTip: '步行750米' },
      { id: 4, title: '第四把刀：單價比較與套房例外法則', rule: '同社區低單價', checkTip: '實登拆算' },
      { id: 5, title: '第五把刀：避開總價帶天花板陷阱', rule: '總價破頂卡死', checkTip: '區域上限' },
      { id: 6, title: '第六把刀：排除三大地雷產品類型', rule: '不碰酒店式、隔套', checkTip: '機械車位' },
      { id: 7, title: '第七把刀：控制社區總戶數', rule: '戶數上限', checkTip: '400戶內' },
      { id: 8, title: '第八把刀：買甘蔗中段不買前段', rule: '機能兌現', checkTip: '商圈點燈率' },
      { id: 9, title: '第九把刀：現金流三年不斷鏈紅線', rule: '3年不斷鏈', checkTip: '停薪抗壓' }
    ],
    STORAGE_KEY: 'test_user_props',
    localStorage: {
      data: {},
      getItem(k) { return this.data[k] ?? null; },
      setItem(k, v) { this.data[k] = String(v); }
    },
    document: {
      getElementById: id => nodes[id] || null,
      createElement: tag => ({
        tagName: tag,
        className: '',
        innerHTML: '',
        textContent: '',
        style: {},
        classList: {
          classes: new Set(),
          add(...c) { c.forEach(x => this.classes.add(x)); },
          remove(...c) { c.forEach(x => this.classes.delete(x)); },
          toggle(c, force) { if (force !== undefined) { if (force) this.classes.add(c); else this.classes.delete(c); } else { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); } },
          contains(c) { return this.classes.has(c); }
        },
        appendChild(child) { this.children = this.children || []; this.children.push(child); },
        addEventListener(type, fn) { listeners[type] = fn; },
        querySelector: () => ({ addEventListener(type, fn) { listeners[type] = fn; } })
      })
    },
    window: {},
    activePropertyId: null,
    userProperties: [],
    getActiveProperty: () => ctx.userProperties.find(p => p.id === ctx.activePropertyId) || ctx.userProperties[0] || null,
    showToast: msg => { toastMessage = msg; },
    openConfirmModal: (title, text, onConfirm) => { onConfirm(); },
    fallbackCopyText: () => {}
  };

  vm.createContext(ctx);
  vm.runInContext(uiCode, ctx);
  return { ctx, nodes, getToast: () => toastMessage };
}

test('Saved property remains fully editable and deletable: all inputs and delete button enabled', () => {
  const { ctx, nodes } = setupTestEnvironment();
  const savedProp = {
    modelVersion: 2,
    id: 'prop_saved_1',
    community: '日安巴黎',
    name: '公園首排三房',
    district: '新北市三重區永安北路二段171號',
    mrt: '徐匯中學站（地圖預估步行 14 分鐘）',
    walkMinutes: 14,
    walkEvidence: 'map_route',
    askingPrice: 3398,
    manualReferenceWan: 2850,
    totalAreaPing: 50.99,
    households: 40,
    hasParking: true,
    parkingAreaPing: 8.1,
    parkingPriceWan: 250,
    isSaved: true
  };

  ctx.userProperties = [savedProp];
  ctx.activePropertyId = savedProp.id;
  ctx.renderEvaluationView();

  // 1. Verify editable status label & enabled actions
  assert.equal(nodes['prop-view-status-label'].textContent, '正在編輯：');
  assert.match(nodes['prop-saved-badge'].textContent, /已儲存（隨時可修改）/);
  assert.match(nodes['btn-save-prop-explicit'].innerHTML, /已儲存修改/);
  assert.equal(nodes['btn-save-prop-explicit'].disabled, false);

  // 2. Verify Delete and Recalc buttons are enabled
  assert.equal(nodes['btn-del-prop'].disabled, false);
  assert.equal(nodes['btn-recalc-knives'].disabled, false);

  // 3. Verify all form inputs are enabled for editing
  assert.equal(nodes['prop-input-community'].disabled, false);
  assert.equal(nodes['prop-input-asking'].disabled, false);
  assert.equal(nodes['prop-input-households'].disabled, false);
  assert.equal(nodes['prop-input-mrt'].disabled, false);
  assert.equal(nodes['prop-input-size'].disabled, false);
  assert.equal(nodes['prop-input-has-parking'].disabled, false);

  // 4. Verify deletePropertyById successfully deletes the property
  ctx.deletePropertyById(savedProp.id);
  assert.equal(ctx.userProperties.length, 0);
  assert.equal(ctx.activePropertyId, null);
});

test('Empty state without default property renders cleanly and leaves form blank', () => {
  const { ctx, nodes } = setupTestEnvironment();
  ctx.userProperties = [];
  ctx.activePropertyId = null;
  ctx.renderEvaluationView();

  assert.equal(nodes['prop-view-status-label'].textContent, '目前狀態：');
  assert.match(nodes['prop-saved-badge'].textContent, /尚無物件/);
  assert.equal(nodes['prop-editing-title'].textContent, '尚未建立物件');
  assert.equal(nodes['prop-input-community'].value, '');
  assert.equal(nodes['prop-input-asking'].value, '');
  assert.equal(nodes['btn-del-prop'].disabled, true);
  assert.equal(nodes['btn-save-prop-explicit'].disabled, true);
});

test('Nine Knives smart auto-evaluations correctly determine pass/fail states', () => {
  // Test Knife 1 (Employment geo distance), Knife 2 (commute <= 30), Knife 3 (walk <= 10)
  const prop1 = {
    modelVersion: 2,
    community: '日安巴黎',
    district: '新北市三重區',
    geo: { lat: 25.0837, lng: 121.4912 }, // ~4.5km to Taipei center -> Knife 1 pass
    mrtDetails: { station: '徐匯中學站', walkMinutes: 8 },
    walkMinutes: 8,
    walkEvidence: 'map_route',
    askingPrice: 2800, // <= 3200 New Taipei ceiling -> Knife 5 pass
    households: 120,   // <= 400 New Taipei -> Knife 7 pass
    age: '5年',        // >= 3 years -> Knife 8 pass
    manualReferenceWan: 2500, // premiumPct = (2800/2500 - 1) = 12% <= 16% -> Knife 4 pass
    hotelApartment: false,
    dividedSuites: false,
    siteAreaPing: 350  // >= 100 -> Knife 6 pass
  };

  const pricing1 = Core.derivePricing(prop1);
  const knives1 = Core.evaluateKnives(prop1, pricing1);

  assert.equal(knives1.states[1], 'pass'); // Within 5km of employment center
  assert.equal(knives1.states[2], 'unknown'); // Walk-to-station time is not a commute time
  assert.equal(Core.evaluateKnives({ ...prop1, commuteMinutes: 25 }).states[2], 'pass');
  assert.equal(Core.evaluateKnives({ ...prop1, commuteMinutes: 40 }).states[2], 'fail');
  assert.equal(knives1.states[3], 'pass'); // Walk <= 10 min
  assert.equal(knives1.states[4], 'pass'); // Premium 12% <= 16%
  assert.equal(knives1.states[5], 'pass'); // 2800 <= 3200 ceiling
  assert.equal(knives1.states[6], 'pass'); // Site 350 ping, clean product
  assert.equal(knives1.states[7], 'pass'); // 120 <= 400 households
  assert.equal(knives1.states[8], 'pass'); // 5 years mature building

  // Test failing conditions: walk > 10 min, asking exceeds ceiling, households exceed threshold
  const prop2 = {
    modelVersion: 2,
    community: '遠山巨型城',
    district: '新北市淡水區',
    walkMinutes: 18,
    walkEvidence: 'map_route',
    askingPrice: 3600, // > 3200 ceiling -> Knife 5 fail
    households: 850,   // > 400 -> Knife 7 fail
    manualReferenceWan: 2500, // premiumPct = 44% > 16% -> Knife 4 fail
    notes: '現成隔套收租，附機械車位' // Knife 6 fail
  };

  const pricing2 = Core.derivePricing(prop2);
  const knives2 = Core.evaluateKnives(prop2, pricing2);

  assert.equal(knives2.states[3], 'fail'); // 18 min > 10 min
  assert.equal(knives2.states[4], 'fail'); // Premium 44% > 16%
  assert.equal(knives2.states[5], 'fail'); // 3600 > 3200 ceiling
  assert.equal(knives2.states[6], 'fail'); // Divided suites & mechanical parking
  assert.equal(knives2.states[7], 'fail'); // 850 > 400 households
});

test('Information linkage: 4-tier pricing, net area and calculator update properly', () => {
  const p = {
    modelVersion: 2,
    askingPrice: 3200,
    totalAreaPing: 50,
    hasParking: true,
    parkingAreaPing: 10,
    parkingPriceWan: 200,
    manualReferenceWan: 2600
  };

  const pricing = Core.derivePricing(p);
  assert.equal(pricing.netArea, 40); // 50 - 10
  assert.equal(pricing.fake1, 1560); // 60% of 2600
  assert.equal(pricing.fake2, 1768); // 68% of 2600
  assert.equal(pricing.fake3, 1950); // 75% of 2600
  assert.equal(pricing.trueBottom, 2080); // 80% of 2600
  assert.equal(pricing.netSeller, 3072); // 96% of 3200
  assert.equal(pricing.premiumPct, 23.08); // (3200/2600 - 1)*100
});

test('Committed identity edits clear stale evidence but keep manual reference and finances', () => {
  const { ctx } = setupTestEnvironment();
  const p = { modelVersion: 2, id: 'p1', community: '舊社區', district: '台北市大安區', mrt: '大安站', walkMinutes: 8, walkEvidence: 'confirmed', officeDistanceKm: 3, commuteMinutes: 25, households: 180, manualReferenceWan: 3500, askingPrice: 3800, cashReserveWan: 500, hotelApartment: false, registration: { rows: [] }, knifeOverrides: { 1: 'pass', 6: 'pass' }, clonedFrom: 'p0' };
  const note = ctx.invalidatePropertyEvidence(p, 'district');
  assert.match(note, /已清除/);
  for (const key of ['walkMinutes', 'officeDistanceKm', 'commuteMinutes', 'households', 'registration', 'hotelApartment']) assert.equal(p[key], null, key);
  assert.equal(p.manualReferenceWan, 3500);
  assert.equal(p.cashReserveWan, 500);
  assert.equal(p.mrt, '大安站');
  assert.equal(JSON.stringify(p.knifeOverrides), '{}');
  assert.equal(p.clonedFrom, undefined);
  const k = Core.evaluateKnives(p);
  for (const id of [1, 2, 3, 7]) assert.equal(k.states[id], 'unknown', 'knife ' + id);

  const q = { modelVersion: 2, mrt: '大安站', walkMinutes: 8, walkEvidence: 'confirmed', knifeOverrides: { 3: 'pass', 5: 'fail' } };
  assert.match(ctx.invalidatePropertyEvidence(q, 'mrt'), /步行時間已清除/);
  assert.equal(q.walkMinutes, null);
  assert.equal(Core.evaluateKnives(q).states[3], 'unknown');
  assert.equal(JSON.stringify(q.knifeOverrides), '{"5":"fail"}');
});

test('Cloned property is labelled distinctly from its source', () => {
  const { ctx } = setupTestEnvironment();
  assert.equal(ctx.propertyLabel({ community: '測試社區' }), '測試社區');
  assert.equal(ctx.propertyLabel({ community: '測試社區', clonedFrom: 'x' }), '測試社區（複製案）');
  assert.equal(ctx.propertyLabel({ name: '物件 (複製案)', clonedFrom: 'x' }), '物件 (複製案)');
});

test('Three-year window covers exactly 36 months and listing walk claims stay unconfirmed', () => {
  const { ctx } = setupTestEnvironment();
  const reg = { status: 'complete', reportedCount: 2, rows: [
    { id: 'in', date: '2023-11', floor: 5, houseAreaPing: 30, housePriceWan: 1800, hasParking: false, special: false },
    { id: 'out', date: '2023-10', floor: 5, houseAreaPing: 30, housePriceWan: 1800, hasParking: false, special: false }
  ] };
  const s = Core.summarize(reg, { now: '2026-10-20' });
  assert.equal(s.usedCount, 1);
  assert.equal(s.excluded.outsidePeriod, 1);
  assert.match(s.period, /^2023-11 至 2026-10$/);

  const p = ctx.parseListingText('社區：測試　台北市大安區 捷運大安站 步行5分鐘 總價：3000萬');
  assert.equal(p.walkMinutes ?? null, null);
  assert.equal(p.listingWalkMinutes, 5);
  assert.match(p.mrt, /刊登宣稱步行 5 分鐘（未核對）/);
  assert.equal(Core.evaluateKnives(p).states[3], 'unknown');
});

test('Cash-flow red alert distinguishes stress-test failure from a manual mark', () => {
  const { ctx } = setupTestEnvironment();
  const auto = ctx.evaluateProperty({ modelVersion: 2, cashReserveWan: 10, monthlyIncomeWan: 5, monthlyExpenseWan: 3, stressMortgageWan: 3 });
  assert.match(auto.redAlerts[0], /壓力測試未通過/);
  const manual = ctx.evaluateProperty({ modelVersion: 2, knifeOverrides: { 9: 'fail' } });
  assert.match(manual.redAlerts[0], /已手動標記/);
});
