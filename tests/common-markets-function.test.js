'use strict';
const assert=require('node:assert/strict');
process.env.CLOUDBET_API_KEY='fixture-key';
const {handler}=require('../netlify/functions/cloudbet');
const start=new Date(Date.now()-600000).toISOString();
const event={id:99,status:'TRADING_LIVE',startTime:start,home:{name:'Arsenal'},away:{name:'Leeds United'}};
let suspend=false;
global.fetch=async url=>({ok:true,json:async()=>url.endsWith('/sports/soccer')?{categories:[{name:'England',competitions:[{name:'Premier League',key:'soccer-england-premier-league'}]}]}:url.includes('/competitions/')?{events:[event]}:{...event,markets:{'soccer.total_goals':{status:suspend?'SUSPENDED':'TRADING',submarkets:{'period=ft':{selections:[{outcome:'over',params:'total=2.5',price:2.1,side:'BACK',status:'SELECTION_ENABLED'}]}}}}}});
(async()=>{
 const q={op:'compare',kind:'live',sportId:'1',home:'Arsenal',away:'Leeds United',league:'England. Premier League',start};
 const a=JSON.parse((await handler({httpMethod:'GET',queryStringParameters:q})).body);
 assert.equal(a.matched,true);assert.equal(a.odds,null);assert.equal(a.markets[0].market,'total');assert.equal(a.markets[0].price,2.1);
 suspend=true;const b=JSON.parse((await handler({httpMethod:'GET',queryStringParameters:q})).body);assert.equal(b.matched,false);
 console.log('Additional markets remain comparable without 1X2; suspended feed removes them');
})().catch(e=>{console.error(e);process.exitCode=1});
