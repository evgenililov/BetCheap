'use strict';
const common=require('../../assets/common-markets');
const {FOOTER,buttons,appLink}=require('./telegram-service');
const clean=v=>String(v??'').replace(/[\r\n\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,90);
function timestamp(v){const n=typeof v==='number'?v*1000:Date.parse(v);return Number.isFinite(n)?n:null}
function upcoming(e,now=Date.now()){const t=timestamp(e?.start);return Number(e?.sportId)===1&&/^\d{1,18}$/.test(String(e.sportEventId))&&/^\d{1,18}$/.test(String(e.tournamentId))&&typeof e.home==='string'&&typeof e.away==='string'&&t>now+5*60000&&t<now+3*86400000}
function leagues(){const ids=(process.env.TELEGRAM_TOURNAMENT_IDS||'88637').split(',').map(s=>s.trim());if(!ids.length||ids.length>3||ids.some(s=>!/^\d{1,10}$/.test(s)))throw Error('invalid_tournament_config');return [...new Set(ids)]}
async function api(provider,q){
 const fn=provider==='onexbet'?require('../functions/onexbet'):require('../functions/cloudbet');
 const r=await fn.handler({httpMethod:'GET',queryStringParameters:q});
 if(r.statusCode!==200)throw Error('odds_unavailable');
 return JSON.parse(r.body);
}
async function detail(id,call=api){
 if(!/^\d{1,18}$/.test(String(id)))throw Error('invalid_event_id');
 const d=await call('onexbet',{op:'detail',kind:'prematch',sportEventId:String(id),lng:'en'});
 if(!upcoming(d.event)||String(d.event.sportEventId)!==String(id))throw Error('event_unavailable');
 const fetched=Date.parse(d.fetchedAt);if(!Number.isFinite(fetched)||Math.abs(Date.now()-fetched)>120000)throw Error('stale_snapshot');
 return {...d.event,telegramFetchedAt:fetched};
}
async function matches(call=api){
 const ids=[];
 for(const tournamentId of leagues()){
  try{const d=await call('onexbet',{op:'events',kind:'prematch',tournamentId,lng:'en'});for(const item of (d.items||[]).slice(0,6)){const id=String(typeof item==='object'?item.sportEventId:item);if(/^\d{1,18}$/.test(id)&&!ids.includes(id))ids.push(id)}}catch{/* Other configured competitions can still work. */}
 }
 const found=[];
 // Bound API calls; never scan every competition for each chat command.
 for(let i=0;i<ids.length;i+=3){const results=await Promise.allSettled(ids.slice(i,i+3).map(id=>detail(id,call)));for(const r of results)if(r.status==='fulfilled')found.push(r.value);if(found.length>=5)break}
 return found.sort((a,b)=>timestamp(a.start)-timestamp(b.start)).slice(0,5);
}
async function comparison(e,call=api){
 if(!upcoming(e))return null;
 const result=await call('cloudbet',{op:'compare',kind:'prematch',sportId:'1',home:e.home,away:e.away,league:e.tournament,start:new Date(timestamp(e.start)).toISOString()});
 if(result.ok!==true||result.matched!==true||!result.cloudbetEventId)return null;
 const checked=Date.parse(result.checkedAt);if(!Number.isFinite(checked)||Math.abs(Date.now()-checked)>120000)return null;
 if(!Number.isFinite(e.telegramFetchedAt)||Date.now()-e.telegramFetchedAt>120000)return null;
 const rows=common.intersect(e,result.markets).filter(r=>Number.isFinite(r.one)&&r.one>1&&Number.isFinite(r.cloud)&&r.cloud>1);
 if(!rows.length)return null;
 const lines=rows.slice(0,6).map(r=>`${common.label(r)}\n1xBet ${r.one.toFixed(2)} | Cloudbet ${r.cloud.toFixed(2)}`);
 return {text:`${clean(e.home)} vs ${clean(e.away)}\n${clean(e.tournament)}\nKickoff: ${new Date(timestamp(e.start)).toISOString().replace('T',' ').slice(0,16)} UTC\n\n${lines.join('\n\n')}\n\nSnapshot: ${new Date(checked).toISOString().replace('T',' ').slice(0,16)} UTC\n${FOOTER}`,reply_markup:buttons(e)};
}
async function commandReply(c,call=api){
 if(c.name==='start'||c.name==='help')return {text:'Welcome to BetCheap! Compare the same football match, market and line.\n/matches — upcoming football\n/compare EVENT_ID — verified prices from both operators\n/app — open BetCheap\n\n18+ only. Gamble responsibly. Affiliate links. No bets are placed here.',reply_markup:buttons()};
 if(c.name==='app')return {text:'Open BetCheap to compare available football odds. 18+ · Affiliate links.',reply_markup:buttons()};
 if(c.name==='compare'){
  if(!/^\d{1,18}$/.test(c.arg))return {text:'Use /matches, then copy /compare EVENT_ID from the list. Only upcoming football is supported.',reply_markup:buttons()};
  const e=await detail(c.arg,call);const p=await comparison(e,call);
  return p||{text:'No verified common prices are available for this match now. Try another match from /matches.',reply_markup:{inline_keyboard:[[{text:'View match in BetCheap',url:appLink(e)}]]}};
 }
 const events=await matches(call);
 if(!events.length)return {text:'No upcoming matches could be retrieved from the configured competitions. Please try again later or open the app.',reply_markup:buttons()};
 return {text:'Upcoming football — selected competitions, next 72 hours.\nThese fixtures are not yet verified as two-operator comparisons.\n\n'+events.map(e=>`${clean(e.home)} vs ${clean(e.away)}\n${new Date(timestamp(e.start)).toISOString().replace('T',' ').slice(0,16)} UTC\n/compare ${e.sportEventId}`).join('\n\n')+'\n\n18+ · Gamble responsibly.',reply_markup:buttons()};
}
module.exports={matches,detail,comparison,commandReply,upcoming,leagues};
