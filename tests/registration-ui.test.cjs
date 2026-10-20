const { test }=require('node:test'); const assert=require('node:assert/strict'); const vm=require('node:vm'); const fs=require('node:fs');
const core=require('../registration-core.js'); const ui=fs.readFileSync('registration-ui.js','utf8');
function setup() {
 const nodes={};let copied='';
 for(const id of ['input-asking-price','input-reg-price','calc-follow-active','calc-reference-status','calc-true-bottom','calc-fake-1','calc-fake-2','calc-fake-3','calc-net-seller'])nodes[id]={value:'',checked:true,textContent:'',disabled:false};
 const ctx={RegistrationCore:core,console,document:{getElementById:id=>nodes[id]},window:{},getActiveProperty:()=>ctx.active, fallbackCopyText:text=>{copied=text}};
 vm.createContext(ctx);vm.runInContext(ui,ctx);
 return{ctx,nodes,copied:()=>copied};
}
test('API property with no qualifying reference cannot manufacture a regPrice',()=>{
 const {ctx}=setup();const p=ctx.buildPropertyFromApiData({askingPrice:5996,size:80.91,parkingAreaPing:12.217,hasParking:true,community:'東煒泰和',registration:{status:'complete',reportedCount:0,rows:[]}},'https://sale.591.com.tw/123');
 assert.equal(p.regPrice,null);assert.equal(p.households,null);assert.equal(ctx.evaluateProperty(p).pricing.trueBottom,null);
});
test('linked calculator clears stale previous-property offers when the next property has no reference',()=>{
 const {ctx,nodes}=setup();ctx.active={modelVersion:2,askingPrice:2500,manualReferenceWan:2000};ctx.updatePriceCalculator();assert.equal(nodes['calc-true-bottom'].textContent,'1,600 萬');
 ctx.active={modelVersion:2,askingPrice:5996};ctx.updatePriceCalculator();assert.equal(nodes['input-reg-price'].value,'');assert.equal(nodes['calc-true-bottom'].textContent,'待確認');
});
test('LINE export discloses pending reference and unknown knives, without false bargains',()=>{
 const s=setup();s.ctx.active={modelVersion:2,community:'東煒泰和',askingPrice:5996};s.ctx.copyLineSummary();
 assert.match(s.copied(),/比較基準：待確認/);assert.match(s.copied(),/待確認/);assert.doesNotMatch(s.copied(),/已剔除|5066|66\.9/);
});
test('pasted listing text never invents transactions, walking minutes or household counts',()=>{
 const {ctx}=setup();const p=ctx.parseListingText('社區：東煒泰和，開價5996萬，權狀80.91坪，車位12.217坪');
 assert.equal(p.askingPrice,5996);assert.equal(p.regPrice,null);assert.equal(p.households,null);assert.equal(ctx.evaluateProperty(p).unknown.length>0,true);
});
