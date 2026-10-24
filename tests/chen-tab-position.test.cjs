const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync('「談判大叔」陳侯勳｜買房投資與談判理論全集.html','utf8');
const start=html.indexOf('function switchTab(target)');
const code=html.slice(start,html.indexOf('\n      tabBtns.forEach(btn =>',start));
function context(scrollY,tabHeight){
  const classes={add(){},remove(){}};
  const panels=['one','two'].map(id=>({id:'tab-'+id,classList:classes,getBoundingClientRect(){return {top:800-c.scrollY};}}));
  let calls=[];
  const c={scrollY,tabBtns:['one','two'].map(id=>({getAttribute(){return id;},classList:classes,scrollIntoView(){throw Error('Tab buttons must not scroll the page');}})),tabPanels:panels,mobileTabSelect:{value:'one'},document:{getElementById(id){return panels.find(p=>p.id===id);},querySelector(selector){return {getBoundingClientRect(){return {height:selector==='.site-topbar'?60:tabHeight};}};}},window:{get scrollY(){return c.scrollY;},scrollTo(options){calls.push(options);}}};
  vm.createContext(c);vm.runInContext(code,c);return {c,calls};
}
for(const [name,height,expected]of [['desktop',49,683],['mobile',60,672]])test(`${name}: every scroll depth lands beneath both sticky rows plus 8px`,()=>{
  for(const y of [0,2400,9000]){const {c,calls}=context(y,height);c.switchTab('two');assert.equal(calls.length,1);assert.equal(calls[0].top,expected);assert.equal(calls[0].behavior,'instant');assert.equal(c.mobileTabSelect.value,'two');}
});
test('unknown panel cannot hide content or initiate a scroll',()=>{const {c,calls}=context(9000,49);c.switchTab('missing');assert.equal(calls.length,0);assert.equal(c.mobileTabSelect.value,'one');});
