const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const wu='吳淡如_房商必修課.html',second='second_house.html';
const expected=fs.existsSync('tests/fixtures/ab-valid-outputs.json')?JSON.parse(fs.readFileSync('tests/fixtures/ab-valid-outputs.json','utf8')):null;
function setup(file,before=false){
 const html=fs.readFileSync((before?'.wrangler/ab-before/':'')+file,'utf8'),nodes={};
 for(const m of html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const attrs=m[2],id=m[3];nodes[id]={value:attrs.match(/\bvalue="([^"]*)"/)?.[1]||'',textContent:'',innerHTML:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},getAttribute(){return null},setCustomValidity(){},after(){},getContext(){return null},querySelectorAll(){return []}};
 }
 if(nodes.calcYears)nodes.calcYears.value='40';if(nodes['sel-h2-loan-term'])nodes['sel-h2-loan-term'].value='30';if(nodes['sel-h2-grace-years'])nodes['sel-h2-grace-years'].value='3';
 const doc={getElementById:id=>nodes[id],querySelectorAll:()=>[],addEventListener(){},createElement:()=>({setAttribute(){},hidden:false,textContent:''}),body:{appendChild(){},removeChild(){}}};
 class Chart{static defaults={font:{}};static register(){}constructor(ctx,config){this.data=config.data;}update(){}}
 const c={document:doc,Chart,console,window:{addEventListener(){}},navigator:{},setTimeout(){},requestAnimationFrame(){},IntersectionObserver:class{observe(){}},localStorage:{getItem(){return null}}};vm.createContext(c);
 vm.runInContext(fs.readFileSync('site-ui.js','utf8'),c);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())vm.runInContext(m[1],c);
 return {nodes,c,run:name=>vm.runInContext(name+'()',c)};
}
test('A1/A2 empty, zero and negative Wu prices expose no diagnosis',()=>{
 const s=setup(wu);for(const value of ['','0','-100']){s.nodes.calcTargetPrice.value=value;s.run('updateMortgageCalculator');for(const id of ['resLoanAmount','resInterestOnly','resMonthlyTotal'])assert.equal(s.nodes[id].textContent,'待確認');assert.equal(s.nodes.resAdviceBox.textContent,s.c.SiteUI.invalidMessage);}
});
test('A3 rate read/write rounds 2 decimals; money preserves entered precision',()=>{const s=setup(wu);s.nodes.calcRate.value='2.200000047683716';assert.equal(s.c.SiteUI.readRate(s.nodes.calcRate),2.2);assert.equal(s.nodes.calcRate.value,'2.2');s.nodes.calcDownpayment.value='450.125';assert.equal(s.c.SiteUI.readNumber(s.nodes.calcDownpayment),450.125);});
test('valid Wu formula outputs match the pre-change implementation',()=>{const b=setup(wu);b.run('updateMortgageCalculator');for(const [id,value] of Object.entries(expected?.wu || {}))assert.equal(b.nodes[id].textContent,value);});
test('A4 all Chen video URLs use HTTPS',()=>{const html=fs.readFileSync('「談判大叔」陳侯勳｜買房投資與談判理論全集.html','utf8');assert.doesNotMatch(html,/http:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/);});
test('A5 percentage badge caps display without changing premium calculation',()=>{const html=fs.readFileSync('index.html','utf8');assert.match(html,/Number\(premium\)>999\?'>999%'/);assert.match(html,/\(\(asking - reg\) \/ reg\) \* 100/);});
test('A6/A7/A8 synchronization and principal format are explicit',()=>{const html=fs.readFileSync(second,'utf8');assert.match(html,/id="slider-max-mark"/);assert.match(html,/lastUpstreamAmounts!==key/);assert.match(html,/id="inp-loan-calc-amt"[^>]*step="1"/);assert.match(html,/setCustomValidity\(''\)/);assert.doesNotMatch(html,/第一屋有效淨租金剛好完全覆蓋/);});
test('second-house valid default outputs match original formulas across modules',()=>{
 const b=setup(second);b.run('updateSimulation');assert.ok(expected);
 const text=value=>String(value).replace(/(?![©®™])[\p{Extended_Pictographic}](?:\uFE0F|\u200D[\p{Extended_Pictographic}]\uFE0F?)*/gu,'').trim();
 for(const [id,value] of Object.entries(expected.second))assert.equal(text(b.nodes[id].textContent),text(value),id);
});
test('all pages expose B6 metadata and shared B1-B9 assets/footer',()=>{for(const f of ['index.html',wu,second,'「談判大叔」陳侯勳｜買房投資與談判理論全集.html']){const h=fs.readFileSync(f,'utf8');for(const token of ['site-ui.css','site-ui.js','og:title','og:description','og:type','og:image','site-footer-note','cyber-grid'])assert.ok(h.includes(token),f+': '+token);}});
module.exports={setup};
test('second-house 科目四 30 年本息 mode and grace-excluded amortization drive the monthly conclusion',()=>{
 const b=setup(second);b.nodes['sel-h1-repay-mode'].value='pi';b.run('updateSimulation');
 assert.equal(b.nodes['out-h1-interest'].textContent,'-62,804 元/月');
 assert.equal(b.nodes['out-net-cashflow'].textContent,'-28,604 元/月');
 assert.equal(b.nodes['out-concl-current-pay'].textContent,'77,737 元/月');
 assert.match(b.nodes['out-concl-after-grace'].textContent,/第 4 年起二屋轉本息：每月自付 130,364 元（空租時 164,564 元）/);
 assert.match(b.nodes['out-h1-repay-note'].textContent,/30 年本息：每月 62,804 元/);
 const s=setup(second);s.nodes['sel-h2-grace-years'].value='0';s.run('updateSimulation');
 assert.equal(s.nodes['out-sc2-monthly'].innerHTML.replace(/<[^>]+>/g,'').trim(),'101,760 元/月');
 assert.equal(s.nodes['out-concl-current-pay'].textContent,'100,227 元/月');
 assert.match(s.nodes['monthly-combo-body'].innerHTML,/二屋只繳息（不適用）/);
});
test('second-house invalid-state reset never wipes nested output elements',()=>{
 // validateSecondHouse 失敗時會把 out-/disp-/tag-/slider- 元素的 textContent 全改為「待確認」，若其內含其他 id 元素會被刪除，恢復有效輸入時即找不到節點
 const h=fs.readFileSync(second,'utf8'),nested=[];const re=/<(\w+)\b[^>]*\bid="((?:out-|disp-|tag-|slider-)[^"]*)"[^>]*>/g;let m;
 while((m=re.exec(h))){const tag=m[1],tok=new RegExp('<'+tag+'\b|</'+tag+'>','g');tok.lastIndex=re.lastIndex;let depth=1,x;while(depth&&(x=tok.exec(h)))depth+=x[0][1]==='/'?-1:1;if(/\bid="/.test(h.slice(re.lastIndex,x.index)))nested.push(m[2]);}
 assert.deepEqual(nested,[]);
});
test('second-house LTV intent survives typing through small transient prices',()=>{
 // 3350 → 3500 逐鍵輸入會經過「3」：借款 round(3×0.8)=2 若回寫成數會變 66.7%，安全推薦總價因而掉到約 2,096 萬
 const s=setup(second);s.run('updateSimulation');assert.equal(s.nodes['out-safe-h2-price'].textContent,'3,488 萬元');
 for(const v of ['335','33','3','3','35','350','3500']){s.nodes['inp-h2-price'].value=v;s.nodes['inp-loan-calc-amt'].value=String(Math.round(Number(v)*vm.runInContext('currentLtvFactor',s.c)));s.run('updateSimulation');}
 assert.equal(s.nodes['inp-loan-calc-amt'].value,'2800');
 assert.equal(s.nodes['out-safe-h2-price'].textContent,'3,488 萬元');
 assert.equal(s.nodes['disp-current-ltv-pct'].textContent,'80.0%');
 s.nodes['inp-loan-calc-amt'].value='2450';s.run('syncLtvFactorFromLoan');s.run('updateSimulation');
 assert.equal(s.nodes['disp-m1-ltv'].textContent,'7');assert.equal(s.nodes['disp-m1-down'].textContent,'3');
});
