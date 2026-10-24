const fs = require('node:fs');
const vm = require('node:vm');
for (const file of ['index.html', '吳淡如_房商必修課.html', 'second_house.html', '「談判大叔」陳侯勳｜買房投資與談判理論全集.html']) {
  const html = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (match[1].trim()) { new vm.Script(match[1], { filename: file }); count++; }
  }
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  if (ids.length !== new Set(ids).size) throw Error('Duplicate element IDs in ' + file);
  console.log(`${file}: ${count} inline scripts compile; ${ids.length} unique IDs`);
}
const chen = fs.readFileSync('「談判大叔」陳侯勳｜買房投資與談判理論全集.html', 'utf8');
for (const stale of ['mobileSampleSelect', 'sampleChipsGroup', 'btn-run-ai-deep', 'btn-config-edge-api']) {
  if (new RegExp(`id="${stale}"`).test(chen)) throw Error('Obsolete control: ' + stale);
}
console.log('Obsolete analyzer controls removed');
