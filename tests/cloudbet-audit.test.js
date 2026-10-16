'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {catalogRows,fixturePage}=require('../netlify/lib/cloudbet-audit');
test('audit projects only public names and paginates every fixture',()=>{
 const catalog={categories:[{name:'Italy',secret:'hidden',competitions:[{name:'Serie A',key:'soccer-italy-serie-a',token:'hidden'},{name:'bad',key:'../bad'}]}]};
 assert.deepEqual(catalogRows(catalog),[{country:'Italy',name:'Serie A',key:'soccer-italy-serie-a'}]);
 const data={events:Array.from({length:205},(_,i)=>({id:i,home:{name:'Home '+i},away:{name:'Away'},cutoffTime:'2026-10-16T12:00:00Z',status:'TRADING',markets:{hidden:'hidden'},token:'hidden'}))};
 const pages=[0,100,200].map(n=>fixturePage(data,n));
 assert.deepEqual(pages.map(p=>p.nextOffset),[100,200,null]);assert.equal(pages.flatMap(p=>p.fixtures).length,205);
 assert.ok(!JSON.stringify(pages).includes('hidden'));assert.equal(pages[2].fixtures[4].home,'Home 204');
});
test('fixture audit accepts only a catalog key and never requests markets',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.CLOUDBET_API_KEY;const calls=[];
 process.env.CLOUDBET_API_KEY='secret-test';
 global.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>url.endsWith('/sports/soccer')?{categories:[{name:'Italy',competitions:[{name:'Serie A',key:'serie-a'}]}]}:{events:[{home:{name:'AS Roma'},away:{name:'Genoa CFC'},status:'TRADING',token:'never-output'}]}}};
 try{
  const {handler}=require('../netlify/functions/cloudbet');
  const call=q=>handler({httpMethod:'GET',queryStringParameters:{op:'fixtures',...q}});
  for(const q of [{competitionKey:'../events/1'},{competitionKey:'serie-a',offset:'-1'},{competitionKey:'missing'}])assert.equal((await call(q)).statusCode,400);
  const r=await call({competitionKey:'serie-a'}),body=JSON.parse(r.body);
  assert.equal(body.fixtures[0].home,'AS Roma');assert.equal(body.marketsChecked,false);assert.equal(body.nextOffset,null);
  assert.ok(!r.body.includes('secret-test'));assert.ok(!r.body.includes('never-output'));
  assert.deepEqual(calls,['https://sports-api.cloudbet.com/pub/v2/odds/sports/soccer','https://sports-api.cloudbet.com/pub/v2/odds/competitions/serie-a']);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=oldKey;}
});
