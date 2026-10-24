(function(root){
  'use strict';
  const invalidMessage='請完整填入有效的手動情境數字。資料缺漏時不套用預設價格產生判斷。';
  function readNumber(el){const raw=el?.value;if(raw==null||String(raw).trim()==='')return null;const n=Number(raw);return Number.isFinite(n)?n:null;}
  const rateIds=['calcRate','inp-loan-rate','inp-h2-mortgage-rate'];
  function withinBounds(el){const n=rateIds.includes(el?.id)?readRate(el):readNumber(el);if(n===null)return false;const min=el.getAttribute('min'),max=el.getAttribute('max');return (min===null||min===''||n>=Number(min))&&(max===null||max===''||n<=Number(max));}
  function normalizeRate(el,commit){
    if(!el)return null;const raw=String(el.value).trim();
    if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)||!Number.isFinite(Number(raw))){delete el.dataset.rateCanonical;delete el.dataset.rateBps;return null;}
    // Canonical state is decimal text plus integer basis points; no Float32 storage.
    const canonical=Number(raw).toFixed(2),bps=Math.round(Number(canonical)*100);
    el.dataset.rateCanonical=canonical;el.dataset.rateBps=String(bps);
    if(commit||document.activeElement!==el||(raw.split('.')[1]?.length||0)>2)el.value=String(Number(canonical));
    return Number(canonical); // Convert only at the existing calculation boundary.
  }
  function readRate(el){return normalizeRate(el,false);}
  function commitRate(el){return normalizeRate(el,true);}
  function writeRateBasisPoints(el,bps){if(!Number.isSafeInteger(bps))return null;el.value=(bps/100).toFixed(2);return commitRate(el);}
  function normalizeRates(){document.querySelectorAll('#calcRate,#inp-loan-rate,#inp-h2-mortgage-rate').forEach(readRate);}
  function validateSecondHouse(){
    const ids=['inp-h1-val','inp-h1-loan','inp-h1-rent','inp-rent-net-factor','inp-h2-price','inp-etf-return','inp-loan-rate','inp-buyer-cash','inp-renovation','inp-reserve-fund','inp-fee-rate','inp-loan-calc-amt','inp-h2-mortgage-rate','sel-h2-loan-term','sel-h2-grace-years','inp-t4-loan'];
    const bad=ids.some(id=>{const el=document.getElementById(id),n=readNumber(el);return !withinBounds(el)||(n<0&&id!=='inp-etf-return');}) || readNumber(document.getElementById('inp-h1-val'))<=0 || readNumber(document.getElementById('inp-h2-price'))<=0 || readNumber(document.getElementById('sel-h2-loan-term'))<=0;
    let note=document.getElementById('simulation-validation');
    if(!note){note=document.createElement('p');note.id='simulation-validation';note.setAttribute('role','status');document.getElementById('simulation-title')?.after(note);}
    note.textContent=bad?invalidMessage:'';note.hidden=!bad;
    if(bad){
      document.querySelectorAll('[id^="out-"],[id^="disp-"],[id^="tag-"],[id^="slider-"],#balance-description').forEach(el=>el.textContent='待確認');
      document.getElementById('balance-description').textContent='待確認：'+invalidMessage;
      document.getElementById('simulation-title').textContent='第一屋（待確認）× 第二屋（待確認）× 0050 全景連動試算器';
      document.querySelectorAll('#strategyChart').forEach(el=>el.style.visibility='hidden');
    }else document.querySelectorAll('#strategyChart').forEach(el=>el.style.visibility='visible');
    return !bad;
  }
  root.SiteUI={invalidMessage,readNumber,readRate,commitRate,writeRateBasisPoints,withinBounds,normalizeRates,validateSecondHouse};
  const iconPaths={
  "home": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" />\n  <path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />",
  "bank": "<path d=\"M10 18v-7\" />\n  <path d=\"M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z\" />\n  <path d=\"M14 18v-7\" />\n  <path d=\"M18 18v-7\" />\n  <path d=\"M3 22h18\" />\n  <path d=\"M6 18v-7\" />",
  "bolt": "<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\" />",
  "book": "<path d=\"M12 5v16\" />\n  <path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" />",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"M12 16v-4\" />\n  <path d=\"M12 8h.01\" />",
  "chart": "<path d=\"M12 16v5\" />\n  <path d=\"M16 14.639V21\" />\n  <path d=\"M20 10.656V21\" />\n  <path d=\"m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15\" />\n  <path d=\"M4 18.463V21\" />\n  <path d=\"M8 14.656V21\" />",
  "check": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"M12 16v-4\" />\n  <path d=\"M12 8h.01\" />",
  "arrow": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"M12 16v-4\" />\n  <path d=\"M12 8h.01\" />",
  "target": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <circle cx=\"12\" cy=\"12\" r=\"6\" />\n  <circle cx=\"12\" cy=\"12\" r=\"2\" />"
};
  function iconFor(s){return /🏦|💰|💵/.test(s)?'bank':/⚡|🔥/.test(s)?'bolt':/📚|📖/.test(s)?'book':/📈|📊|🧮/.test(s)?'chart':/✅|✔/.test(s)?'check':/🏠|🏡/.test(s)?'home':/🎯/.test(s)?'target':/➔|➡|👉/.test(s)?'arrow':'info';}
  const emoji=/(?![©®™])[\p{Extended_Pictographic}](?:\uFE0F|\u200D[\p{Extended_Pictographic}]\uFE0F?)*/gu;
  function decorate(scope){
    if(!(scope instanceof Element)||scope.closest('script,style,svg,canvas'))return;
    const walk=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);const texts=[];while(walk.nextNode())if(!walk.currentNode.parentElement.closest('script,style,svg,canvas,textarea,option'))texts.push(walk.currentNode);
    for(const node of texts){const text=node.nodeValue;if(!emoji.test(text)){emoji.lastIndex=0;continue;}emoji.lastIndex=0;const fragment=document.createDocumentFragment();let start=0;
      for(const match of text.matchAll(emoji)){fragment.append(document.createTextNode(text.slice(start,match.index)));const span=document.createElement('span');span.className='site-icon';span.setAttribute('aria-hidden','true');span.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[iconFor(match[0])]+'</svg>';fragment.append(span);start=match.index+match[0].length;}
      fragment.append(document.createTextNode(text.slice(start)));node.replaceWith(fragment);
    }
    for(const el of [scope,...scope.querySelectorAll('[class]')]){
      const classes=el.getAttribute('class');if(!classes)continue;
      const updated=classes.replace(/\b((?:p[xytrbl]?|gap|space-[xy])-)0\.5\b/g,'$11').replace(/\b((?:p[xytrbl]?|gap|space-[xy])-)1\.5\b/g,'$12').replace(/\b((?:p[xytrbl]?|gap|space-[xy])-)2\.5\b/g,'$13').replace(/\b((?:p[xytrbl]?|gap|space-[xy])-)3\.5\b/g,'$14');
      if(updated!==classes)el.setAttribute('class',updated);
    }
    scope.querySelectorAll('table').forEach(table=>{if(!table.parentElement.classList.contains('site-table-scroll')){const wrap=document.createElement('div');wrap.className='site-table-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label','可橫向捲動的資料表');table.before(wrap);wrap.append(table);}});
  }
  if(root.Chart){
    Chart.defaults.color='#cbd5e1';Chart.defaults.font.size=12;Chart.defaults.borderColor='rgba(148,163,184,.16)';
    Chart.register({id:'houseTradeTheme',beforeInit(chart){
      const o=chart.config.options ||= {};o.maintainAspectRatio=false;o.plugins ||= {};if(o.plugins.legend!==false){o.plugins.legend ||= {};o.plugins.legend.labels ||= {};o.plugins.legend.labels.color='#cbd5e1';o.plugins.legend.labels.font={...(o.plugins.legend.labels.font||{}),size:12};}
      for(const scale of Object.values(o.scales||{})){scale.ticks={...scale.ticks,color:'#cbd5e1',font:{...scale.ticks?.font,size:12}};scale.grid={...scale.grid,color:'rgba(148,163,184,.16)'};if(scale.angleLines)scale.angleLines={...scale.angleLines,color:'rgba(148,163,184,.16)'};if(scale.pointLabels)scale.pointLabels={...scale.pointLabels,color:'#cbd5e1',font:{...scale.pointLabels.font,size:12}};}
      const palette=['#38bdf8','#f59e0b','#94a3b8','#7dd3fc'];chart.data.datasets.forEach((d,i)=>{const color=palette[i%palette.length];d.borderColor=color;d.backgroundColor=Array.isArray(d.backgroundColor)?d.backgroundColor.map((_,j)=>palette[j%palette.length]):chart.config.type==='radar'?color+'30':color;d.pointBackgroundColor=color;});
    }});
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('option').forEach(el=>el.textContent=el.textContent.replace(emoji,'').trim());
    normalizeRates();document.querySelectorAll('#calcRate,#inp-loan-rate,#inp-h2-mortgage-rate').forEach(el=>{el.addEventListener('input',()=>readRate(el));el.addEventListener('change',()=>commitRate(el));el.addEventListener('blur',()=>commitRate(el));});
    // Optional rate sliders must use integer bps (step=1), never fractional percentages.
    document.querySelectorAll('input[type="range"][data-rate-for]').forEach(slider=>{slider.step='1';const sync=()=>{const target=document.getElementById(slider.dataset.rateFor),bps=Number(slider.value);if(target&&Number.isSafeInteger(bps)){writeRateBasisPoints(target,bps);target.dispatchEvent(new Event('input',{bubbles:true}));}};slider.addEventListener('input',sync);slider.addEventListener('change',sync);});
    document.querySelectorAll('[data-site-year]').forEach(el=>el.textContent=new Date().getFullYear());
    decorate(document.body);
    new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')decorate(r.target.parentElement);else for(const node of r.addedNodes)decorate(node.nodeType===1?node:node.parentElement);}}).observe(document.body,{childList:true,subtree:true,characterData:true});
    const topbar=document.querySelector('.site-topbar');
    const tabbar=document.querySelector('.site-tabbar');
    document.querySelectorAll('a[href^="#"]').forEach(link=>document.getElementById(link.hash.slice(1))?.classList.add('site-anchor-target'));
    function syncStickyOffsets(){
      document.body.style.setProperty('--site-topbar-height',(topbar?.getBoundingClientRect().height||0)+'px');
      document.body.style.setProperty('--site-tabs-height',(tabbar?.getBoundingClientRect().height||0)+'px');
    }
    syncStickyOffsets();
    const stickyObserver=new ResizeObserver(syncStickyOffsets);
    if(topbar)stickyObserver.observe(topbar);
    if(tabbar)stickyObserver.observe(tabbar);
    window.addEventListener('resize',syncStickyOffsets,{passive:true});
    const links=[...document.querySelectorAll('.site-topbar a[href^="#"],.mobile-scroll-x a[href^="#"]')];
    const targets=[...new Set(links.map(a=>document.getElementById(a.hash.slice(1))).filter(Boolean))];
    function spy(){if(!targets.length)return;const offset=(topbar?.getBoundingClientRect().height||100)+24;let current=targets[0];for(const section of targets)if(section.getBoundingClientRect().top<=offset)current=section;for(const link of links){const active=link.hash==='#'+current.id;link.classList.toggle('site-current',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}const jump=document.getElementById('mobileHeaderJump');if(jump&&document.activeElement!==jump)jump.value='#'+current.id;}
    document.addEventListener('scroll',spy,{passive:true});spy();
  });
})(globalThis);
