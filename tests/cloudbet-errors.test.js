const assert=require('node:assert/strict');
process.env.CLOUDBET_API_KEY='test-only-secret-private';
const {handler}=require('../netlify/functions/cloudbet');
const start=new Date(Date.now()+3600000).toISOString();
const q={op:'compare',kind:'prematch',sportId:'1',home:'Arsenal',away:'Leeds United',league:'England. Premier League',start};
let count=0,compCount=0,step='auth';
const originalFetch=global.fetch;
global.fetch=async(url)=>{
  if(url.endsWith('/sports/soccer')){
    count++;
    if(step==='auth')return {ok:false,status:401};
    return {ok:true,json:async()=>({categories:[{name:'England',competitions:[{name:'Premier League',key:'soccer-england-premier-league'}]}]})};
  }
  if(url.includes('/competitions/')){compCount++;
    if(step==='bad_market')return {ok:false,status:400};
    if(step==='limit')return {ok:false,status:429};
    if(step==='schema')return {ok:true,json:async()=>({something:'unexpected'})};
    return {ok:true,json:async()=>({events:[]})};
  }
  throw Error('Unexpected upstream endpoint '+url);
};
async function call(){return handler({httpMethod:'GET',queryStringParameters:q});}
(async()=>{
  let r=await call();let j=JSON.parse(r.body);assert.equal(r.statusCode,502);assert.equal(j.error,'cloudbet_auth_rejected');assert.equal(j.stage,'catalog');assert.equal(j.upstreamStatus,401);assert(!r.body.includes(process.env.CLOUDBET_API_KEY));
  step='bad_market';r=await call();j=JSON.parse(r.body);assert.equal(j.error,'cloudbet_bad_request');assert.equal(j.stage,'competition');assert.equal(j.upstreamStatus,400);assert.equal(count,2);
  step='limit';r=await call();j=JSON.parse(r.body);assert.equal(j.error,'cloudbet_rate_limited');assert.equal(count,2);assert.equal(j.stage,'competition');
  step='schema';r=await call();j=JSON.parse(r.body);assert.equal(j.error,'cloudbet_invalid_response');assert.equal(j.stage,'competition');
  step='success';r=await call();j=JSON.parse(r.body);assert.equal(j.ok,true);assert.equal(j.matched,false);assert.equal(j.reason,'event_not_verified');assert.equal(count,2);assert.equal(compCount,4);
  console.log('Cloudbet error stages, HTTP codes, secret privacy and 2-minute catalog cache: PASS');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=originalFetch});
