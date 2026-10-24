const fs=require('node:fs');
const pages=['index.html','吳淡如_房商必修課.html','「談判大叔」陳侯勳｜買房投資與談判理論全集.html','second_house.html'];
const count=(s,r)=>(s.match(r)||[]).length;
const results=pages.map(file=>{const s=fs.readFileSync(file,'utf8'),rounded={};for(const m of s.matchAll(/\brounded(?:-[a-z0-9]+)*\b/g))rounded[m[0]]=(rounded[m[0]]||0)+1;return {file,textXs:count(s,/\btext-xs\b/g),textSm:count(s,/\btext-sm\b/g),slate500:count(s,/\btext-slate-500\b/g),fontBlack:count(s,/\bfont-black\b/g),rounded,emoji:Object.fromEntries(['💡','⚡','🏦','🎯','📲'].map(e=>[e,s.split(e).length-1])),allPictographs:count(s,/(?![©®™])[\p{Extended_Pictographic}](?:\uFE0F|\u200D[\p{Extended_Pictographic}]\uFE0F?)*/gu),inlineSvg:count(s,/<svg\b/g)};});
console.log(JSON.stringify({recordedAt:new Date().toISOString(),method:'UTF-8 source raw occurrence count (includes responsive variants and inline JS templates)',pages:results},null,2));
