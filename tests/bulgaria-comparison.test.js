'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {providerQuery,matchingCompetition,matchingEvent}=require('../netlify/lib/cloudbet-compare');
const rows=[
 ['CSKA Sofia 1948','Botev Plovdiv','CSKA 1948 Sofia','Botev Plovdiv',true],
 ['Dunav Ruse','Spartak Varna','FC Dunav 2010','FK Spartak 1918 Varna',true],
 ['Lokomotiv Plovdiv','Slavia Sofia','PFC Lokomotiv Plovdiv','PFC Slavia Sofia',true],
 ['CSKA Sofia','Ludogorets 1945','PFC CSKA Sofia','PFC Ludogorets 1945 Razgrad',true],
 ['Cherno More Varna','Septemvri Sofia','PFC Cherno More Varna','Septemvri Sofia',false],
 ['Arda Kardzhali','Levski Sofia','Arda Kardzhali','PFC Levski Sofia',false]
];
const catalog={categories:[{name:'Bulgaria',competitions:[{name:'Parva Liga',key:'soccer-bulgaria-parva-liga'}]}]};
test('Bulgarian competition names are scoped and unambiguous',()=>{
 for(const league of ['First League','Parva Liga'])assert.ok(matchingCompetition(catalog,'Bulgaria. '+league));
 for(const league of ['Bulgaria. Second League','Bulgaria. First League Women','Other. First League'])assert.equal(matchingCompetition(catalog,league),null);
 const duplicate=structuredClone(catalog);duplicate.categories[0].competitions.push({name:'First League',key:'duplicate'});
 assert.equal(matchingCompetition(duplicate,'Bulgaria. First League'),null);
});
test('club aliases preserve CSKA identities and qualifiers',()=>{
 const league='Bulgaria. First League';
 const q=providerQuery({home:'CSKA Sofia',away:'CSKA Sofia 1948'},league);
 assert.equal(q.home,'PFC CSKA Sofia');assert.equal(q.away,'CSKA 1948 Sofia');
 for(const [home] of rows){
  for(const suffix of [' Women',' U19',' II'])assert.equal(providerQuery({home:home+suffix},league).home,home+suffix);
  assert.equal(providerQuery({home},'Bulgaria. Second League').home,home);
 }
 assert.equal(providerQuery({home:'Lokomotiv Sofia'},league).home,'Lokomotive Sofia'); // Verified provider spelling.
 const start=new Date(Date.now()+86400000).toISOString();
 const event={status:'TRADING',cutoffTime:start,home:{name:q.away},away:{name:'Botev Plovdiv'}};
 assert.equal(matchingEvent({events:[event]},providerQuery({home:'CSKA Sofia',away:'Botev Plovdiv',start},league)),null);
});
test('handler compares reviewed Bulgarian fixtures and keeps absent markets absent',async()=>{
 const savedFetch=global.fetch,savedKey=process.env.CLOUDBET_API_KEY;
 const start=new Date(Date.now()+86400000).toISOString();
 const events=rows.map((r,i)=>({id:300+i,status:'TRADING',cutoffTime:start,home:{name:r[2]},away:{name:r[3]}}));
 const markets={'soccer.match_odds':{submarkets:{'period=ft':{selections:['home','draw','away'].map((outcome,i)=>({outcome,price:[2.1,3.2,3.4][i],side:'BACK',status:'SELECTION_ENABLED'}))}}}};
 process.env.CLOUDBET_API_KEY='fixture-key';
 global.fetch=async url=>({ok:true,json:async()=>{
  if(url.endsWith('/sports/soccer'))return catalog;
  if(url.includes('/competitions/')){assert.ok(url.includes('soccer-bulgaria-parva-liga'));return {events};}
  const id=Number(new URL(url).pathname.split('/').pop()),index=id-300;
  assert.ok(events[index]);return {...events[index],markets:rows[index][4]?markets:{}};
 }});
 try{
  const handler=require('../netlify/functions/cloudbet').handler;
  for(const league of ['Bulgaria. First League','Bulgaria. Parva Liga'])for(const r of rows){
   const response=await handler({httpMethod:'GET',queryStringParameters:{op:'compare',kind:'prematch',sportId:'1',home:r[0],away:r[1],league,start}});
   const data=JSON.parse(response.body);assert.equal(data.matched,r[4],r[0]);
   if(r[4])assert.deepEqual(data.odds,{home:2.1,draw:3.2,away:3.4});
   else {assert.equal(data.reason,'full_time_1x2_unavailable');assert.equal(data.odds,undefined);}
  }
 }finally{global.fetch=savedFetch;if(savedKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=savedKey;}
});
