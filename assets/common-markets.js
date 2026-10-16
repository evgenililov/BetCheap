/* Shared, explicit football market adapters. Unknown markets/parameters fail closed. */
(function(root){
'use strict';
const types={1:['result','home'],2:['result','draw'],3:['result','away'],4:['double','home_draw'],5:['double','home_away'],6:['double','draw_away'],7:['handicap','home'],8:['handicap','away'],9:['total','over'],10:['total','under'],180:['btts','yes'],181:['btts','no']};
const definitions={match_odds:'result',matchOdds:'result',double_chance:'double',both_teams_to_score:'btts',total_goals:'total',asian_handicap:'handicap'};
const names={result:'1X2',double:'Double chance',btts:'Both teams to score',total:'Total goals',handicap:'Asian handicap (home line)'};
const outcomes={home:'Home',away:'Away',draw:'Draw',home_draw:'1X',home_away:'12',draw_away:'X2',yes:'Yes',no:'No',over:'Over',under:'Under'};
const lineNumber=v=>typeof v==='number'||typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v)?Number(v):NaN;
function key(m){return [m.period,m.market,m.line??'',m.outcome].join('|')}
function validPrice(v){return v!==null&&Number.isFinite(Number(v))&&Number(v)>1}
function unique(rows){const map=new Map();for(const r of rows){const k=key(r);if(!map.has(k))map.set(k,r);else if(map.get(k)?.price!==r.price)map.set(k,null)}return [...map.values()].filter(Boolean)}
function one(event){
 if(Number(event?.sportId)!==1)return [];
 const rows=[];
 for(const [e,rootEvent] of [[event,true],...(event.subGames||[]).map(e=>[e,false])]){
  // Other subgame types are corners, cards and special markets, even when their odds codes coincide.
  if(!rootEvent&&Number(e.type)!==1)continue;
  if(rootEvent&&e.type!=null&&Number(e.type)!==1)continue;
  const period=rootEvent&&Number(e.period||0)===0?'ft':Number(e.period)===1&&e.periodName==='1st half'?'1h':Number(e.period)===2&&e.periodName==='2nd half'?'2h':null;
  if(!period)continue;
  for(const o of e.odds||[]){const t=types[o.type];if(!t||o.isBlocked||Number(o.playerId||0)!==0||!validPrice(o.oddsMarket))continue;
   const [market,outcome]=t;let line=null;
   if(market==='total'||market==='handicap'){line=lineNumber(o.parameter);if(!Number.isFinite(line)||!Number.isInteger(line*2)||market==='total'&&line<0)continue;if(market==='handicap'&&outcome==='away')line=-line;}
   else if(o.parameter!=null&&Number(o.parameter)!==0)continue;
   rows.push({period,market,line,outcome,price:Number(o.oddsMarket)});
  }
 }
 return unique(rows);
}
function cloud(event){
 const rows=[];
 for(const [keyName,m] of Object.entries(event?.markets||{})){
  if(['SUSPENDED','CLOSED'].includes(m?.status))continue;
  const match=/^soccer\.([a-zA-Z_]+?)(?:_period_(first_half|second_half))?$/.exec(keyName);if(!match)continue;
  const market=definitions[match[1]];if(!market)continue;
  for(const [params,sub] of Object.entries(m.submarkets||{})){
   if(['SUSPENDED','CLOSED'].includes(sub?.status)||!Array.isArray(sub?.selections))continue;
   const p=new URLSearchParams(params);if([...p.keys()].some(k=>k!=='period')||p.getAll('period').length!==1)continue;
   const period=p.get('period');if(!['ft','1h','2h'].includes(period))continue;
   if(match[2]&&period!==(match[2]==='first_half'?'1h':'2h'))continue;
   for(const s of sub.selections){
    if(s?.side!=='BACK'||s.status!=='SELECTION_ENABLED'||!validPrice(s.price))continue;
    const allowed={result:['home','draw','away'],double:['home_draw','home_away','draw_away'],btts:['yes','no'],total:['over','under'],handicap:['home','away']}[market];
    if(!allowed.includes(s.outcome))continue;
    let line=null;const selectionParams=new URLSearchParams(s.params||'');
    if(market==='total'||market==='handicap'){
     const field=market==='total'?'total':'handicap';if([...selectionParams.keys()].length!==1||!selectionParams.has(field))continue;
     line=lineNumber(selectionParams.get(field));if(!Number.isFinite(line)||!Number.isInteger(line*2)||market==='total'&&line<0)continue;
    }else if([...selectionParams.keys()].length)continue;
    rows.push({period,market,line,outcome:s.outcome,price:Number(s.price)});
   }
  }
 }
 return unique(rows);
}
function intersect(event,quotes){const other=new Map(unique(quotes||[]).map(r=>[key(r),r]));return one(event).flatMap(a=>{const b=other.get(key(a));return b&&validPrice(b.price)?[{...a,one:a.price,cloud:b.price}]:[]})}
function label(r){return ({ft:'Full match','1h':'1st half','2h':'2nd half'}[r.period]||r.period)+' · '+names[r.market]+(r.line===null?'':' '+r.line)+' · '+outcomes[r.outcome]}
const api={one,cloud,intersect,key,label};if(typeof module==='object'&&module.exports)module.exports=api;else root.BetCheapMarkets=api;
})(typeof globalThis==='object'?globalThis:this);
