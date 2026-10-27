'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const onexbet=require('../netlify/functions/onexbet');
const original=onexbet.fetchEventForRouting;
onexbet.fetchEventForRouting=async(id,kind)=>({sportEventId:id,kind,link:'https://1xbet.com/en/line/football/123-match'});
const {handler}=require('../netlify/functions/operator-link');
const request=q=>handler({httpMethod:'GET',queryStringParameters:q});
test('Cloudbet preserves the owner-provided Player campaign and rejects tracking overrides',async()=>{
 const r=await request({operator:'cloudbet',url:'https://evil.test',af_token:'attacker',aftm_campaign:'championz',eventId:'123',kind:'live'});
 assert.equal(r.statusCode,302);
 assert.equal(r.headers.Location,'https://cldbt.cloud/go/en/landing/bitcoin-bonus?af_token=ac2136389bdde024242002ac3f66ce9b&aftm_campaign=betcheap_main&aftm_medium=comparison_app&aftm_source=betcheap&aftm_content=operator_button');
 assert.equal(r.headers['X-BetCheap-Link-Kind'],'affiliate');
 assert.equal(r.headers['Cache-Control'],'no-store');
});
test('1xBet event destination comes from the provider, not browser input',async()=>{
 const r=await request({operator:'onexbet',eventId:'123',kind:'prematch',url:'https://evil.test'});
 assert.equal(r.headers.Location,'https://1xbet.com/en/line/football/123-match');assert.equal(r.headers['X-BetCheap-Link-Kind'],'event');
});
test('Wrong section, unsupported operator, and non-GET requests are handled safely',async()=>{
 assert.equal((await request({operator:'onexbet',eventId:'123',kind:'live'})).headers.Location,'https://1xbet.com/en');
 assert.equal((await request({operator:'constructor'})).statusCode,400);
 assert.equal((await handler({httpMethod:'POST'})).statusCode,405);
});
test.after(()=>{onexbet.fetchEventForRouting=original});
test('Betsson preserves the stored partner code and ignores browser destinations',async()=>{
 const r=await request({operator:'betsson',url:'https://evil.test',eventId:'123',kind:'live'});
 assert.equal(r.statusCode,302);
 assert.equal(r.headers.Location,'https://record.betsson.com/_8JVLVBbqlwjlRqYtzC2ttWNd7ZgqdRLk/1/');
 assert.equal(r.headers['X-BetCheap-Link-Kind'],'affiliate');
});
