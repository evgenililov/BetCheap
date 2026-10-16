const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const base = __dirname + '/../';
const code = readFileSync(base+'assets/snap.js','utf8');
function start(file, pathname, fail=false) {
  const html=readFileSync(base+file,'utf8');
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{
    value:'', textContent:'', attributes:{}, options:[],
    classList:{add(){},remove(){},toggle(){}},
    setAttribute(k,v){this.attributes[k]=v},
    replaceChildren(...items){this.options=items},append(item){this.options.push(item)}
  }]));
  const calls=[];
  vm.runInNewContext(code, {
    document:{getElementById:id=>elements.get(id)||null,addEventListener(){}},
    location:{href:'https://example.test'+pathname,pathname},
    URL,URLSearchParams,AbortController,setTimeout,clearTimeout,setInterval(){},
    Option:function(text,value){this.text=text;this.value=value},
    fetch:async url=>{calls.push(url);if(fail)throw Error('offline');return {ok:true,json:async()=>({items:[]})}}
  });
  return {elements,calls};
}
for(const path of ['/compare','/compare.html','/']) {
  test('UI startup reaches the feed on '+path,async()=>{
    const x=start(path==='/'?'index.html':'compare.html',path);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(x.calls.length,1);
    assert.match(x.calls[0],/op=sports/);
    assert.match(x.elements.get('catalogStatus').textContent,/No sports returned/);
    if(path!=='/')assert.equal(x.elements.get('tabSearch').attributes['aria-selected'],'true');
  });
}
test('API failure leaves a visible error and a working retry',async()=>{
  const x=start('compare.html','/compare',true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(x.elements.get('systemStatus').textContent,/offline/);
  await x.elements.get('retrySports').onclick();
  assert.equal(x.calls.length,2);
});
test('Both routes use the same HTML contract, without missing script elements',()=>{
  const home=readFileSync(base+'index.html','utf8');
  assert.equal(readFileSync(base+'compare.html','utf8'),home);
  const ids=new Set([...home.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  for(const m of code.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(m[1]),'Missing '+m[1]);
});
