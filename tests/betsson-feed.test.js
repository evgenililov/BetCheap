'use strict';
const assert=require('node:assert/strict');
Object.assign(process.env,{BETSSON_OCB:'fixture-ocb-secret',BETSSON_SEGMENT_ID:'621',BETSSON_GATEWAY_URL:'https://gateway.example.com',BETSSON_GATEWAY_TOKEN:'fixture-gateway-secret',BETSSON_EGRESS_WHITELISTED:'true',BETSSON_FEED_APPROVED:'true'});
const {handler}=require('../netlify/functions/betsson');
let seen,status=200;
global.fetch=async(url,options)=>{seen={url:new URL(url),options};return {ok:status===200,status,json:async()=>({pn:1,tp:3,tec:120,ocb:process.env.BETSSON_OCB,el:[{eit:'f-example',en:'A vs B',ci:1,cep:1,et:1,epl:[{pi:1,pn:'A',so:1},{pi:2,pn:'B',so:2}],ml:[{mit:'m-example',mti:'MW3W',msi:999,msl:[{msit:'s-example',mst:'Home',msp:2.5,si:999,ssi:999}]}]}]})}};
(async()=>{
 const request=q=>handler({httpMethod:'GET',queryStringParameters:{op:'events',...q}});
 const response=await request({fixtureTag:'f-example'}),data=JSON.parse(response.body);
 assert.equal(response.statusCode,200);assert.equal(data.totalPages,3);assert.equal(data.events[0].marketSamples[0].selections[0].hasDecimalPrice,true);
 assert.equal(data.comparisonActive,false);assert.equal(data.marketsVerified,false);assert.equal(data.diagnosticOnly,true);
 assert.equal(data.events[0].marketSamples[0].status,'999');
 assert(!response.body.includes('fixture-ocb-secret'));assert(!response.body.includes('fixture-gateway-secret'));assert(!response.body.includes('2.5'));
 assert.equal(seen.url.pathname,'/isa/v2/621/en/event');assert.equal(seen.url.searchParams.get('fixtureTags'),'f-example');assert.equal(seen.url.searchParams.get('categoryIds'),'1');assert.equal(seen.url.searchParams.get('ocb'),'fixture-ocb-secret');assert.equal(seen.options.redirect,'error');
 assert.equal((await request({fixtureTag:'f-example&ocb=evil'})).statusCode,400);assert.equal((await request({mode:'other'})).statusCode,400);
 status=403;assert.equal(JSON.parse((await request({})).body).code,'BETSSON_ACCESS_REJECTED');
 status=429;assert.equal(JSON.parse((await request({})).body).code,'BETSSON_RATE_LIMITED');
 console.log('ISA schema diagnostics, pagination, fixed football query, access errors and secret isolation pass');
})().catch(e=>{console.error(e);process.exitCode=1});
