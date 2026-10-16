/* BetCheap v2.26 — visible-tab, source-verified 1X2 threshold watch. No off-tab alerts. */
(()=>{'use strict';
const $=id=>document.getElementById(id), area=$('oddsAlert');if(!area)return;
const STORAGE='betcheap_odds_alert_v1',INTERVAL=60000,labels=['Home (1)','Draw (X)','Away (2)'];
let view=null, active=null, busy=false, timer=null, version=0;
const positive=n=>Number.isFinite(n)&&n>1&&n<10000;
function priceFor(e,idx){
 const entries=Array.isArray(e?.odds)?e.odds:[];
 const choices=entries.filter(x=>!x.isBlocked&&Number(x.type)===idx+1&&(!x.parameter||Number(x.parameter)===0)&&positive(Number(x.oddsMarket)));
 return choices.length?Math.max(...choices.map(x=>Number(x.oddsMarket))):null;
}
function load(){try{const a=JSON.parse(localStorage.getItem(STORAGE)||'null');if(a&&/^\d+$/.test(a.eventId)&&Number.isInteger(a.choice)&&a.choice>=0&&a.choice<=2&&positive(a.target)&&typeof a.event==='string'&&typeof a.competition==='string')return a;}catch{}return null;}
try{active=load();}catch{active=null;}
function persist(){try{if(active)localStorage.setItem(STORAGE,JSON.stringify(active));else localStorage.removeItem(STORAGE);}catch{note('Browser storage unavailable. This alert will last only while the page stays open.','alert-warning');}}
function note(msg,klass=''){const node=$('alertProgress');node.textContent=msg;node.className='alert-progress '+klass;}
function currentPrice(){if(!view||!active||view.eventId!==active.eventId)return null;const p=view.outcomes?.[active.choice]?.price;return positive(p)?p:null;}
function stop(){if(timer){clearInterval(timer);timer=null;}version++;}
function arm(){stop();if(!active||!view||active.eventId!==view.eventId||active.triggered||document.hidden)return;timer=setInterval(()=>{if(!document.hidden)check(false);},INTERVAL);}
function show(){
 if(!view||view.sportId!==1||!Array.isArray(view.outcomes)||!view.outcomes.some(o=>positive(o.price))){area.classList.add('hidden');stop();return;}
 area.classList.remove('hidden');const valid=view.outcomes.map(o=>positive(o.price));
 [...$('alertOutcome').options].forEach((o,i)=>{o.disabled=!valid[i];o.textContent=labels[i]+(valid[i]?' · '+view.outcomes[i].price.toFixed(2):' · unavailable');});
 if(!valid[Number($('alertOutcome').value)])$('alertOutcome').value=String(valid.indexOf(true));
 const same=active&&active.eventId===view.eventId;
 $('alertActive').classList.toggle('hidden',!same);
 if(same){$('alertSummary').textContent=`${active.event} · ${labels[active.choice]} · target ≥ ${active.target.toFixed(2)}${active.triggered?' · REACHED':''}`;
  if(active.triggered)note('🔔 Target reached. Confirm the current price at the bookmaker; it can change.','alert-hit');
  else note('Watching this match while this tab remains open. Latest selected price: '+(currentPrice()?.toFixed(2)||'unavailable')+'.');
 } else if(active){note('Saved watch for '+active.event+'. Return to that match to resume visible-tab checks.');}
 else note('Select an available 1X2 outcome and the price you would like to see.');
 arm();
}
function trigger(price,checkedAt){active.triggered=true;active.lastPrice=price;active.checkedAt=checkedAt;persist();show();note(`🔔 TARGET REACHED: ${labels[active.choice]} is ${price.toFixed(2)} (target ${active.target.toFixed(2)}). Checked ${new Date(checkedAt).toLocaleTimeString()}. Verify at operator.`, 'alert-hit');}
function evaluate(price,checkedAt){if(!active)return;if(!positive(price)){note('No valid current price for this outcome. Keeping the watch active.','alert-warning');return;}
 active.lastPrice=price;active.checkedAt=checkedAt;if(price>=active.target){trigger(price,checkedAt);return;}
 persist();note(`Checked ${new Date(checkedAt).toLocaleTimeString()}: ${price.toFixed(2)} · target ${active.target.toFixed(2)}. Watching while this tab stays open.`);
}
async function check(manual){
 if(busy||!active||!view||active.eventId!==view.eventId||active.triggered)return;
 if(document.hidden){if(manual)note('Return to the visible tab to check again.','alert-warning');return;}
 busy=true;const ticket=version,id=active.eventId,choice=active.choice;
 $('alertCheck').disabled=true;note('Checking the real 1xBet feed…');
 try{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  let response;try{response=await fetch('/.netlify/functions/onexbet?'+new URLSearchParams({op:'detail',kind:'prematch',sportEventId:id}),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(timeout)}
  if(!response.ok)throw Error('Provider HTTP '+response.status);
  const body=await response.json();
  if(!body?.event||body.event.sportEventId==null||String(body.event.sportEventId)!==id)throw Error('Provider returned a different event');
  if(ticket!==version||!active||active.eventId!==id||document.hidden)return;
  const price=priceFor(body.event,choice);evaluate(price,Date.now());
 }catch(e){if(ticket===version)note('Could not verify a fresh price: '+(e.name==='AbortError'?'request timed out':e.message)+'. Alert remains active.','alert-warning');}
 finally{busy=false;$('alertCheck').disabled=false;}
}
$('alertCreate').onclick=()=>{
 if(!view)return;const choice=Number($('alertOutcome').value),target=Number($('alertThreshold').value);
 if(!Number.isInteger(choice)||choice<0||choice>2||!positive(view.outcomes[choice]?.price)){note('Select an outcome with a real quoted price.','alert-warning');return;}
 if(!positive(target)||!/^\d+(?:[.,]\d{1,2})?$/.test($('alertThreshold').value.trim().replace(',','.'))){note('Enter a valid decimal target between 1.01 and 9999.99.','alert-warning');return;}
 active={eventId:view.eventId,event:view.event,competition:view.competition,choice,target,triggered:false,checkedAt:null,lastPrice:null};persist();show();
 // The already visible snapshot is a real quote, but may be older; always request a fresh price.
 check(true);
};
$('alertCheck').onclick=()=>check(true);
$('alertRemove').onclick=()=>{active=null;stop();persist();show();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();if(active&&view&&active.eventId===view.eventId&&!active.triggered)note('Paused: tab not visible. Return here to resume checks.');}else{arm();if(active&&view&&active.eventId===view.eventId&&!active.triggered)check(true);}});
document.addEventListener('betcheap:snapshot',e=>{
 const d=e.detail;view=d&&d.source==='1xBet'&&/^\d+$/.test(String(d.eventId))?{eventId:String(d.eventId),sportId:Number(d.sportId),event:String(d.event||''),competition:String(d.competition||''),outcomes:(d.outcomes||[]).map(o=>({price:positive(Number(o.price))?Number(o.price):null}))}:null;
 show();
});
window.addEventListener('pagehide',stop);
})();
