const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const code = readFileSync(__dirname + '/../assets/age-gate.js', 'utf8');
const html = readFileSync(__dirname + '/../compare.html', 'utf8');
assert.match(html, /id="ageConfirm"/);
assert.match(html, /id="ageExit"/);
assert.match(html, /\/assets\/age-gate\.js/);
function run({stored=null,storageThrows=false}={}) {
  const elements = {};
  function el(id) {return elements[id] ||= {handlers:{},attributes:{},classList:{values:new Set(),add(x){this.values.add(x)},contains(x){return this.values.has(x)}},addEventListener(name,fn){this.handlers[name]=fn},setAttribute(k,v){this.attributes[k]=v},focus(){this.focused=true}}}
  let written=null, navigated=null;
  const context = {
    document:{getElementById:el,querySelector:()=>null},
    localStorage:{getItem(){if(storageThrows)throw Error('blocked');return stored},setItem(k,v){if(storageThrows)throw Error('blocked');written=[k,v]}},
    window:{location:{replace(url){navigated=url}}}
  };
  vm.runInNewContext(code,context);
  return {elements,el,click:id=>el(id).handlers.click?.(),write:()=>written,navigate:()=>navigated};
}
{
 const x=run();assert.equal(x.el('ageGate').classList.contains('hidden'),false);
 assert.equal(typeof x.el('ageConfirm').handlers.click,'function');
 assert.equal(typeof x.el('ageExit').handlers.click,'function');
 x.click('ageConfirm');assert.equal(x.el('ageGate').classList.contains('hidden'),true);
 assert.deepEqual(x.write(),['betcheap_age_ok','1']);
 assert.equal(x.el('ageGate').attributes['aria-hidden'],'true');
}
{
 const x=run({stored:'1'});assert.equal(x.el('ageGate').classList.contains('hidden'),true);
}
{
 const x=run();x.click('ageExit');assert.equal(x.navigate(),'about:blank');
}
{
 const x=run({storageThrows:true});x.click('ageConfirm');assert.equal(x.el('ageGate').classList.contains('hidden'),true);
}
console.log('PASS: age gate confirm, exit, persistence and storage-denied fallback');
