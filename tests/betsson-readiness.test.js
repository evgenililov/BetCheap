'use strict';
const assert=require('node:assert/strict');
for(const k of Object.keys(process.env))if(k.startsWith('BETSSON_'))delete process.env[k];
const {handler}=require('../netlify/functions/betsson');
(async()=>{
 const status=JSON.parse((await handler({httpMethod:'GET',queryStringParameters:{op:'status'}})).body);
 assert.equal(status.affiliateRouteAvailable,true);assert.equal(status.comparisonActive,false);assert.equal(status.oddsVerified,false);
 let requested=false;global.fetch=async()=>{requested=true;throw Error('Must not fetch without credentials')};
 const r=await handler({httpMethod:'GET',queryStringParameters:{op:'events'}});
 assert.equal(r.statusCode,503);assert.equal(JSON.parse(r.body).code,'BETSSON_FEED_PENDING');assert.equal(requested,false);
})();
