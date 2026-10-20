(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.RegistrationCore = core;
})(globalThis, function () {
  'use strict';
  const number = value => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  const positive = value => number(value) > 0 ? Number(value) : null;
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const median = values => { const s = [...values].sort((a,b) => a-b); return s.length ? (s[Math.floor((s.length-1)/2)] + s[Math.floor(s.length/2)]) / 2 : null; };
  const EMPLOYMENT_CENTERS = [
    { name: '台北核心與信義', lat: 25.041, lng: 121.565 },
    { name: '內湖科技園區', lat: 25.078, lng: 121.574 },
    { name: '南港軟體園區', lat: 25.059, lng: 121.616 },
    { name: '新北新板特區', lat: 25.013, lng: 121.465 },
    { name: '新莊副都心產業園區', lat: 25.060, lng: 121.455 },
    { name: '新竹科學園區', lat: 24.777, lng: 121.014 },
    { name: '台中七期市政與中科', lat: 24.162, lng: 120.640 },
    { name: '台南科學園區', lat: 23.115, lng: 120.288 },
    { name: '高雄亞灣與軟體園區', lat: 22.607, lng: 120.306 }
  ];
  function distanceMetres(a, b) {
    const rad = x => (x * Math.PI) / 180;
    const q = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
  }
  function emptyProperty(name = '新物件') {
    return { modelVersion: 2, id: 'prop_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), name, community: '', district: '', mrt: '', askingPrice: null, totalAreaPing: null, parkingAreaPing: null, parkingPriceWan: null, hasParking: null, households: null, regPrice: null, registration: null, manualReferenceWan: null, knives: [], knifeOverrides: {}, notes: '', isSaved: false };
  }
  function migrateProperty(value) {
    if (value.modelVersion === 2) {
      if (value.isSaved === undefined) value.isSaved = true;
      return value;
    }
    const p = emptyProperty(value.name || '舊版物件待確認');
    p.id = value.id || p.id;
    p.legacySnapshot = { ...value };
    p.dataWarning = '舊版欄位可能含預設或推估值，已保留原始紀錄並停止參與計算。請重新讀取物件或手動填入確認值。';
    p.isSaved = true;
    return p;
  }
  function summarize(registration, options = {}) {
    const months = options.months === 60 ? 60 : 36;
    const now = new Date(options.now || Date.now());
    const endMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const startMonth = endMonth - months;
    const excluded = { duplicate: 0, invalidDate: 0, special: 0, firstFloor: 0, outsidePeriod: 0, estimatedParking: 0, missingValues: 0 };
    const rows = Array.isArray(registration?.rows) ? registration.rows : [];
    const seen = new Set(); const usedRows = []; const inspectedRows = [];
    for (const original of rows) {
      const row = { ...original };
      const key = row.id || [row.date,row.address,row.floor,row.totalPriceWan,Math.round(Number(row.houseAreaPing)*10)/10].join('|');
      let reason = '';
      if (seen.has(key)) { excluded.duplicate++; continue; }
      seen.add(key);
      const match = /^(\d{4})-(\d{2})$/.exec(row.date || '');
      const ym = match ? Number(match[1]) * 12 + Number(match[2]) - 1 : NaN;
      if (!match || +match[2] < 1 || +match[2] > 12 || ym > endMonth) reason = 'invalidDate';
      else if (row.special === true) reason = 'special';
      else if (options.excludeFirstFloor !== false && Number(row.floor) === 1) reason = 'firstFloor';
      else if (ym < startMonth) reason = 'outsidePeriod';
      else if (row.parkingEstimated === true && !options.includeEstimatedParking) reason = 'estimatedParking';
      const area = positive(row.houseAreaPing);
      const price = positive(row.housePriceWan);
      if (!reason && (!area || !price || typeof row.special !== 'boolean' || typeof row.hasParking !== 'boolean' || (options.excludeFirstFloor !== false && !positive(row.floor)) || (row.hasParking === true && (number(row.parkingPriceWan) == null || number(row.parkingPriceWan) < 0 || typeof row.parkingEstimated !== 'boolean')))) reason = 'missingValues';
      row.calculatedUnit = area && price ? price / area : null;
      row.exclusion = reason;
      if (reason) excluded[reason]++;
      else usedRows.push(row);
      inspectedRows.push(row);
    }
    const units = usedRows.map(row => row.calculatedUnit);
    const complete = registration?.status === 'complete' && registration?.reportedCount === seen.size;
    const period = `${Math.floor(startMonth/12)}-${String(startMonth%12+1).padStart(2,'0')} 至 ${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
    return { rawCount: rows.length, reportedCount: registration?.reportedCount ?? null, uniqueCount: seen.size, usedCount: usedRows.length, excluded, complete, sufficient: complete && usedRows.length >= 5, medianUnit: median(units), weightedUnit: usedRows.length ? usedRows.reduce((s,r)=>s+r.housePriceWan,0) / usedRows.reduce((s,r)=>s+r.houseAreaPing,0) : null, minUnit: units.length ? Math.min(...units) : null, maxUnit: units.length ? Math.max(...units) : null, usedEstimatedCount: usedRows.filter(r=>r.parkingEstimated).length, usedRows, inspectedRows, period, months, sourceUrl: registration?.sourceUrl || '', status: registration?.status || 'unavailable' };
  }
  function derivePricing(p, options = p.analysisOptions || {}) {
    const stats = summarize(p.registration, options);
    let reference = null, source = 'unavailable';
    const manual = positive(p.manualReferenceWan);
    const totalArea = positive(p.totalAreaPing);
    const parkArea = p.hasParking === false ? 0 : number(p.parkingAreaPing);
    const parkPrice = p.hasParking === false ? 0 : number(p.parkingPriceWan);
    const netArea = totalArea && parkArea != null && parkArea >= 0 && totalArea > parkArea ? totalArea - parkArea : null;
    if (manual) { reference = manual; source = 'manual'; }
    else if (stats.sufficient && netArea && parkPrice != null && parkPrice >= 0 && (p.hasParking === false || p.hasParking === true)) {
      reference = round(netArea * stats.medianUnit + parkPrice);
      source = stats.usedEstimatedCount ? 'transactions_with_estimates' : 'transactions';
    }
    const asking = positive(p.askingPrice);
    return { reference, reg: reference, asking, source, netArea, stats, premiumPct: reference && asking ? round((asking/reference-1)*100) : null, askingUnit: asking && netArea && parkPrice != null && asking > parkPrice ? (asking-parkPrice)/netArea : null, fake1: reference ? Math.round(reference*.6) : null, fake2: reference ? Math.round(reference*.68) : null, fake3: reference ? Math.round(reference*.75) : null, trueBottom: reference ? Math.round(reference*.8) : null, netSeller: asking ? Math.round(asking*.96) : null };
  }
  function evaluateKnives(p, pricing = derivePricing(p)) {
    const states = Object.fromEntries(Array.from({length:9},(_,i)=>[i+1,'unknown']));
    const set = (id,value) => { if (typeof value === 'boolean') states[id] = value ? 'pass' : 'fail'; };

    // Knife 1: 定位強勢辦公區 (5km內大型產業/總部)
    if (number(p.officeDistanceKm)!=null && p.officeDistanceKm>=0) set(1, Number(p.officeDistanceKm)<=5);
    else if (p.geo && number(p.geo.lat)!=null && number(p.geo.lng)!=null && p.geo.lat>=20 && p.geo.lat<=26) {
      const nearestKm = Math.min(...EMPLOYMENT_CENTERS.map(c => distanceMetres(p.geo, c))) / 1000;
      if (nearestKm <= 5) set(1, true);
      else if (nearestKm > 15) set(1, false);
    }

    // Knife 2: 捷運通勤 30 分鐘內
    if (number(p.commuteMinutes)!=null && p.commuteMinutes>=0) set(2, Number(p.commuteMinutes)<=30);
    else if (p.mrtDetails?.station && number(p.walkMinutes)!=null && ['confirmed','map_route'].includes(p.walkEvidence)) {
      if (p.walkMinutes <= 15) set(2, true);
      else if (p.walkMinutes > 25) set(2, false);
    }

    // Knife 3: 走路到捷運 10 分鐘內
    if (number(p.walkMinutes) != null && p.walkMinutes>=0 && ['confirmed','map_route'].includes(p.walkEvidence)) set(3, Number(p.walkMinutes)<=10);

    // Knife 4: 單價比較與套房例外法則
    if (pricing.premiumPct != null) set(4,pricing.premiumPct<=16);

    // Knife 5: 避開總價帶天花板陷阱 (台北4000/新北竹北3200/其他2400)
    const district = p.district || '';
    const ceiling = /台北|臺北/.test(district) ? 4000 : /新北|新竹/.test(district) ? 3200 : /桃園|台中|臺中|台南|臺南|高雄/.test(district) ? 2400 : (district ? 2400 : null);
    if (ceiling && positive(p.askingPrice)) set(5,Number(p.askingPrice)<=ceiling);

    // Knife 6: 排除三大地雷產品類型 (酒店式公寓、小基地危老、現成隔套)
    if (typeof p.productRiskVerified === 'boolean') set(6,!p.productRiskVerified);
    else {
      const text = [p.name, p.community, p.notes, p.title, p.layout].filter(Boolean).join(' ');
      const riskKeywords = /酒店式|隔套|分租|滿租|收租套房|現成隔套|工業宅|夾層|違建|頂加|辦公室|工廠|倉庫/;
      const mechanicalParking = /機械|升降|倉儲/;
      if ([p.hotelApartment,p.dividedSuites].some(v=>v===true) || (positive(p.siteAreaPing) && p.siteAreaPing<100) || riskKeywords.test(text) || mechanicalParking.test(text)) set(6,false);
      else if (p.hotelApartment===false && p.dividedSuites===false && positive(p.siteAreaPing)>=100) set(6,true);
    }

    // Knife 7: 控制社區總戶數 (台北<=220, 新北新竹<=400, 其他<=500)
    if (positive(p.households)) {
      const maxHouseholds = /台北|臺北/.test(district) ? 220 : /新北|新竹/.test(district) ? 400 : 500;
      set(7,Number(p.households)<=maxHouseholds);
    }

    // Knife 8: 買甘蔗中段不買前段 (商圈機能、學校、成屋成熟期)
    if (typeof p.matureArea === 'boolean') set(8,p.matureArea);
    else if ([p.dailyAmenities,p.schoolOperating,p.occupancyOverHalf].some(v=>v===false)) set(8,false);
    else if ([p.dailyAmenities,p.schoolOperating,p.occupancyOverHalf].every(v=>v===true)) set(8,true);
    else if (p.age) {
      const ageNum = positive(String(p.age).match(/(\d+)/)?.[1]);
      if (ageNum && ageNum >= 3 && ageNum <= 35) set(8, true);
      else if (ageNum != null && ageNum < 1) set(8, false);
    }

    // Knife 9: 現金流三年不斷鏈紅線
    if (typeof p.cashFlowVerified === 'boolean') set(9,p.cashFlowVerified);
    else if (['cashReserveWan','monthlyIncomeWan','monthlyExpenseWan','stressMortgageWan'].every(key=>number(p[key])!=null&&p[key]>=0)) {
      // Six months without income followed by 30 months at the supplied income.
      const expense=Number(p.monthlyExpenseWan)+Number(p.stressMortgageWan);
      const afterSix=Number(p.cashReserveWan)-6*expense;
      set(9,afterSix>=0 && afterSix+30*(Number(p.monthlyIncomeWan)-expense)>=0);
    }
    for (const [key,value] of Object.entries(p.knifeOverrides || {})) if (+key>=1 && +key<=9 && ['pass','fail','unknown'].includes(value)) states[key]=value;
    const list = state => Object.keys(states).filter(k=>states[k]===state).map(Number);
    return { states, passed:list('pass'), failed:list('fail'), unknown:list('unknown') };
  }
  const format = (value, suffix = '') => number(value) == null ? '待確認' : number(value).toLocaleString('zh-TW',{maximumFractionDigits:2}) + suffix;
  function report(p) {
    const price=derivePricing(p), k=evaluateKnives(p,price), s=price.stats;
    return `【買房九把刀評估】${p.community || p.name || '未命名'}\n物件來源：${p.sourceUrl || '手動輸入'}\n開價：${format(price.asking,' 萬')}\n實登來源：${s.sourceUrl || '尚未取得'}\n擷取時間：${p.registration?.fetchedAt || '無'}\n來源總數 ${s.reportedCount ?? '未知'}／取得 ${s.rawCount}／去重後 ${s.uniqueCount}／採用 ${s.usedCount} 筆（${s.complete?'完整':'不完整或未取得'}）\n期間：${s.period}\n剔除：${JSON.stringify(s.excluded)}\n車位估算納入 ${s.usedEstimatedCount} 筆\n淨單價中位數：${format(s.medianUnit,' 萬/坪')}；面積加權均價：${format(s.weightedUnit,' 萬/坪')}\n統計樣本${s.sufficient?'達5筆':'不足5筆或資料不完整'}；不做機械式去頭去尾\n計算：每筆房屋價÷扣車位面積；中位數×本戶扣車位面積＋本戶車位價\n比較基準：${format(price.reference,' 萬')}（${price.source==='manual'?'手動輸入，未經系統查證':price.source==='transactions_with_estimates'?'含估算車位，僅供參考':price.source==='transactions'?'成交樣本試算':'未建立'}）\n開價差異：${format(price.premiumPct,'%')}\n60%：${format(price.fake1,' 萬')}／68%：${format(price.fake2,' 萬')}／75%：${format(price.fake3,' 萬')}／80%：${format(price.trueBottom,' 萬')}\n以上為策略比例試算，不代表成交價或保證底價。\n九把刀：通過 ${k.passed.length}／不通過 ${k.failed.length}／待確認 ${k.unknown.length}\n筆記：${p.notes || '無'}`;
  }
  return { number, positive, round, median, emptyProperty, migrateProperty, summarize, derivePricing, evaluateKnives, format, report };
});
