const assert=require('node:assert/strict');
const {matchingEvent,matchingCompetition,extract1x2,sameTeam}=require('../netlify/lib/cloudbet-compare');
process.env.CLOUDBET_API_KEY='mock-secret-never-visible';
const {handler}=require('../netlify/functions/cloudbet');
const start=new Date(Date.now()+3600000).toISOString(),liveStart=new Date(Date.now()-600000).toISOString();
const odds=()=>({'soccer.match_odds':{submarkets:{'period=ft':{selections:['home','draw','away'].map((outcome,i)=>({outcome,price:[2.22,3.4,3.1][i],side:'BACK',status:'SELECTION_ENABLED',params:''}))}}}});
const fixture=(status='TRADING',time=start)=>({id:12345,home:{name:'SC Paderborn 07'},away:{name:'VfB Stuttgart'},startTime:time,status,markets:{}});
assert(sameTeam('Paderborn 07','SC Paderborn 07'));
assert(sameTeam('Stuttgart','VfB Stuttgart'));
assert(!sameTeam('Stuttgart','Stuttgart II'));
assert(!sameTeam('Leeds United','Manchester United'));
assert.equal(matchingEvent({events:[fixture()]},{kind:'prematch',home:'Paderborn 07',away:'Stuttgart',start}).id,12345);
let responseMode='healthy', calls=[];
global.fetch=async(url,opts)=>{
 calls.push({url,opts});
 if(url.endsWith('/sports/soccer'))return {ok:true,json:async()=>({categories:[{name:'Germany',competitions:[{name:'Bundesliga',key:'soccer-germany-bundesliga'}]}]})};
 if(url.includes('/competitions/'))return {ok:true,json:async()=>({events:[fixture(responseMode==='live'?'TRADING_LIVE':'TRADING',responseMode==='live'?liveStart:start)]})};
 if(url.includes('/events/12345')){const e=fixture(responseMode==='live'?'TRADING_LIVE':responseMode==='suspended'?'SUSPENDED':'TRADING',responseMode==='live'?liveStart:start);e.markets=odds();if(responseMode==='wrongId')e.id=98765;if(responseMode==='noMarket')e.markets={};return {ok:true,json:async()=>e};}
 throw Error('unexpected request: '+url);
};
(async()=>{
 const q={op:'compare',sportId:'1',kind:'prematch',home:'Paderborn 07',away:'Stuttgart',start,league:'Germany. Bundesliga'};
 let r=await handler({httpMethod:'GET',queryStringParameters:q}),j=JSON.parse(r.body);
 assert.equal(r.statusCode,200);assert.equal(j.matched,true);assert.equal(j.retrieval,'event-detail');assert.deepEqual(j.odds,{home:2.22,draw:3.4,away:3.1});assert.equal(j.cloudbetEventId,'12345');assert.equal(calls.filter(x=>x.url.includes('/events/')).length,1);
 assert(calls.every(x=>x.opts.headers['X-API-Key']==='mock-secret-never-visible'));assert(!r.body.includes('mock-secret-never-visible'));
 responseMode='live';calls=[];r=await handler({httpMethod:'GET',queryStringParameters:{...q,kind:'live',start:liveStart}});j=JSON.parse(r.body);assert.equal(j.matched,true);assert.equal(j.kind,'live');assert.equal(calls.filter(x=>x.url.includes('/competitions/')).length,1);
 responseMode='wrongId';calls=[];r=await handler({httpMethod:'GET',queryStringParameters:{...q,start:new Date(Date.now()+2*3600000).toISOString()}});j=JSON.parse(r.body);assert.equal(j.matched,false); // don't match different times
 console.log('PASS: single event fallback, same fixture, 1X2, Cloudbet original market schema, no secrets, LIVE no list-cache');
})().catch(e=>{console.error(e);process.exit(1)});
