const assert=require('node:assert/strict');
const fn=require('../netlify/functions/cloudbet').handler;
process.env.CLOUDBET_API_KEY='test-only-secret-do-not-use';
const next=new Date(Date.now()+3600000).toISOString();const nowLive=new Date(Date.now()-20*60000).toISOString();let activeEventStatus='TRADING';let activeStart=next;
let calls=[];
global.fetch=async(url,opts)=>{calls.push({url,opts});if(url.endsWith('/sports/soccer'))return {ok:true,json:async()=>({categories:[{name:'England',competitions:[{name:'Premier League',key:'soccer-england-premier-league'}]}]})};if(url.includes('/competitions/'))return {ok:true,json:async()=>({events:[{id:99,status:activeEventStatus,startTime:activeStart,home:{name:'Arsenal'},away:{name:'Leeds United'}}]})};if(url.includes('/events/99'))return {ok:true,json:async()=>({id:99,status:activeEventStatus,startTime:activeStart,home:{name:'Arsenal'},away:{name:'Leeds United'},markets:{'soccer.match_odds':{submarkets:{'period=ft':{selections:[{outcome:'home',price:1.5,status:'SELECTION_ENABLED',side:'BACK',params:''},{outcome:'draw',price:4.1,status:'SELECTION_ENABLED',side:'BACK',params:''},{outcome:'away',price:8.1,status:'SELECTION_ENABLED',side:'BACK',params:''}]}}}}})};throw Error('unexpected url')};
(async()=>{
 const query={op:'compare',kind:'prematch',sportId:'1',home:'Arsenal',away:'Leeds United',league:'England. Premier League',start:next};
 const result=await fn({httpMethod:'GET',queryStringParameters:query});assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).matched,true);assert.equal(JSON.parse(result.body).odds.home,1.5);
 assert.equal(calls.length,3);assert(calls.some(c=>c.url.includes('/events/99')));assert(calls.some(c=>c.url.includes('/competitions/')&&!c.url.includes('markets='))); assert(calls.every(c=>c.opts.headers['X-API-Key']===process.env.CLOUDBET_API_KEY));assert(!result.body.includes(process.env.CLOUDBET_API_KEY));
 const blocked=await fn({httpMethod:'GET',queryStringParameters:{...query,kind:'live'}});assert.equal(JSON.parse(blocked.body).matched,false);assert.equal(calls.length,3);assert(calls.some(c=>c.url.includes('/events/99')));assert(calls.some(c=>c.url.includes('/competitions/')&&!c.url.includes('markets='))); 
 activeEventStatus='TRADING_LIVE';activeStart=nowLive;const liveQuery={...query,kind:'live',start:nowLive};const live=await fn({httpMethod:'GET',queryStringParameters:liveQuery});assert.equal(live.statusCode,200);assert.equal(JSON.parse(live.body).matched,true);assert.equal(JSON.parse(live.body).kind,'live');
 const wrongMode=await fn({httpMethod:'GET',queryStringParameters:{...liveQuery,kind:'prematch'}});assert.equal(JSON.parse(wrongMode.body).matched,false);
 activeEventStatus='SUSPENDED';const suspended=await fn({httpMethod:'GET',queryStringParameters:liveQuery});assert.equal(JSON.parse(suspended.body).matched,false);activeEventStatus='TRADING';activeStart=next;
 const missing=await fn({httpMethod:'GET',queryStringParameters:{...query,home:'Chelsea'}});assert.equal(JSON.parse(missing.body).matched,false);
 console.log('Cloudbet mock function: pre-match, LIVE, disabled market, key privacy, wrong fixture PASS');
})().catch(e=>{console.error(e);process.exit(1)})
