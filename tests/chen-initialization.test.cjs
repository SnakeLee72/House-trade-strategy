const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('registration-ui.js','utf8');
const persist=source.slice(source.indexOf('function persistUserProperties()'),source.indexOf('function initUserProperties()'));
test('property persistence delegates once without recursively interrupting initialization',()=>{
  let calls=0;const context={saveUserProperties(){calls++;}};
  vm.createContext(context);vm.runInContext(persist,context);
  context.persistUserProperties();assert.equal(calls,1);
});
test('property persistence retains localStorage fallback when delegate is absent',()=>{
  const writes=[];const context={STORAGE_KEY:'test',userProperties:[{id:'one'}],localStorage:{setItem(...args){writes.push(args);}}};
  vm.createContext(context);vm.runInContext(persist,context);
  context.persistUserProperties();assert.deepEqual(writes,[['test','[{"id":"one"}]']]);
});
const html=fs.readFileSync('「談判大叔」陳侯勳｜買房投資與談判理論全集.html','utf8');
for(const name of ['renderVideos','renderTactics','updateRentCalculator']){
  test(`${name} skips an unavailable module without stopping other initialization`,()=>{
    const start=html.indexOf('function '+name+'(');
    const next=html.indexOf('\n    function ',start+1);
    const end=html.indexOf('    // 5. Initialize Event Listeners',start);
    const code=html.slice(start,Math.min(...[next,end].filter(i=>i>start)));
    const context={document:{getElementById(){return null;}}};
    vm.createContext(context);vm.runInContext(code,context);context[name]();
  });
}
