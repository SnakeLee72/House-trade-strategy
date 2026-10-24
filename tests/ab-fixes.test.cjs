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
