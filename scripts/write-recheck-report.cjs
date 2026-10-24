const fs=require('node:fs');
const dir='docs/verification/';const read=f=>JSON.parse(fs.readFileSync(dir+f,'utf8'));
const before=read('recheck-source-before.json').pages,after=read('recheck-source-after.json').pages,responsive=read('recheck-responsive.json');
const names=['首頁','吳淡如','陳侯勳','第二屋'];
const sourceRows=after.map((p,i)=>`| ${names[i]} | ${before[i].textXs} → ${p.textXs} | ${before[i].slate500} → ${p.slate500} | ${before[i].fontBlack} → ${p.fontBlack} |`).join('\n');
const radii=[...new Set([...Object.keys(before[0].rounded),...Object.keys(after[0].rounded)])].map(k=>`| ${k} | ${before[0].rounded[k]||0} | ${after[0].rounded[k]||0} |`).join('\n');
const emoji=Object.keys(before[0].emoji).map(k=>`| ${k} | ${before[0].emoji[k]} | ${after[0].emoji[k]} |`).join('\n');
const rows=responsive.map(r=>{const tables=[...r.tables,...(r.readingTables||[])];const columns=new Set(r.fields[0].map(e=>Math.round(e.left))).size;return `| ${names[['index','wu','chen','second'].indexOf(r.page)]} | ${r.size} | ${r.client} / ${r.scroll} | ${tables.map(t=>t.client+'/'+t.scroll+'px').join('、')}（overflow-x:auto） | ${columns}欄 | ${r.minTouchWidth.toFixed(1)} × ${r.minTouchHeight.toFixed(1)}px | ${r.smallTouches.length===0&&r.client===r.scroll?'通過':'有問題'} |`;}).join('\n');
const txt=`# A3／B2／B3／B4／B5／B9 原始碼與實測驗收（2026-10-21）

依 token.md 先擷取修改前快照，再改原始碼。此輪不以 CSS 覆寫代替原始類別修正。金融公式與預設利率不變；所有有效數字輸出仍比對上一輪的修改前快照。

## A3：文字利率＋整數基點

修改：四頁共用 \`site-ui.js\` 的 readRate／commitRate／writeRateBasisPoints；吳淡如 HTML 的 calcRate；second_house.html 的 inp-loan-rate、inp-h2-mortgage-rate。三個利率控制項由 type=number 改成 type=text、inputmode=decimal，避免原生數字 spinbutton 的 accessible 浮點呈現。

| 欄位／測試輸入 | 修改前 DOM | 修改前 accessible | 修改後 DOM | 修改後 accessible | 保存資料 |
|---|---|---|---|---|---|
| 吳淡如 calcRate，輸入2.2 | 2.2 | 2.200000047683716 | 2.2 | 2.2 | rateBps="220"、rateCanonical="2.20" |
| 第二屋 inp-loan-rate，輸入2.45 | 2.45 | 2.450000047683716 | 2.45 | 2.45 | rateBps="245"、rateCanonical="2.45" |

驗證方式：Chrome 真實 input／blur 操作，程式讀取 element.value、dataset，並擷取原生 AX tree。重新輸入後同值；吳頁更改月收入觸發重算仍為2.2；第二屋操作本金 slider 到1599後利率仍為2.45／245基點。原頁沒有利率 range：吳頁5個range是五力評分，第二屋的range-t4-loan是整數本金（step=1）。共用程式也提供以整數基點處理 data-rate-for slider input／change 的統一路徑。

所有利率讀寫經 Number(value).toFixed(2) 建立十進位字串，計算邊界才轉 Number。畫面去除尾端0以符合指定的2.2／2.45，保存字串仍是2.20／2.45。未使用 Float32Array 或 Math.fround；空值、非數字、未完成的小數輸入不套預設值。吳頁原預設2.25不變。

證據：[修改前](recheck-rate-before.json)、[修改後](recheck-rate-after.json)；單元測試 tests/rate-input.test.cjs 含5項，驗證基點、字串、重新鍵入、無效值與欄位型態。

## B2／B3：真正修改來源 token

修改四頁 HTML 與 registration-ui.js 的動態模板；包含 hover:text-slate-500。計數是 UTF-8 來源原始出現次數，包含 responsive variants 與 inline JS，等同文字搜尋，而非計算後 CSS。

| 頁面 | text-xs 前→後 | text-slate-500 前→後 | font-black 前→後 |
|---|---:|---:|---:|
${sourceRows}

保留的text-xs均為span.rounded-full膠囊標籤：首頁3個專區標籤，吳頁3個馬／雞／豬分類，陳頁4個工作台／儲存／評級／議價項目標籤，第二屋6個分類／版本標籤。來源測試逐筆驗證，沒有一般內文例外。動態registration-ui.js的text-slate-500另由7→0。吳／陳頁沒有保留任何slate-500。

手機實測四頁可見p／li／td小於14px均為0。修改前後原始數據：[before](recheck-source-before.json)、[after](recheck-source-after.json)。重跑：node scripts/source-ui-audit.cjs。

## B4：圓角與字重

修改四頁HTML以及動態模板。卡片rounded-2xl、按鈕／輸入rounded-xl、徽章rounded-full；圓形狀態點也保留rounded-full，沒有md／lg／3xl、裸rounded或方向性圓角例外。

首頁各類別原始出現次數：

| 類別 | 前 | 後 |
|---|---:|---:|
${radii}

首頁font-black 34→12，12處均經測試核對：主h1一處、帶font-mono-num的關鍵數字11處。一般標題與操作文字改為font-bold。其他三頁數據見上表；來源測試禁止未核准圓角token及不合用途的首頁font-black。

## B5：選甲，Lucide inline SVG

修改四頁靜態HTML、各頁JS文字與registration-ui.js模板，並將site-ui.js的動態圖示路徑統一為Lucide。靜態功能圖示直接嵌入SVG，非僅在DOM執行後遮蔽emoji。圖示來源為Lucide官方GitHub，保留ISC／MIT授權於icons/lucide-license.txt，亦加入發布白名單；SVG使用aria-hidden，不影響按鈕文字。

首頁指定emoji來源次數：

| 圖示 | 前 | 後 |
|---|---:|---:|
${emoji}

首頁全部Extended_Pictographic（排除©／®／™）80→0；inline SVG 0→70。四頁的對應總數分別為80／111／93／123→全部0；inline SVG分別為70／90／84／96。完整grep計數見source JSON。官方授權：https://lucide.dev/license 。

## B9：八組 DOM 量測

Chrome viewport模擬，非實體手機。表格數值為容器clientWidth／scrollWidth：後者較大時能橫向捲動，內容能容納時仍保留auto容器。文件client／scroll相等代表沒有整頁橫向溢出。觸控範圍包含可見button與具有按鈕樣式的a，列出各組實測最小值。

| 頁面 | 尺寸 | 文件client／scroll | 表格client／scroll | 主試算欄位 | 最小觸控寬×高 | 結果 |
|---|---|---|---|---|---|---|
${rows}

吳頁先檢查文章表格，再切換診斷器量測欄位；陳頁在隔離的本機測試origin新增候選物件後檢查編輯欄位。八組小於44px的按鈕數均為0。原始數據含每個欄位座標、尺寸與表格overflow：[recheck-responsive.json](recheck-responsive.json)。

## 檢查與發布

- node --test tests/*.cjs tests/*.mjs：66／66通過。
- 四頁inline JavaScript編譯、唯一ID及git diff --check通過。
- 使用scripts/build-static.cjs白名單發布，不公開測試工具或快照。
- 正式版本、雜湊與正式站利率複驗於發布後追加。
`;
fs.writeFileSync(dir+'2026-10-21-recheck.md',txt);console.log('Wrote six-item report with measured before/after tables.');
