'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {providerQuery,matchingEvent,matchingCompetition}=require('../netlify/lib/cloudbet-compare');
const now=Date.parse('2026-10-16T10:00:00Z'),start='2026-10-16T19:00:00Z';
const cases=[
 ['Spain. La Liga','Deportivo de A Coruna','Levante UD','RC Deportivo La Coruna','Levante UD'],
 ['Netherlands. Eredivisie','Heerenveen','Excelsior','SC Heerenveen','Excelsior Rotterdam'],
 ['Germany. Bundesliga','Eintracht Frankfurt','1. Koln','Eintracht Frankfurt','FC Koln']
];
for(const [league,home,away,providerHome,providerAway] of cases)test('observed provider spelling in '+league,()=>{
 const q={kind:'prematch',home,away,start};
 const e={id:10,status:'TRADING',cutoffTime:start,home:{name:providerHome},away:{name:providerAway}};
 assert.equal(matchingEvent({events:[e]},q,now),null);
 assert.equal(matchingEvent({events:[e]},providerQuery(q,league),now),e);
 assert.equal(matchingEvent({events:[{...e,cutoffTime:'2026-10-17T19:00:00Z'}]},providerQuery(q,league),now),null);
 assert.equal(matchingEvent({events:[{...e,home:e.away,away:e.home}]},providerQuery(q,league),now),null);
 assert.equal(q.home,home);assert.equal(q.away,away);
});
test('aliases do not affect youth, women, reserve, other leagues, or partial names',()=>{
 for(const name of ['Excelsior Women','Excelsior U19','Excelsior II','Jong Excelsior','Excelsior Maassluis'])assert.equal(providerQuery({home:name},'Netherlands. Eredivisie').home,name);
 assert.equal(providerQuery({home:'Excelsior'},'Netherlands. Eerste Divisie').home,'Excelsior');
 assert.equal(providerQuery({home:'Excelsior'},'France. Eredivisie').home,'Excelsior');
 assert.equal(providerQuery({home:'1. Koln U19'},'Germany. Bundesliga').home,'1. Koln U19');
});
test('Portugal league names match only within Portugal and reject ambiguity',()=>{
 const catalog={categories:[{name:'Portugal',competitions:[{name:'Liga Portugal',key:'soccer-portugal-primeira-liga'}]}]};
 assert.ok(matchingCompetition(catalog,'Portugal. Primeira Liga'));
 assert.equal(matchingCompetition(catalog,'Brazil. Primeira Liga'),null);
 assert.equal(matchingCompetition(catalog,'Portugal. Primeira Liga. Women'),null);
 catalog.categories[0].competitions.push({name:'Primeira Liga',key:'another-league'});
 assert.equal(matchingCompetition(catalog,'Portugal. Primeira Liga'),null);
});
test('comparison handler applies the reviewed name before both list and detail verification',async()=>{
 const savedFetch=global.fetch,savedKey=process.env.CLOUDBET_API_KEY;
 const time=new Date(Date.now()+86400000).toISOString();
 const fixture={id:101,status:'TRADING',cutoffTime:time,home:{name:'Eintracht Frankfurt'},away:{name:'FC Koln'}};
 const markets={'soccer.match_odds':{submarkets:{'period=ft':{selections:['home','draw','away'].map((outcome,i)=>({outcome,price:[1.82,4.2,3.75][i],side:'BACK',status:'SELECTION_ENABLED'}))}}}};
 process.env.CLOUDBET_API_KEY='test-only-alias-key';
 global.fetch=async url=>({ok:true,json:async()=>url.endsWith('/sports/soccer')?{categories:[{name:'Germany',competitions:[{name:'Bundesliga',key:'soccer-germany-bundesliga'}]}]}:url.includes('/competitions/')?{events:[fixture]}:{...fixture,markets}});
 try{
  delete require.cache[require.resolve('../netlify/functions/cloudbet')];
  const response=await require('../netlify/functions/cloudbet').handler({httpMethod:'GET',queryStringParameters:{op:'compare',sportId:'1',kind:'prematch',league:'Germany. Bundesliga',home:'Eintracht Frankfurt',away:'1. Koln',start:time}});
  const data=JSON.parse(response.body);assert.equal(data.matched,true);assert.equal(data.away,'FC Koln');assert.equal(data.odds.away,3.75);
 }finally{global.fetch=savedFetch;if(savedKey===undefined)delete process.env.CLOUDBET_API_KEY;else process.env.CLOUDBET_API_KEY=savedKey;}
});
