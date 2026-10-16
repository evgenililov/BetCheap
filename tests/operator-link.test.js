'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const onexbet=require('../netlify/functions/onexbet');
const original=onexbet.fetchEventForRouting;
onexbet.fetchEventForRouting=async(id,kind)=>({sportEventId:id,kind,link:'https://1xbet.com/en/line/football/123-match'});
const {handler}=require('../netlify/functions/operator-link');
const request=q=>handler({httpMethod:'GET',queryStringParameters:q});
test('Cloudbet quote opens the correct public operator, never an invented match',async()=>{
 const r=await request({operator:'cloudbet',url:'https://evil.test'});
 assert.equal(r.statusCode,302);assert.equal(r.headers.Location,'https://www.cloudbet.com/en/sports');assert.equal(r.headers['X-BetCheap-Link-Kind'],'operator');
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
