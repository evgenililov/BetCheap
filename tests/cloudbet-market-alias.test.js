'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {extract1x2}=require('../netlify/lib/cloudbet-compare');
const market=()=>({submarkets:{'period=ft':{selections:['home','draw','away'].map((outcome,i)=>({outcome,price:[2,3,4][i],side:'BACK',status:'SELECTION_ENABLED'}))}}});
test('Empty legacy alias cannot hide a valid current market',()=>{
 assert.deepEqual(extract1x2({markets:{'soccer.match_odds':{},'soccer.matchOdds':market()}}),{home:2,draw:3,away:4});
});
test('Identical aliases are allowed; conflicting aliases and suspended markets are not',()=>{
 const a=market(),b=market();
 assert.ok(extract1x2({markets:{'soccer.match_odds':a,'soccer.matchOdds':b}}));
 b.submarkets['period=ft'].selections[0].price=9;
 assert.equal(extract1x2({markets:{'soccer.match_odds':a,'soccer.matchOdds':b}}),null);
 a.status='SUSPENDED';assert.equal(extract1x2({markets:{'soccer.matchOdds':a}}),null);
});
