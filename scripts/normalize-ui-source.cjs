const fs=require('node:fs');
const pages=['index.html','吳淡如_房商必修課.html','「談判大叔」陳侯勳｜買房投資與談判理論全集.html','second_house.html'];
const icons=JSON.parse(fs.readFileSync('scripts/lucide-icons.json','utf8'));
const emoji=/(?![©®™])[\p{Extended_Pictographic}](?:\uFE0F|\u200D[\p{Extended_Pictographic}]\uFE0F?)*/gu;
const iconName=s=>/💡/.test(s)?'lightbulb':/⚡|🔥/.test(s)?'zap':/🏦|💰|💵|🏛/.test(s)?'landmark':/🎯/.test(s)?'target':/📲|📱/.test(s)?'smartphone':/🏠|🏡/.test(s)?'house':/📚|📖/.test(s)?'book-open':/📈|📊|🧮/.test(s)?'chart-no-axes-combined':'info';
function svg(s){const name=iconName(s);return icons[name].replace('<svg','<svg class="site-icon lucide lucide-'+name+'" aria-hidden="true" focusable="false"');}
function styleSource(s){
 // Preserve only explicit main headings and monospaced key numbers at weight 900.
 s=s.replace(/<([a-z][\w-]*)\b[^>]*>/gi,tag=>tag.replace(/\bclass=(['"])([\s\S]*?)\1/g,(m,q,c)=>'class='+q+((/^<h1\b/i.test(tag)||/\bfont-mono(?:-num)?\b/.test(c))?c.replace(/\bfont-black\b/g,'__SITE_BLACK__'):c)+q));
 s=s.replace(/\bfont-black\b/g,'font-bold').replace(/__SITE_BLACK__/g,'font-black');
 // Every remaining xs token is an explicit pill label. Other text is 14px in source.
 s=s.replace(/<span\b[^>]*>/gi,tag=>tag.replace(/\bclass=(['"])([\s\S]*?)\1/g,(m,q,c)=>'class='+q+(/\brounded-full\b/.test(c)?c.replace(/\btext-xs\b/g,'__SITE_XS__'):c)+q));
 s=s.replace(/\btext-xs\b/g,'text-sm').replace(/__SITE_XS__/g,'text-xs').replace(/\btext-slate-500\b/g,'text-slate-400');
 s=s.replace(/\brounded(?:-[a-z0-9]+)*\b/g,c=>c==='rounded-full'?'rounded-full':c==='rounded-xl'?'rounded-xl':'rounded-2xl');
 s=s.replace(/<([a-z][\w-]*)\b[^>]*>/gi,(tag,name)=>tag.replace(/\bclass=(['"])([\s\S]*?)\1/g,(m,q,c)=>{
   let radius=/^(button|a|input|select|textarea)$/i.test(name)?'rounded-xl':/^span$/i.test(name)||/\bid=['"][^'"]*(?:badge|tag-)/.test(tag)?'rounded-full':'rounded-2xl';
   return 'class='+q+c.replace(/\brounded(?:-[a-z0-9]+)*\b/g,old=>old==='rounded-full'&&!/^(button|a|input|select|textarea)$/i.test(name)?old:radius)+q;
 }));
 s=s.replace(/(\b(\w+)\.className\s*=\s*)(['"`])([\s\S]*?)\3/g,(m,prefix,name,q,c)=>prefix+q+c.replace(/\brounded(?:-[a-z0-9]+)*\b/g,old=>/badge/i.test(name)?'rounded-full':/btn|button|card/i.test(name)?'rounded-xl':old)+q);
 return s;
}
for(const file of [...pages,'registration-ui.js']){
 let s=fs.readFileSync(file,'utf8');
 if(file.endsWith('.html')){
  s=s.split(/(<script\b[\s\S]*?<\/script>)/gi).map(part=>/^<script\b/i.test(part)?part.replace(emoji,''):part.split(/(<[^>]*>)/g).map(piece=>piece.startsWith('<')?piece.replace(emoji,''):piece.replace(emoji,svg)).join('')).join('');
 }else s=s.replace(emoji,'');
 s=styleSource(s);
 if(file.endsWith('.html')){
  s=s.replace(/<input\b[^>]*\bid=['"](?:calcRate|inp-loan-rate|inp-h2-mortgage-rate)['"][^>]*>/g,tag=>tag.replace('type="number"','type="text" inputmode="decimal" data-rate-input="true" autocomplete="off"'));
  if(!s.includes('Lucide inline SVG'))s=s.replace('</head>','<!-- Lucide inline SVG; Copyright (c) Lucide Contributors. ISC/MIT notices: ./icons/lucide-license.txt -->\n</head>');
 }
 fs.writeFileSync(file,s);
}
let ui=fs.readFileSync('site-ui.js','utf8');
const inner=name=>icons[name].replace(/<svg\b[^>]*>|<\/svg>/g,'').trim();
ui=ui.replace(/  const iconPaths=\{[\s\S]*?\n  \};/,'  const iconPaths='+JSON.stringify({home:inner('house'),bank:inner('landmark'),bolt:inner('zap'),book:inner('book-open'),info:inner('info'),chart:inner('chart-no-axes-combined'),check:inner('info'),arrow:inner('info'),target:inner('target')},null,2)+';');
fs.writeFileSync('site-ui.js',ui);
let build=fs.readFileSync('scripts/build-static.cjs','utf8');if(!build.includes('lucide-license.txt'))build=build.replace("'icons/icon.svg',","'icons/lucide-license.txt', 'icons/icon.svg',");fs.writeFileSync('scripts/build-static.cjs',build);
console.log('Updated actual HTML/template tokens and embedded official Lucide SVGs.');
