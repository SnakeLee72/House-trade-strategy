const fs=require('node:fs');
const file='「談判大叔」陳侯勳｜買房投資與談判理論全集.html';
let html=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const cut=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);if(a<0||b<0)throw Error('Missing boundary '+start);html=html.slice(0,a)+html.slice(b);};
cut('    // Regional Real Estate Benchmark Database','    const STORAGE_KEY');
cut('    function initUserProperties()', '    function saveUserProperties()');
cut('    // Evaluation & Scoring Engine','    // Toast helper');
cut('    function copyLineSummary()', '    // 2. Data for Tactics');
cut('    function updatePriceCalculator()', '    function updateRentCalculator()');
const addStart=html.indexOf("      document.getElementById('btn-add-prop').addEventListener");
const addEnd=html.indexOf("      document.getElementById('btn-clone-prop').addEventListener",addStart);
if(addStart<0||addEnd<0)throw Error('Missing property buttons');
html=html.slice(0,addStart)+`      document.getElementById('btn-add-prop').addEventListener('click', () => {
        const p=RegistrationCore.emptyProperty('候選物件 '+(userProperties.length+1));
        userProperties.unshift(p);activePropertyId=p.id;saveUserProperties();renderEvaluationView();
      });

`+html.slice(addEnd);
cut("      document.getElementById('btn-sample-prop').addEventListener", "      document.getElementById('btn-copy-line').addEventListener");
html=html.replace(/\s*<button\b[^>]*id="btn-sample-prop"[\s\S]*?<\/button>/,'');
html=html.replace("bindPropInput('prop-input-reg', 'regPrice', true);","bindPropInput('prop-input-reg', 'manualReferenceWan', true);");
html=html.replace("            active[propKey] = e.target.value;",`            active[propKey] = ['askingPrice','households','manualReferenceWan','parkingAreaPing','parkingPriceWan'].includes(propKey) ? RegistrationCore.number(e.target.value) : e.target.value;
            if(propKey==='size')active.totalAreaPing=RegistrationCore.positive(e.target.value.match(/([\\d.]+)/)?.[1]);
            if(['community','district'].includes(propKey)){active.registration=null;active.manualReferenceWan=null;active.knifeOverrides={};active.dataWarning='物件身分欄位已修改，請重新讀取網址以核對社區。';}`);
html=html.replace("      bindPropInput('prop-input-notes', 'notes', true);",`      bindPropInput('prop-input-notes', 'notes', true);
      bindPropInput('prop-input-parking-size','parkingAreaPing',true);
      bindPropInput('prop-input-parking-price','parkingPriceWan',true);
      document.getElementById('prop-input-has-parking').addEventListener('change',event=>{const p=getActiveProperty();p.hasParking=event.target.value===''?null:event.target.value==='true';if(p.hasParking===false){p.parkingAreaPing=0;p.parkingPriceWan=0;}else{p.parkingAreaPing=null;p.parkingPriceWan=null;}saveUserProperties();renderEvaluationView();});
      document.getElementById('calc-follow-active').addEventListener('change',updatePriceCalculator);`);
html=html.replace('        cur.knives = autoEvaluateKnives(cur);','        cur.knifeOverrides = {};\n        cur.knives = autoEvaluateKnives(cur);');
html=html.replace('  <link rel="stylesheet" href="./chen-reading.css">','  <link rel="stylesheet" href="./chen-reading.css">\n  <script src="./registration-core.js"></script>');
html=html.replace('</body>','  <script src="./registration-ui.js"></script>\n</body>');
const fields=`            <div><label for="prop-input-has-parking" class="block font-semibold text-slate-700 mb-1">車位狀態（未取得不猜測）</label><select id="prop-input-has-parking" class="w-full border rounded-xl px-3 py-2 bg-white"><option value="">待確認</option><option value="true">含車位</option><option value="false">已確認無車位</option></select></div>
            <div><label for="prop-input-parking-size" class="block font-semibold text-slate-700 mb-1">車位面積（坪）</label><input id="prop-input-parking-size" type="number" min="0" step="0.001" class="w-full border rounded-xl px-3 py-2 bg-white"></div>
            <div><label for="prop-input-parking-price" class="block font-semibold text-slate-700 mb-1">本戶車位分價（萬元，未取得請留白）</label><input id="prop-input-parking-price" type="number" min="0" step="0.1" class="w-full border rounded-xl px-3 py-2 bg-white"></div>
`;
html=html.replace('            <div class="sm:col-span-2 lg:col-span-4">\n              <label for="prop-input-notes"',fields+'            <div class="sm:col-span-2 lg:col-span-4">\n              <label for="prop-input-notes"');
html=html.replace('        <!-- 9 Knives Grid -->','        <div id="registration-evidence" class="my-6 p-4 sm:p-6 rounded-2xl border border-slate-200 bg-white text-sm leading-relaxed"></div>\n\n        <!-- 9 Knives Grid -->');
html=html.replace('6. 實價登錄天花板（萬元）','6. 手動比較基準（萬元，選填，未經系統查證）');
html=html.replace('7. 權狀建坪 / 車位說明','7. 權狀總坪數（含車位）');
html=html.replace('9. 屋況手記 / 樓層屋齡與特殊條件（輸入「機械車位、小基地、隔套、酒店式」將自動觸發地雷偵測）','9. 屋況手記／待核對事項');
html=html.replace('九把刀綜合安全指數','九把刀已確認通過比例');
html=html.replace('（點擊任一卡片可手動切換 通過/未通過，即時更新評分與砍價話術）','（逐項人工核對；點選切換通過／不通過／待確認）');
html=html.replace('= 存在短板與砍價破口','= 已確認未通過 ｜ 問號 = 資料待確認');
html=html.replace('依數值自動重判九把刀','清除手動標記並重判');
html=html.replace('剔除親友特殊交易與一樓店面極端值，嚴格拆算車位價格與坪數後還原「房屋真實淨單價」。','僅使用實際取得的成交列；揭露期間、剔除原因、估算車位與樣本數。不以開價反推實登。');
html=html.replace('（修改下方任一欄位，將自動重新執行九把刀判定與出價建議）','（修改後同步重算；缺少必要資料時，價格與檢核顯示待確認）');
html=html.replace('點擊各列可快速切換比對','檢視各物件來源、比較基準與待確認項目');
html=html.replace(/實登天花板/g,'成交比較基準').replace(/實價登錄天花板/g,'成交比較基準');
html=html.replace('開價 ÷ 1.04','開價 × 0.96').replace('÷1.04 扣除 4% 仲介費','×0.96 扣除假設4%仲介費');
html=html.replace(/(<h2 class="text-lg font-bold text-slate-900">🧮 實戰工具一[^<]*<\/h2>)/,`$1\n          <label class="block text-sm mt-3"><input id="calc-follow-active" type="checkbox" checked> 連動目前物件的有效比較基準</label><p id="calc-reference-status" class="text-sm text-amber-800 my-2"></p>`);
html=html.replace('value="2500" min="100"','value="" min="100"').replace('value="2200" min="100"','value="" min="100"');
fs.writeFileSync(file,html);
console.log('Removed legacy estimation pipeline; connected shared registration core and UI.');
