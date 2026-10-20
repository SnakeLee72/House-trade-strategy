/* All property-derived outputs share RegistrationCore. Loaded before DOMContentLoaded. */
const RC = RegistrationCore;
const rh = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rf = (value,suffix='') => RC.format(value,suffix);
const rt = (id,value) => { const el=document.getElementById(id);if(el)el.textContent=value; };
function initUserProperties() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    userProperties = Array.isArray(saved) ? saved.filter(p => p && typeof p === 'object').map(item => {
      const p = RC.migrateProperty(item);
      p.isSaved = item.isSaved !== false;
      return p;
    }) : [];
  } catch {
    userProperties = [];
  }
  if (!userProperties.length) {
    const defaultProp = RC.emptyProperty('我的看屋物件');
    defaultProp.isSaved = false;
    userProperties = [defaultProp];
  }
  activePropertyId = userProperties[0].id;
  saveUserProperties();
}
function evaluateProperty(prop) {
  const pricing=RC.derivePricing(prop), k=RC.evaluateKnives(prop,pricing);
  const pending=k.unknown.length>0;
  return { ...k,count:k.passed.length,score:pending?'--':Math.round(k.passed.length/9*100),tier:pending?'資料待確認':k.failed.length?'有條件未通過':'已確認9項',tierClass:pending?'bg-amber-50 text-amber-800 border-amber-300':'bg-sky-50 text-sky-800 border-sky-300',verdict:`已確認通過 ${k.passed.length} 項、不通過 ${k.failed.length} 項、待確認 ${k.unknown.length} 項。未查證項目不會自動視為通過。此為條件檢核，不代表投資安全或獲利保證。`,redAlerts:k.failed.includes(9)?['已手動確認現金流條件未通過，請先完成財務規劃。']:[],pricing };
}
function autoEvaluateKnives(p){return RC.evaluateKnives(p).passed;}
function buildPropertyFromApiData(data,sourceUrl='') {
  const p={...RC.emptyProperty(data.title || data.community || '候選物件'),...data,modelVersion:2,sourceUrl,isSaved:false,registration:data.registration || null,totalAreaPing:RC.positive(data.totalAreaPing ?? data.size),size:RC.positive(data.totalAreaPing ?? data.size)?`${data.totalAreaPing ?? data.size}坪`:'',households:RC.positive(data.households),regPrice:null,regDetails:{},manualReferenceWan:null,knifeOverrides:{},notes:[data.floor,data.age,data.layout].filter(Boolean).join('｜')};
  p.district=data.streetAddress?.includes(data.district)?data.streetAddress:[data.district,data.streetAddress].filter(Boolean).join(' ');
  p.knives=autoEvaluateKnives(p);return p;
}
function parseListingText(input,sourceUrl='') {
  const p=RC.emptyProperty('貼上文字物件');p.sourceUrl=sourceUrl;p.notes=input.slice(0,2000);p.isSaved=false;
  const number=pattern=>RC.positive(input.match(pattern)?.[1]?.replace(/,/g,''));
  p.askingPrice=number(/(?:總價|開價|售價)\s*[:：]?\s*([\d,.]+)\s*萬/);
  p.totalAreaPing=number(/(?:權狀|建坪|面積|總坪數)\s*[:：]?\s*([\d.]+)\s*坪/);
  p.parkingAreaPing=number(/車位\s*[:：]?\s*([\d.]+)\s*坪/);
  p.hasParking=/無車位/.test(input)?false:p.parkingAreaPing?true:null;
  p.community=input.match(/社區\s*[:：]\s*([^，,。\n]+)/)?.[1]?.trim() || '';
  p.district=input.match(/(?:新北|台北|臺北|桃園|台中|臺中|台南|臺南|高雄|新竹)(?:市|縣)[^，,。\s]{1,12}?(?:區|市|鎮|鄉)/)?.[0] || '';
  p.households=number(/(?:總戶數|社區戶數)\s*[:：]?\s*(\d+)\s*戶/);p.size=p.totalAreaPing?`${p.totalAreaPing}坪`:'';
  const mrtMatch=input.match(/(?:捷運|近)\s*([^\s,，。()（）]+站)/);
  if(mrtMatch)p.mrt=mrtMatch[0];
  const walkMatch=input.match(/(?:步行|走路|走)\s*約?\s*(\d+)\s*分鐘/);
  if(walkMatch){p.walkMinutes=Number(walkMatch[1]);p.walkEvidence='confirmed';}
  p.dataWarning='本機僅萃取明示欄位，尚未取得成交資料。請貼物件網址以連結實登。';
  p.knives=autoEvaluateKnives(p);return p;
}
async function fetchHouseDataFromEdge(targetUrl) {
  const response=await fetch('/api/parse-house?'+new URLSearchParams({url:targetUrl}),{signal:AbortSignal.timeout(60000),cache:'no-store'});
  const result=await response.json();if(!response.ok || !result.success)throw Error(result.error || '來源讀取失敗');return result.data;
}
let registrationAnalysisSequence=0;
async function runAutoAnalysis(input) {
  input=String(input || '').trim();if(!input){showToast('請先貼上購屋物件網址');return;}
  const seq=++registrationAnalysisSequence;const status=document.getElementById('auto-analysis-status');const button=document.getElementById('btn-run-auto-analysis');
  status.className='p-4 rounded-2xl text-sm bg-sky-50 text-sky-900 border border-sky-200';status.textContent='正在讀取物件、核對社區及載入成交明細…';button.disabled=true;
  try {
    const isUrl=/^https?:\/\/\S+$/.test(input);
    const p=isUrl?buildPropertyFromApiData(await fetchHouseDataFromEdge(input),input):parseListingText(input);
    p.isSaved=false;
    if(seq!==registrationAnalysisSequence)return;
    userProperties.unshift(p);activePropertyId=p.id;saveUserProperties();renderEvaluationView();
    const s=RC.summarize(p.registration,p.analysisOptions);
    status.className=`p-4 rounded-2xl text-sm border ${s.complete?'bg-emerald-50 text-emerald-900 border-emerald-200':'bg-amber-50 text-amber-900 border-amber-200'}`;
    status.textContent=`已讀取 ${p.community || p.name}。成交來源共 ${s.reportedCount ?? '未知'} 筆，實際取得 ${s.rawCount} 筆（${s.complete?'完整':'未完整或尚未取得'}）；目前條件採用 ${s.usedCount} 筆。${s.sufficient?'請再確認本戶車位分價與比較條件。':'樣本不足5筆或來源不完整，停止自動估價與四階出價。'}`;
    showToast('資料已更新，請查看來源與成交明細。');
  } catch(error) { if(seq===registrationAnalysisSequence){status.className='p-4 rounded-2xl text-sm bg-amber-50 text-amber-900 border border-amber-200';status.textContent=`未完成分析：${error.message}。未建立虛構物件或成交價格。`;} }
  finally {if(seq===registrationAnalysisSequence)button.disabled=false;}
}
function deletePropertyById(id){
  const target=userProperties.find(p=>p.id===id);
  if(target?.isSaved){
    if(typeof showToast==='function')showToast('⚠️ 已儲存的物件已鎖定，只能檢視不能編輯跟刪除！若需修改請點擊「複製」。');
    return;
  }
  openConfirmModal('刪除草稿','確定刪除這筆未儲存的候選草稿？',()=>{
    userProperties=userProperties.filter(p=>p.id!==id);
    if(!userProperties.length){const fresh=RC.emptyProperty('我的看屋物件');fresh.isSaved=false;userProperties=[fresh];}
    if(activePropertyId===id)activePropertyId=userProperties[0].id;
    saveUserProperties();renderEvaluationView();
    if(typeof showToast==='function')showToast('已刪除該草稿物件');
  });
}
function editPropertyById(id){activePropertyId=id;document.querySelector('[data-tab="nine-knives"]')?.click();renderEvaluationView();const form=document.getElementById('prop-form-content');form?.scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('prop-input-community')?.focus({preventScroll:true});}
const conditionFields=[
 ['officeDistanceKm','最近就業聚落距離（公里，人工核對）','number',1],
 ['commuteMinutes','至就業核心通勤（分鐘，人工核對）','number',2],
 ['walkMinutes','捷運步行時間（分鐘；修改即以人工確認值計）','number',3],
 ['hotelApartment','是否酒店式公寓','boolean',6],['dividedSuites','是否現成隔套','boolean',6],['siteAreaPing','基地面積（坪）','number',6],
 ['dailyAmenities','500公尺內日常商店已營業','boolean',8],['schoolOperating','周邊學校已招生','boolean',8],['occupancyOverHalf','夜間點燈率超過一半','boolean',8],
 ['cashReserveWan','買房付清自備款後可用存款（萬元）','number',9],['monthlyIncomeWan','每月穩定收入（萬元）','number',9],['monthlyExpenseWan','每月生活支出（萬元，不含房貸）','number',9],['stressMortgageWan','壓力情境每月房貸（萬元；寬限期後、升息）','number',9]
];
function invalidatePropertyEvidence(p,key){
  const dependencies={askingPrice:[4,5],manualReferenceWan:[4],size:[4],parkingAreaPing:[4],parkingPriceWan:[4],hasParking:[4],households:[7],mrt:[3]};
  for(const id of dependencies[key] || [])if(p.knifeOverrides)delete p.knifeOverrides[id];
  if(key==='mrt'){p.walkMinutes=null;p.walkEvidence='unavailable';p.mrtDetails=null;}
  if(['community','district'].includes(key)){
    p.geo=null;p.mrtDetails=null;p.walkMinutes=null;p.walkEvidence='unavailable';p.mrt='地址已修改，請重新讀取來源或人工核對';
    p.households=null;p.communityInfo=null;p.officeDistanceKm=null;p.commuteMinutes=null;
    for(const [field] of conditionFields)if(!['cashReserveWan','monthlyIncomeWan','monthlyExpenseWan','stressMortgageWan'].includes(field))p[field]=null;
    p.productRiskVerified=null;p.matureArea=null;
  }
}
function renderConditionFields(p){
  const form=document.getElementById('prop-form-content');if(!form)return;
  let section=document.getElementById('property-conditions');
  if(!section){
    section=document.createElement('div');section.id='property-conditions';section.className='sm:col-span-2 lg:col-span-4 border-t pt-4';
    section.innerHTML=`<div class="flex flex-wrap gap-3 items-center"><h4 class="font-bold">自動判斷條件</h4><button id="refresh-property-source" type="button" class="text-sky-700 underline">更新此物件的591與地圖資料</button></div><p id="property-source-status" class="my-3 text-slate-600"></p><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${conditionFields.map(([key,label,type])=>`<label>${rh(label)}${type==='boolean'?`<select id="condition-${key}" class="w-full border rounded-lg p-2"><option value="">待確認</option><option value="true">是</option><option value="false">否</option></select>`:`<input id="condition-${key}" type="number" min="0" step="any" class="w-full border rounded-lg p-2">`}</label>`).join('')}</div><p class="mt-3 text-slate-600">自動判斷依已取得／填入的條件運算，並非現場認證。第三刀地圖時間為預估；第六刀依酒店式、隔套、基地100坪門檻；第八刀依商店、學校、點燈率；第九刀以先停薪6個月、後30個月恢復收入計算，兩階段存款皆須不為負。未知資料保留待確認。</p>`;
    form.appendChild(section);
    for(const [key,,type,knife] of conditionFields){
      document.getElementById(`condition-${key}`).addEventListener('change',event=>{
        const active=getActiveProperty();if(!active||active.isSaved)return;
        const value=event.target.value;
        active[key]=type==='boolean'?(value===''?null:value==='true'):RC.number(value);
        if(type==='number' && active[key]<0)active[key]=null;
        if(key==='walkMinutes'){active.walkEvidence=active.walkMinutes==null?'unavailable':'confirmed';active.mrtDetails=null;active.mrt=active.walkMinutes==null?'步行時間待確認':`人工確認步行 ${active.walkMinutes} 分鐘`;}
        if(knife===6)active.productRiskVerified=null;if(knife===8)active.matureArea=null;if(knife===9)active.cashFlowVerified=null;
        if(active.knifeOverrides)delete active.knifeOverrides[knife];
        saveUserProperties();renderEvaluationView();
      });
    }
    document.getElementById('refresh-property-source').addEventListener('click',refreshPropertySource);
  }
  for(const [key,,type] of conditionFields){
    const input=document.getElementById(`condition-${key}`);
    if(input){
      input.disabled=Boolean(p.isSaved);
      if(p.isSaved){input.classList.add('bg-slate-100','cursor-not-allowed','text-slate-600');input.classList.remove('bg-white');}
      else{input.classList.remove('bg-slate-100','cursor-not-allowed','text-slate-600');input.classList.add('bg-white');}
      if(document.activeElement!==input)input.value=p[key]==null?'':type==='boolean'?String(p[key]):p[key];
    }
  }
  rt('property-source-status',`戶數：${rf(p.households,'戶')}。${p.communityInfo?.message || '請確認來源或手動填入'}。捷運：${p.mrt || '尚未取得'}。${p.mrtDetails?.message || ''}`);
  const refBtn=document.getElementById('refresh-property-source');
  if(refBtn){
    refBtn.disabled=Boolean(p.isSaved)||!p.sourceUrl;
    if(p.isSaved)refBtn.classList.add('opacity-40','cursor-not-allowed');
    else refBtn.classList.remove('opacity-40','cursor-not-allowed');
  }
}
async function refreshPropertySource(){
  const p=getActiveProperty();if(!p?.sourceUrl||p.isSaved)return;
  const id=p.id,url=p.sourceUrl,identity=JSON.stringify([p.community,p.district]);
  const button=document.getElementById('refresh-property-source');if(button)button.disabled=true;
  rt('property-source-status','正在更新來源，完成後保留此物件與筆記…');
  try{
    const data=buildPropertyFromApiData(await fetchHouseDataFromEdge(url),url);
    const current=userProperties.find(item=>item.id===id);
    if(!current || current.sourceUrl!==url || JSON.stringify([current.community,current.district])!==identity)return;
    for(const key of ['askingPrice','totalAreaPing','size','parkingAreaPing','parkingPriceWan','hasParking','community','district','geo','mrt','mrtDetails','walkMinutes','walkEvidence','households','communityInfo','registration'])current[key]=data[key] ?? null;
    current.knifeOverrides={};current.dataWarning='已重新取得來源；人工財務與現場條件保留，請核對是否仍有效。';
    saveUserProperties();renderEvaluationView();showToast('此物件資料已更新');
  }catch(error){rt('property-source-status',`更新失敗：${error.message}。原紀錄保留。`);}
  finally{if(button)button.disabled=false;}
}
function reRenderEvidence(p,price) {
  const panel=document.getElementById('registration-evidence');if(!panel)return;
  const s=price.stats, opt=p.analysisOptions || {};
  const reasons={duplicate:'重複',invalidDate:'日期無效或未來',special:'特殊交易',firstFloor:'一樓',outsidePeriod:'期間外',estimatedParking:'車位估算未納入',missingValues:'資料缺漏'};
  const statusNames={complete:'完整取得',partial:'部分取得',unavailable:'未取得',blocked:'來源阻擋',timeout:'逾時',mismatch:'社區核對不符',unmatched:'未能對應社區'};
  panel.innerHTML=`<div class="space-y-3"><h4 class="font-bold text-slate-900">成交來源與計算依據</h4><p>${rh(statusNames[s.status]||'未取得')}｜來源總數 <b>${s.reportedCount ?? '未知'}</b>／已取 <b>${s.rawCount}</b>／去重後 <b>${s.uniqueCount}</b>／採用 <b>${s.usedCount}</b> 筆</p><p class="text-slate-600">擷取時間：${rh(p.registration?.fetchedAt || '尚未取得')}。範圍：成屋期成交；資料非成交當日即時更新。</p>${s.sourceUrl?`<a href="${rh(safeRegistrationUrl(s.sourceUrl))}" target="_blank" rel="noopener noreferrer" class="text-sky-700 underline">開啟原始實價登錄頁 ↗</a>`:''}${p.registration?.error?`<p class="text-amber-800">${rh(p.registration.error)}</p>`:''}${p.dataWarning?`<p class="text-amber-800">${rh(p.dataWarning)}</p>`:''}${p.legacySnapshot?`<details><summary>舊版原始紀錄（未查證，未參與計算）</summary><pre class="whitespace-pre-wrap text-xs">${rh(JSON.stringify(p.legacySnapshot,null,2))}</pre></details>`:''}
    <div class="flex flex-wrap gap-4 items-center"><label>統計期間 <select id="reg-period" class="border rounded-lg px-2 py-1"><option value="36" ${opt.months!==60?'selected':''}>近三年</option><option value="60" ${opt.months===60?'selected':''}>近五年</option></select></label><label><input id="reg-include-estimated" type="checkbox" ${opt.includeEstimatedParking?'checked':''}> 納入591估算車位分價（僅參考）</label><label><input id="reg-exclude-floor" type="checkbox" ${opt.excludeFirstFloor!==false?'checked':''}> 排除一樓</label></div>
    <p>期間：${rh(s.period)}。剔除：${Object.entries(s.excluded).map(([key,n])=>`${reasons[key]} ${n}`).join('／')}。</p><p>採用中車位估算 ${s.usedEstimatedCount} 筆。${s.sufficient?'樣本達5筆，仍需確認可比性。':'未滿5筆或資料不完整，不建立自動比較總價。'} 不做機械式去頭去尾。</p>
    <p>房屋淨單價中位數：<b>${rf(s.medianUnit,' 萬/坪')}</b>；面積加權均價：<b>${rf(s.weightedUnit,' 萬/坪')}</b>。來源價格與面積有四捨五入，重算可能有尾差。</p>
    <details><summary class="cursor-pointer font-semibold text-sky-800">檢視成交明細與採用原因（${s.inspectedRows.length}筆）</summary><div class="overflow-x-auto mt-3"><table class="w-full text-left text-xs min-w-[750px]"><thead><tr><th>年月／地址</th><th>樓層／格局</th><th>房屋價／扣車位坪數</th><th>車位價／坪數</th><th>淨單價重算</th><th>採用狀態</th><th>來源備註</th></tr></thead><tbody>${s.inspectedRows.map(row=>`<tr class="border-t border-slate-200"><td class="p-2">${rh(row.date)}<br>${rh(row.address)}</td><td>${rf(row.floor,'樓')}<br>${rh(row.layout)}</td><td>${rf(row.housePriceWan,'萬')}<br>${rf(row.houseAreaPing,'坪')}</td><td>${rf(row.parkingPriceWan,'萬')}${row.parkingEstimated?'（估算）':''}<br>${rf(row.parkingAreaPing,'坪')}</td><td>${rf(row.calculatedUnit,'萬/坪')}</td><td>${rh(row.exclusion?reasons[row.exclusion]:'採用')}</td><td>${rh(row.notes || '無')}</td></tr>`).join('')}</tbody></table></div></details></div>`;
  const update=()=>{p.analysisOptions={months:Number(document.getElementById('reg-period').value),includeEstimatedParking:document.getElementById('reg-include-estimated').checked,excludeFirstFloor:document.getElementById('reg-exclude-floor').checked};saveUserProperties();renderEvaluationView();};
  ['reg-period','reg-include-estimated','reg-exclude-floor'].forEach(id=>document.getElementById(id).addEventListener('change',update));
}
function safeRegistrationUrl(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='market.591.com.tw'?u.href:'#';}catch{return '#';}}
function renderEvaluationView() {
  const p=getActiveProperty();if(!p)return;const isSaved=p.isSaved===true;const e=evaluateProperty(p), price=e.pricing, s=price.stats;p.knives=e.passed;p.regPrice=price.reference;
  const sync=(id,value)=>{const el=document.getElementById(id);if(el&&document.activeElement!==el)el.value=value ?? '';};
  const tabRoot=document.getElementById('prop-tabs-container');
  if(tabRoot){
    tabRoot.innerHTML='';
    for(const item of userProperties){
      const b=document.createElement('button');b.type='button';
      b.className=`px-3 py-2 rounded-xl text-xs border shrink-0 flex items-center gap-1.5 ${item.id===p.id?'bg-sky-600 text-white font-bold':'bg-white text-slate-700'}`;
      b.innerHTML=`<span>${item.isSaved ? '🔒' : '📝'}</span><span>${rh(item.community || item.name)}</span>`;
      b.addEventListener('click',()=>{activePropertyId=item.id;renderEvaluationView();});
      tabRoot.appendChild(b);
    }
  }
  rt('prop-count-badge',userProperties.length);rt('prop-editing-title',p.community || p.name);
  const viewLabel=document.getElementById('prop-view-status-label');if(viewLabel)viewLabel.textContent=isSaved?'正在檢視：':'正在編輯：';
  const savedBadge=document.getElementById('prop-saved-badge');
  if(savedBadge){
    savedBadge.className=`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${isSaved?'bg-slate-100 text-slate-700 border-slate-300':'bg-amber-50 text-amber-800 border-amber-300'}`;
    savedBadge.textContent=isSaved?'🔒 已儲存（唯讀模式）':'📝 草稿中（尚未儲存）';
  }
  const statusHint=document.getElementById('prop-status-hint');
  if(statusHint){
    statusHint.textContent=isSaved?'（已儲存物件已鎖定，只能檢視不可編輯與刪除。若需修改請點擊「複製」。）':'（編輯中草稿，修改後即時重算。確認後請點擊「儲存物件」以鎖定存檔。）';
  }
  const saveBtn=document.getElementById('btn-save-prop-explicit');
  if(saveBtn){
    saveBtn.disabled=isSaved;
    saveBtn.innerHTML=isSaved?'<span>🔒</span> 已儲存（唯讀模式）':'<span>💾</span> 儲存物件';
    saveBtn.className=isSaved?'px-3 py-1.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs flex items-center gap-1 cursor-not-allowed border border-slate-300':'px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow transition cursor-pointer';
  }
  const delBtn=document.getElementById('btn-del-prop');
  if(delBtn){
    delBtn.disabled=isSaved;
    delBtn.title=isSaved?'已儲存物件已鎖定，不可刪除':'刪除目前草稿物件';
    if(isSaved)delBtn.classList.add('opacity-40','cursor-not-allowed');
    else delBtn.classList.remove('opacity-40','cursor-not-allowed');
  }
  const recalcBtn=document.getElementById('btn-recalc-knives');
  if(recalcBtn){
    recalcBtn.disabled=isSaved;
    recalcBtn.title=isSaved?'已儲存物件已鎖定，不可修改；若需調整請先「複製」':'根據目前填寫的地址、開價、捷運與戶數重新自動判定九把刀';
    if(isSaved)recalcBtn.classList.add('opacity-40','cursor-not-allowed');
    else recalcBtn.classList.remove('opacity-40','cursor-not-allowed');
  }

  const propInputIds=['prop-input-community','prop-input-name','prop-input-district','prop-input-mrt','prop-input-asking','prop-input-reg','prop-input-size','prop-input-households','prop-input-has-parking','prop-input-parking-size','prop-input-parking-price','prop-input-notes'];
  for(const id of propInputIds){
    const el=document.getElementById(id);
    if(el){
      el.disabled=isSaved;
      if(isSaved){el.classList.add('bg-slate-100','cursor-not-allowed','text-slate-600');el.classList.remove('bg-white');}
      else{el.classList.remove('bg-slate-100','cursor-not-allowed','text-slate-600');el.classList.add('bg-white');}
    }
  }

  for(const [id,key] of Object.entries({'prop-input-community':'community','prop-input-name':'name','prop-input-district':'district','prop-input-mrt':'mrt','prop-input-households':'households','prop-input-asking':'askingPrice','prop-input-reg':'manualReferenceWan','prop-input-notes':'notes','prop-input-parking-size':'parkingAreaPing','prop-input-parking-price':'parkingPriceWan'}))sync(id,p[key]);
  sync('prop-input-size',p.totalAreaPing==null?'':`${p.totalAreaPing}坪`);sync('prop-input-has-parking',p.hasParking==null?'':String(p.hasParking));
  rt('prop-score-num',e.score);rt('prop-knives-count',`通過 ${e.count}／不通過 ${e.failed.length}／待確認 ${e.unknown.length}`);rt('prop-verdict-desc',e.verdict);
  const badge=document.getElementById('prop-badge-tier');if(badge){badge.textContent=e.tier;badge.className=`px-3 py-1 rounded-full text-xs border ${e.tierClass}`;}
  const alert=document.getElementById('prop-redline-alert');if(alert){alert.classList.toggle('hidden',!e.redAlerts.length);alert.textContent=e.redAlerts.join(' ');}
  for(const [id,value] of Object.entries({'price-ceiling-val':price.reference,'price-asking-val':price.asking,'val-fake-1':price.fake1,'val-fake-2':price.fake2,'val-fake-3':price.fake3,'val-true-bottom':price.trueBottom,'price-net-seller':price.netSeller,'reg-card-asking-display':price.asking,'reg-card-ceiling-display':price.reference}))rt(id,rf(value,' 萬'));
  rt('reg-card-avg-unit',rf(s.medianUnit,' 萬/坪'));rt('reg-card-unit-range',s.usedCount?`採用成交區間 ${rf(s.minUnit)}～${rf(s.maxUnit)} 萬/坪；本戶開價淨單價 ${rf(price.askingUnit,'萬/坪')}`:'未取得可採用的成交樣本');
  rt('reg-card-parking-detail',p.hasParking===false?'已確認無車位':`車位 ${rf(p.parkingPriceWan,'萬')}／${rf(p.parkingAreaPing,'坪')}`);
  rt('reg-card-net-size',`權狀 ${rf(p.totalAreaPing,'坪')} → 扣車位 ${rf(price.netArea,'坪')}（仍含公設）`);
  rt('reg-card-premium-pct',price.premiumPct==null?'未建立有效比較基準，不判定溢價':`相對比較基準 ${price.premiumPct>=0?'+':''}${rf(price.premiumPct,'%')}（${price.source==='manual'?'手動值':'成交樣本試算'}）`);
  rt('reg-card-formula-box',`每筆淨單價＝房屋價÷扣車位坪數；比較總價＝中位數×本戶扣車位坪數＋本戶車位價。至少5筆且資料完整才可自動試算。${price.reference?`目前採用 ${price.source==='manual'?'手動比較基準，未經系統查證':'成交樣本'} ${rf(price.reference,'萬')}；四階比例只是策略試算。`:'目前條件不足；不以開價反推行情、不補入假車位分價。'}`);
  reRenderEvidence(p,price);
  renderConditionFields(p);
  const query=encodeURIComponent([p.district,p.community].filter(Boolean).join(' '));
  const mapsLink=document.getElementById('link-google-maps');if(mapsLink)mapsLink.href=`https://www.google.com/maps/search/?api=1&query=${query}`;
  const transitLink=document.getElementById('link-google-transit');if(transitLink)transitLink.href=p.mrtDetails?.stationGeo&&p.geo?`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(p.geo.lat+','+p.geo.lng)}&destination=${encodeURIComponent(p.mrtDetails.stationGeo.lat+','+p.mrtDetails.stationGeo.lng)}&travelmode=walking`:`https://www.google.com/maps/search/?api=1&query=${query}`;
  rt('transit-link-label',p.mrtDetails?.station?`${p.mrtDetails.station}・預估步行 ${p.mrtDetails.walkMinutes} 分鐘 ↗`:'開啟地圖，人工確認步行路線');
  const lejuLink=document.getElementById('link-leju-search');if(lejuLink){lejuLink.href=safeRegistrationUrl(s.sourceUrl);lejuLink.textContent=s.sourceUrl?'原始社區實價登錄 ↗':'實登尚未取得';}
  const container=document.getElementById('knives-container');
  if(container){
    container.innerHTML='';
    for(const item of nineKnivesData){
      const state=e.states[item.id];const card=document.createElement('button');card.type='button';
      card.className=`text-left p-4 rounded-2xl border transition ${state==='pass'?'bg-emerald-50 border-emerald-300':state==='fail'?'bg-rose-50 border-rose-300':'bg-amber-50/40 border-amber-200'} ${isSaved?'cursor-default':'hover:shadow-md cursor-pointer'}`;
      card.innerHTML=`<div class="text-xs font-bold ${state==='pass'?'text-emerald-800':state==='fail'?'text-rose-800':'text-amber-800'}">${state==='pass'?'✓ 已確認通過':state==='fail'?'✗ 已確認不通過':'? 待確認'}${p.knifeOverrides?.[item.id]?'（手動標記）':''}</div><h3 class="font-bold mt-2">${rh(item.title)}</h3><p class="text-xs text-slate-600 mt-2">${rh(item.rule)}</p><p class="text-xs mt-3">${rh(item.checkTip)}</p><p class="text-xs text-slate-500 mt-2">${isSaved?'🔒 已儲存鎖定（如需調整請先複製為新案）':'點選依序標記：通過 → 不通過 → 待確認'}</p>`;
      card.addEventListener('click',()=>{
        if(p.isSaved){
          if(typeof showToast==='function')showToast('🔒 此物件已儲存鎖定（唯讀模式），無法修改！如需調整請先點擊上方「複製」。');
          return;
        }
        p.knifeOverrides ||= {};
        p.knifeOverrides[item.id]=state==='unknown'?'pass':state==='pass'?'fail':'unknown';
        saveUserProperties();renderEvaluationView();
      });
      container.appendChild(card);
    }
  }
  rt('weapons-count-badge',`${e.failed.length} 項已確認短板／${e.unknown.length} 項待查核`);
  const weaponsList=document.getElementById('bargaining-weapons-list');
  if(weaponsList)weaponsList.innerHTML=e.failed.length?e.failed.map(id=>`<p class="p-3 border rounded-xl">${rh(nineKnivesData.find(k=>k.id===id)?.title)}：請保留核對證據，再討論價格與改善成本。</p>`).join(''):'<p class="text-slate-600">目前沒有已確認的不通過項目；待確認項目不當作缺陷或議價事實。</p>';
  renderActionablePlaybook(p,e);updateRadarChart(p,e);
  const table=document.getElementById('comparison-table-body');
  if(table){
    table.innerHTML='';
    for(const item of userProperties){
      const ev=evaluateProperty(item),pr=ev.pricing;const row=document.createElement('tr');row.className='border-t border-slate-200';
      row.innerHTML=`<td class="p-3 font-semibold text-slate-900">${rh(item.community||item.name)} ${item.isSaved ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-300">🔒 唯讀</span>' : '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-300">📝 草稿</span>'}<br><span class="text-xs text-slate-500 font-normal">${rh(item.district)}</span></td><td>${rf(pr.asking,'萬')}<br><span class="text-xs text-slate-500">基準：${rf(pr.reference,'萬')}（${pr.source==='manual'?'手動':pr.source==='unavailable'?'未建立':'成交試算'}）</span></td><td>60%：${rf(pr.fake1,'萬')}<br>80%：${rf(pr.trueBottom,'萬')}</td><td>${ev.count}/9</td><td>${ev.score}</td><td>${rh(ev.tier)}</td><td>${ev.failed.length}項未過／${ev.unknown.length}項待確認</td><td><button type="button" class="text-sky-700 underline font-semibold cursor-pointer">檢視</button></td>`;
      row.querySelector('button')?.addEventListener('click',()=>editPropertyById(item.id));
      table.appendChild(row);
    }
  }
  updatePriceCalculator();
}
function renderActionablePlaybook(p,e) {
  const price=e.pricing;const messages=[['價格比較',price.reference?`比較基準 ${rf(price.reference,'萬')}，來源為${price.source==='manual'?'手動輸入，未經查證':'成交樣本試算'}。60/68/75/80% 僅為比例情境，不代表屋主底價。`:'成交資料不完整、有效樣本不足5筆或本戶車位分價未知，尚不能建立比較總價與出價情境。'],['條件查核',`已確認 ${9-e.unknown.length} 項，另有 ${e.unknown.length} 項待確認。請依逐項檢核說明取得證據，不把未知視為已通過或物件缺陷。`],['比較口徑','先核對成交年月、樓層、格局、面積、車位拆價及特殊交易註記。頁面列出的數字可以從明細重算。'],['財務確認','三年現金流需要收入、支出、貸款及壓力測試資料；不會因總價較低自動通過。']];
  document.getElementById('actionable-playbook-grid').innerHTML=messages.map(([title,text])=>`<div class="p-4 bg-white border rounded-xl"><h4 class="font-bold text-sky-800">${title}</h4><p class="mt-2 text-slate-600">${rh(text)}</p></div>`).join('');
}
function updateRadarChart(p,e) {
  if(typeof Chart==='undefined')return;const canvas=document.getElementById('propRadarChart');if(!canvas)return;
  const data=[[1,8],[2,3],[6,7],[4,5],[9]].map(ids=>{const known=ids.filter(id=>e.states[id]!=='unknown');return known.length?known.filter(id=>e.states[id]==='pass').length/known.length*100:null;});
  if(radarChartInstance){radarChartInstance.data.datasets[0].data=data;radarChartInstance.update();return;}
  radarChartInstance=new Chart(canvas.getContext('2d'),{type:'radar',data:{labels:['商圈','交通','產品','價格','現金流'],datasets:[{label:'已確認項目通過比例（未知留白）',data,borderColor:'#0284c7',backgroundColor:'#0284c720'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{r:{min:0,max:100,ticks:{display:false}}}}});
}
function copyLineSummary(){const p=getActiveProperty();if(p)fallbackCopyText(RC.report(p),'已複製來源、筆數與計算依據');}
function updatePriceCalculator() {
  const follow=document.getElementById('calc-follow-active');const asking=document.getElementById('input-asking-price'),reference=document.getElementById('input-reg-price');if(!asking||!reference)return;
  let price;
  if(follow?.checked){price=RC.derivePricing(getActiveProperty()||{});asking.value=price.asking ?? '';reference.value=price.reference ?? '';asking.disabled=true;reference.disabled=true;rt('calc-reference-status',`連動目前物件：${price.reference?(price.source==='manual'?'手動比較基準，未經查證':'成交樣本試算'):'尚未建立有效比較基準，四階出價暫停'}。`);}
  else {asking.disabled=false;reference.disabled=false;price=RC.derivePricing({modelVersion:2,askingPrice:asking.value,manualReferenceWan:reference.value});rt('calc-reference-status','獨立手動試算：輸入值未經系統查證，不代表抓取的實價登錄。');}
  for(const [id,value] of Object.entries({'calc-true-bottom':price.trueBottom,'calc-fake-1':price.fake1,'calc-fake-2':price.fake2,'calc-fake-3':price.fake3,'calc-net-seller':price.netSeller}))rt(id,rf(value,' 萬'));
}
