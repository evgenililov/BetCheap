/* BetCheap SNAP v2.20. API data is always source-labelled; no synthetic odds or auto-placement. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const ROOT='/.netlify/functions/onexbet';
 const state={kind:'prematch',mode:'search',league:'',allEvents:[],visible:8,chosen:null,query:'',request:0,viewAll:false,scanURL:null,busy:false,routingRequest:0};
 // Do not expose or enable a referral link until the server approves the visitor market.
 const trustedTypes={1:['Match result','Home win'],2:['Match result','Draw'],3:['Match result','Away win'],4:['Double chance','Home / Draw'],5:['Double chance','Home / Away'],6:['Double chance','Draw / Away'],7:['Handicap','Home handicap'],8:['Handicap','Away handicap']};
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9а-яё]+/gi,' ').replace(/\s+/g,' ').trim();
 const text=v=>typeof v==='string'?v:typeof v==='number'?String(v):v&&typeof v==='object'?(v.en||v.name||v.title||Object.values(v).find(x=>typeof x==='string')||''):'';
 const numId=(x,fields)=>{if((typeof x==='number'||typeof x==='string')&&/^\d+$/.test(String(x))&&Number.isSafeInteger(Number(x))&&Number(x)>0)return Number(x);for(const k of fields){const n=Number(x?.[k]);if(Number.isSafeInteger(n)&&n>0)return n}return null};
 const mk=(name,cls,txt)=>{const d=document.createElement(name);if(cls)d.className=cls;if(txt!==undefined)d.textContent=String(txt);return d};
 const setStatus=(message,type='')=>{$('systemStatus').textContent=message;$('systemStatus').className='fine-note '+type};
 const setCatalog=message=>{$('catalogStatus').textContent=message};
 const leagueCatalog=[];
 let sharedEventPending=true;
 function filterLeagues(){const q=norm($('leagueQuery').value);const select=$('leagueSelect');const old=select.value;select.replaceChildren(new Option('Choose competition…',''));let shown=0;for(const row of leagueCatalog){if(q&&!norm(row.title+' '+row.id).includes(q))continue;select.append(new Option(row.title||'Competition '+row.id,String(row.id)));shown++}if(leagueCatalog.some(r=>String(r.id)===old)&&[...select.options].some(o=>o.value===old))select.value=old;setCatalog(shown+' of '+leagueCatalog.length+' '+(state.kind==='live'?'LIVE':'pre-match')+' competitions shown · 1xBet'+(catalogTruncated?' · Catalog may be incomplete':''));}
 let catalogTruncated=false;
 $('leagueQuery').oninput=()=>{filterLeagues();};
 function showTab(which){state.mode=which;const scan=which==='scan';$('tabScan').classList.toggle('selected',scan);$('tabSearch').classList.toggle('selected',!scan);$('tabScan').setAttribute('aria-selected',String(scan));$('tabSearch').setAttribute('aria-selected',String(!scan));$('scanPane').classList.toggle('hidden',!scan);$('searchPane').classList.toggle('hidden',scan);}
 $('tabScan').onclick=()=>showTab('scan');$('tabSearch').onclick=()=>showTab('search');
 async function api(op,args={},signal){
  const query=new URLSearchParams({op,kind:state.kind,...args});
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);
  if(signal){if(signal.aborted)abort.abort();else signal.addEventListener('abort',()=>abort.abort(),{once:true});}
  try{const r=await fetch(ROOT+'?'+query,{cache:'no-store',signal:abort.signal});let json;try{json=await r.json()}catch{throw Error('Could not read response from data service')};if(!r.ok||json.ok===false)throw Error(json.error||'Data source unavailable');return json;}
  catch(e){if(e.name==='AbortError')throw Error('data request timed out after 15 seconds');throw e;}
  finally{clearTimeout(timer)}
 }
 let sportRequest=0;
 function sportName(row){const known={1:'Football',2:'Ice Hockey',3:'Basketball',4:'Tennis',6:'Volleyball'};return text(row.sportNameLocalization||row.nameLocalization||row.sportName||row.name||row.title)||known[row.sportId||row.id]||`Sport #${row.sportId||row.id}`;}
 async function loadSports(){
  const request=++sportRequest;
  try{
   $('retrySports').classList.add('hidden');
   setCatalog('Loading available sports…');
   const d=await api('sports');if(request!==sportRequest)return;
   const rows=(d.items||[]).map(x=>({id:numId(x,['sportId','id']),name:sportName(x)})).filter(x=>x.id);
   const byId=new Map(rows.map(x=>[x.id,x]));
   const sports=[...byId.values()].sort((a,b)=>a.id===1?-1:b.id===1?1:a.name.localeCompare(b.name));
   const sel=$('sportSelect');sel.replaceChildren(new Option('Choose sport…',''));
   sports.forEach(row=>sel.append(new Option(row.name,String(row.id))));
   if(!sports.length){setCatalog('No sports returned by 1xBet');$('retrySports').classList.remove('hidden');return;}
   const wanted=new URL(location.href).searchParams.get('sportId');
   sel.value=wanted&&sports.some(x=>String(x.id)===wanted)?wanted:(sports.some(x=>x.id===1)?'1':String(sports[0].id));
   await loadTournaments();
  }catch(e){if(request!==sportRequest)return;setCatalog('Sports unavailable');setStatus('Could not load 1xBet sports: '+e.message,'warning');$('retrySports').classList.remove('hidden');}
 }
 $('retrySports').onclick=()=>loadSports();
 async function loadTournaments(){
  const selected=$('sportSelect').value;const request=++sportRequest;
  cancelAndClear();leagueCatalog.splice(0);$('leagueSelect').replaceChildren(new Option('Loading competitions…',''));
  $('leagueQuery').value='';
  if(!selected){setCatalog('Choose a sport');return;}
  const sportName=$('sportSelect').selectedOptions[0]?.text||'Sport';
  $('sportScope').textContent=sportName+' · '+(state.kind==='live'?'🔴 LIVE':'Pre-match');
  try{
   setCatalog('Loading '+sportName+' competitions…');
   const d=await api('tournaments',{sportId:selected});if(request!==sportRequest)return;
   const rows=(d.items||[]).map(x=>({id:numId(x,['tournamentId','id']),title:text(x.tournamentNameLocalization||x.nameLocalization||x.name||x.title)})).filter(x=>x.id);
   rows.sort((a,b)=>(a.title||'').localeCompare(b.title||''));
   leagueCatalog.splice(0,leagueCatalog.length,...rows);catalogTruncated=Boolean(d.possiblyTruncated);
   filterLeagues();
   if(!rows.length)setStatus('No available '+(state.kind==='live'?'LIVE':'pre-match')+' competitions returned for '+sportName+'. Try another sport.','warning');
   const url=new URL(location.href);const tid=url.searchParams.get('tournamentId');
   if(tid&&rows.some(r=>String(r.id)===tid)){$('leagueSelect').value=tid;await loadMatches()}else if(tid){setStatus('The shared competition is no longer available. Choose another competition.','warning')}
  }catch(e){if(request!==sportRequest)return;setCatalog('Could not load '+sportName+' competitions');setStatus('Connection error: '+e.message,'warning');$('retrySports').classList.remove('hidden')}
 }
 $('sportSelect').onchange=loadTournaments;
 function eventName(e){const home=text(e.home),away=text(e.away);if(!home||!away)return null;return `${home} — ${away}`}
 function eventTimestamp(start){if(start===null||start===undefined||start==='')return null;const n=Number(start);const d=Number.isFinite(n)&&n>=1e9?new Date(n<1e11?n*1000:n):new Date(start);return Number.isNaN(d.getTime())?null:d.getTime();}
 function dateLabel(start){const ms=eventTimestamp(start);return ms===null?'Date unavailable':new Date(ms).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
 function matchesQuery(entry,q){if(!q)return true;const value=norm(q);const host=norm(text(entry.e.home)),away=norm(text(entry.e.away)),both=host+' '+away;
  const terms=value.split(/\bvs?\.?\b|\bversus\b|\bagainst\b|\bvs\b/).map(norm).filter(Boolean);
  if(terms.length>=2)return terms.every(t=>both.includes(t));return both.includes(value) || value.split(' ').filter(s=>s.length>=4).some(s=>host.includes(s)||away.includes(s));
 }
 function matchList(){const arr=state.allEvents.filter(x=>eventName(x.e)&&matchesQuery(x,state.query));$('eventCount').textContent=arr.length+' found';const dropdown=$('matchDropdown');dropdown.replaceChildren(new Option(arr.length?'Choose exact match…':'No matches loaded or matching search',''));for(const {e,eventId} of arr)dropdown.append(new Option(eventName(e)+' · '+dateLabel(e.start),String(eventId)));dropdown.disabled=!arr.length;if(state.chosen&&arr.some(x=>x.eventId===state.chosen.eventId))dropdown.value=String(state.chosen.eventId);const host=$('matchList');host.replaceChildren();if(!arr.length){host.append(mk('div','empty-note',state.allEvents.length?'No matching events in this competition. Try another competition or clear your search.':'Choose a competition and load matches.'));$('moreActions').classList.add('hidden');return;}
  arr.slice(0,state.visible).forEach(({e,eventId})=>{const btn=mk('button','match-row');btn.type='button';const wrap=mk('span');const title=mk('strong','',eventName(e));const league=mk('small','',dateLabel(e.start)+' · '+(text(e.tournament)||$('leagueSelect').selectedOptions[0]?.text||'Competition'));wrap.append(title,league);btn.append(wrap,mk('span','match-arrow','↗'));btn.onclick=()=>chooseEvent(eventId);host.append(btn)});
  $('moreActions').classList.toggle('hidden',arr.length<=state.visible);
 }
 function cancelAndClear(){state.request++;cloudbetRequest++;state.allEvents=[];state.chosen=null;state.visible=8;state.viewAll=false;$('eventDetails').classList.add('hidden');closeSelection();$('allMarkets').classList.add('hidden');$('allMarketsBtn').setAttribute('aria-expanded','false');$('allMarketsBtn').textContent='Browse other markets ↓';matchList();}
 const detailCache=new Map();
 async function detail(eventId,signal){const key=state.kind+':'+eventId;const cache=detailCache.get(key);if(cache&&Date.now()-cache.when<(state.kind==='live'?4000:20_000))return cache.e;
  const response=await fetch(ROOT+'?'+new URLSearchParams({op:'detail',kind:state.kind,sportEventId:eventId}),{signal,cache:'no-store'});let data;try{data=await response.json()}catch{return null};if(!response.ok||!data.event||data.event.kind!==state.kind||String(data.event.sportEventId)!==String(eventId))return null;detailCache.set(key,{when:Date.now(),e:data.event});return data.event;}
 async function loadMatches(){const league=$('leagueSelect').value;if(!league){setStatus('Choose a competition to load actual events.','warning');$('leagueSelect').focus();return}state.league=league;cancelAndClear();const token=state.request;state.busy=true;$('loadMatches').disabled=true;setStatus('Finding real events in the chosen competition…');
  try{const d=await api('events',{tournamentId:league});if(token!==state.request)return;const ids=[...new Set((d.items||[]).map(x=>numId(x,['sportEventId','id'])).filter(Boolean))];const partialListing=Boolean(d.possiblyTruncated||(Number.isInteger(d.reportedCount)&&d.reportedCount>ids.length));if(!ids.length){setStatus('No events returned for this competition. Choose another league.');return;}
   const deepUrl=new URL(location.href),deepId=deepUrl.searchParams.get('eventId');
   if(sharedEventPending&&deepId&&deepUrl.searchParams.get('tournamentId')===league){
    sharedEventPending=false;
    if(!/^\d{1,18}$/.test(deepId)||!ids.some(id=>String(id)===deepId)){setStatus('The shared match is no longer listed. Tap Show matches to browse this competition.','warning');return}
    const e=await detail(deepId);if(token!==state.request)return;
    if(!e||!eventName(e)||(state.kind==='prematch'&&(eventTimestamp(e.start)===null||eventTimestamp(e.start)<=Date.now()))){setStatus('The shared match is unavailable or has already started. Tap Show matches to browse current events.','warning');return}
    state.allEvents=[{eventId:Number(deepId),e}];matchList();chooseEvent(Number(deepId));setStatus('Shared match loaded. Checking available prices from both operators.','good');return;
   }
   let next=0,finished=0,failed=0;const found=[];
   async function worker(){while(next<ids.length && token===state.request){const eid=ids[next++];try{const e=await detail(eid);if(token!==state.request)return;if(e&&eventName(e))found.push({eventId:eid,e});else failed++}catch{failed++}finished++;if(token===state.request){setStatus('Checking events '+finished+'/'+ids.length+' · '+found.length+' ready…');}}}
   await Promise.all(Array.from({length:Math.min(3,ids.length)},()=>worker()));if(token!==state.request)return;
   state.allEvents=found.sort((a,b)=>(eventTimestamp(a.e.start)??Infinity)-(eventTimestamp(b.e.start)??Infinity));matchList();
   if(state.query&&!found.some(x=>matchesQuery(x,state.query)))setStatus('No exact event found for your search in this competition. Check the competition or spelling. '+found.length+' other events loaded.','warning');
   else setStatus(found.length+' actual events loaded from 1xBet'+(failed?' · '+failed+' unavailable or incomplete':'')+(partialListing?' · Partial provider listing; additional events may exist':'')+'. Select the right match to view its prices.',partialListing?'warning':'good');

  }catch(e){if(token===state.request)setStatus('Events unavailable: '+e.message,'warning')}finally{if(token===state.request){state.busy=false;$('loadMatches').disabled=false}}
 }
 $('matchDropdown').onchange=()=>{const id=Number($('matchDropdown').value);if(id)chooseEvent(id)};$('loadMatches').onclick=loadMatches;$('leagueSelect').onchange=()=>{cancelAndClear();state.league=$('leagueSelect').value;setStatus('Competition selected. Tap Show matches to load real events.');};
 $('showMore').onclick=()=>{state.visible+=8;matchList()};
 $('teamQuery').oninput=()=>{state.query=$('teamQuery').value.trim();state.visible=8;matchList()};
 $('findBtn').onclick=()=>{state.query=$('teamQuery').value.trim();if(!state.league){setStatus('Select a competition before searching a team.','warning');$('leagueSelect').focus();return}if(!state.allEvents.length){loadMatches();return}matchList();$('results').scrollIntoView({behavior:'smooth',block:'start'})};
 function allOdds(e,section='Full match',depth=0){if(!e||depth>5)return [];const o=(e.odds||[]).filter(x=>Number.isFinite(Number(x.oddsMarket))&&Number(x.oddsMarket)>1&&!x.isBlocked).map(x=>({...x,section}));return o.concat((e.subGames||[]).flatMap(x=>allOdds(x,text(x.periodName)||'Period / subgame',depth+1)))}
 const operatorHref=(operator,eventId,kind)=>'/.netlify/functions/operator-link?'+new URLSearchParams({operator:operator==='Cloudbet'?'cloudbet':operator==='Betsson'?'betsson':'onexbet',eventId:String(eventId||''),kind});
 function openSelection(odds,label,section,operator="1xBet",operatorEventId=""){
  const entry=state.chosen;if(!entry||!odds||!Number.isFinite(Number(odds.oddsMarket)))return;
  const e=entry.e;const amount=Number(odds.oddsMarket).toFixed(2);
  $('choiceEvent').textContent=eventName(e)+' · '+($('leagueSelect').selectedOptions[0]?.text||'')+' · '+operator;
  $('choiceMarket').textContent=section+' · '+label;
  document.getElementById('choiceOperatorLabel').textContent='Shown '+operator+' odds';
  $('choicePrice').textContent=amount;
  const when=detailCache.get(state.kind+':'+entry.eventId)?.when;
  $('choiceTime').textContent='Source data retrieved '+(when?new Date(when).toLocaleString():'at an unknown time')+'. This is not a reservation or guaranteed executable quote.';
  const link=$('operatorLink');
  link.href=operatorHref(operator,entry.eventId,state.kind);link.removeAttribute('aria-disabled');link.classList.remove('disabled-link');
  link.textContent='Open '+operator+' ↗';
  const warning=document.querySelector('.choice-warning');
  warning.textContent='Opens the operator site, or the exact event when supplied by its API. No selection is prefilled; confirm the match, market and current price there. This public link does not claim affiliate tracking.';
  const choiceToken=++state.routingRequest;
  const type=Number(odds.type);
  const parameter=odds.parameter===undefined||odds.parameter===null?'':String(odds.parameter);
  const sportEventId=String(entry.eventId);
  const routeQuery=new URLSearchParams({eventId:sportEventId,type:String(type),parameter,section,kind:state.kind});
  if(operator==='Cloudbet'){
    link.textContent='Open Cloudbet · partner link ↗';link.rel='sponsored noopener noreferrer';
    warning.textContent='Cloudbet quote is from matched event '+operatorEventId+'. This partner link opens Cloudbet’s promotional landing page. No match or bet is preselected. Navigate to Sports, find the same fixture and confirm the current price.';
    $('selectionDialog').classList.remove('hidden');$('closeSelection').focus();return;
  }
  fetch('/.netlify/functions/affiliate-route?'+routeQuery,{cache:'no-store'})
   .then(async res=>{if(!res.ok)throw Error('not configured');return res.json()})
   .then(route=>{
     if(choiceToken!==state.routingRequest||$('selectionDialog').classList.contains('hidden'))return;
     if(route.verified===true&&route.kind==='selection'&&route.url){
       const url=new URL(route.url);
       if(url.protocol!=='https:'||url.hostname!=='reffpa.com')return;
       link.href=url.toString();link.removeAttribute('aria-disabled');link.classList.remove('disabled-link');link.textContent='Continue to this selection at 1xBet ↗';
       warning.textContent='Officially configured selection link. Check the final betslip and odds on the operator site; availability and tracking must be verified.';
     } else if(route.kind==='event'&&route.verified===true&&route.url){
       const url=new URL(route.url);
       if(url.protocol!=='https:'||url.hostname!=='reffpa.com')return;
       link.href=url.toString();link.removeAttribute('aria-disabled');link.classList.remove('disabled-link');link.textContent='Open this match at 1xBet ↗';
       warning.textContent='Verified event-page tracking URL is configured, but the selection is not preselected. Confirm the market and odds on the operator site.';
     }
   }).catch(()=>{});
  $('selectionDialog').classList.remove('hidden');$('closeSelection').focus();
 }
 function closeSelection(){state.routingRequest++;$('selectionDialog').classList.add('hidden')}
 $('closeSelection').onclick=closeSelection;
 $('selectionDialog').onclick=e=>{if(e.target===$('selectionDialog'))closeSelection()};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSelection()});
 function chooseEvent(eid){const entry=state.allEvents.find(x=>x.eventId===eid);if(!entry)return;state.chosen=entry;$('matchDropdown').value=String(eid);const e=entry.e;$('shareMatchLink').disabled=true;$('shareMatchStatus').textContent='Sharing becomes available when both operators have comparable prices.';$('eventTitle').textContent=eventName(e);$('eventMeta').textContent=(state.kind==='live'?'🔴 LIVE · ':'')+(text(e.tournament)||$('leagueSelect').selectedOptions[0]?.text||'')+' · '+dateLabel(e.start)+' · 1xBet';
  const fullTime=allOdds(e).filter(x=>x.section==='Full match');const odds=[];for(let i=1;i<=3;i++){const candidates=fullTime.filter(x=>Number(x.type)===i&&(!x.parameter||Number(x.parameter)===0));const found=candidates.length&&candidates.every(x=>Number(x.oddsMarket)===Number(candidates[0].oddsMarket))?candidates[0]:null;odds.push(found)}
  if(Number(e.sportId)!==1){odds.splice(0,odds.length,...fullTime.slice(0,3));while(odds.length<3)odds.push(null);}const names=Number(e.sportId)===1?['Home','Draw','Away']:['Market 1','Market 2','Market 3'];$('eventMarketLabel').textContent=Number(e.sportId)===1?'Match result · 1X2':'Available event prices';$('refreshLive').classList.toggle('hidden',state.kind!=='live');$('autoLiveToggle').classList.toggle('hidden',state.kind!=='live');const grid=$('oddsGrid');grid.replaceChildren();odds.forEach((o,i)=>{const box=mk(o?'a':'div','price-card'+(o?' selectable':' missing'));if(o){box.href=operatorHref('1xBet',eid,state.kind);box.target='_blank';box.rel='noopener noreferrer';box.title='Open 1xBet; confirm this match and price on the operator site';box.setAttribute('aria-label','Select '+names[i]+' at odds '+Number(o.oddsMarket).toFixed(2));}box.append(mk('span','slot',names[i]),mk('strong','',o?Number(o.oddsMarket).toFixed(2):'—'),mk('small','',Number(e.sportId)===1?(i===0?text(e.home):i===1?'Match result':text(e.away)):(o?'Code '+String(o.type):'Suspended / unavailable')));grid.append(box)});
  const when=detailCache.get(state.kind+':'+eid)?.when;$('freshness').textContent=when?'Retrieved '+new Date(when).toLocaleTimeString(): 'Timestamp unavailable';
  const valid=odds.filter(Boolean).length;$('comparisonNotice').textContent=Number(e.sportId)!==1?'1xBet provider price snapshot · market codes are not verified outcome names. Browse other markets for provider descriptions. Live prices may be suspended or change instantly.':valid===3?'1xBet '+(state.kind==='live'?'LIVE':'pre-match')+' price snapshot · one operator only. Not a multi-bookmaker comparison. Odds may change at the bookmaker.':`1xBet snapshot · ${valid} of 3 main 1X2 prices available. Missing values were not filled in. No bookmaker comparison yet.`;
  fetch('/.netlify/functions/betsson?op=status',{cache:'no-store'}).then(r=>r.json()).then(b=>{const el=$('betssonStatus');if(!el)return;el.textContent=b.feedStatus==='configured-not-verified'?'Betsson · feed infrastructure configured; operator prices and matching await live validation. No unverified odds shown.':'Betsson · odds comparison unavailable until feed access is configured. The partner link below opens Betsson; no match or bet is preselected.';}).catch(()=>{const el=$('betssonStatus');if(el)el.textContent='Betsson · feed status unavailable. No Betsson odds shown.';});
  $('routingNote').textContent=(state.kind==='live'?'LIVE odds change quickly. Refresh before reviewing; the operator can suspend a market at any time. ':'')+'Click a price to open its operator. A public operator page may open when no verified event link is available. Confirm the match, market and price; no bet is prefilled.';
  document.dispatchEvent(new CustomEvent('betcheap:snapshot',{detail:{eventId:String(eid),sportId:Number(e.sportId),event:eventName(e),competition:text(e.tournament)||$('leagueSelect').selectedOptions[0]?.text||'',start:String(e.start||''),capturedAt:when||null,source:'1xBet',outcomes:odds.map((o,i)=>({label:names[i],price:o&&Number.isFinite(Number(o.oddsMarket))&&Number(o.oddsMarket)>1?Number(o.oddsMarket):null}))}}));
  updateCloudbet(e,odds,eid);
  $('eventDetails').classList.remove('hidden');state.viewAll=false;$('allMarkets').classList.add('hidden');$('allMarketsBtn').setAttribute('aria-expanded','false');$('allMarketsBtn').textContent='Browse other markets ↓';
  const nowURL=new URL(location.href);nowURL.searchParams.set('kind',state.kind);nowURL.searchParams.set('tournamentId',state.league);nowURL.searchParams.set('eventId',String(eid));history.replaceState(null,'',nowURL);
  $('eventDetails').scrollIntoView({behavior:'smooth',block:'start'});
 }
 let cloudbetRequest=0;
 async function updateCloudbet(e,oneOdds,eid){
  const panel=$('cloudbetCompare'),message=$('cloudbetCompareText'),output=$('cloudbetCompareOdds');if(!panel)return;
  const request=++cloudbetRequest;panel.style.display='';output.replaceChildren();
  const selectedKind=state.kind;let verifiedCloudbetEventId='';
  const labels=['Home','Draw','Away'];const fields=['home','draw','away'];
  const renderTable=(cloudOdds=null)=>{
   output.replaceChildren();const table=mk('table','');table.style.cssText='width:100%;border-collapse:collapse;text-align:center;font-size:14px';
   const head=mk('tr');['Outcome','1xBet','Cloudbet','Higher snapshot'].forEach(t=>{const th=mk('th','',t);th.style.cssText='padding:8px;border-bottom:1px solid #456';head.append(th)});table.append(head);
   labels.forEach((label,i)=>{const row=mk('tr');const one=Number(oneOdds[i]?.oddsMarket);const cloud=Number(cloudOdds?.[fields[i]]);const a=Number.isFinite(one)&&one>1?one:null;const b=Number.isFinite(cloud)&&cloud>1?cloud:null;
    const winner=a!==null&&b!==null?(a>b?'1xBet':b>a?'Cloudbet':'Equal'):'Not comparable';
    [label,a===null?'—':a.toFixed(2),b===null?'—':b.toFixed(2),winner].forEach((val,j)=>{const td=mk('td','',((j===1&&a!==null)||(j===2&&b!==null))?'':val);td.style.cssText='padding:10px 6px;border-bottom:1px solid #456';if((j===1&&a!==null)||(j===2&&b!==null)){const operator=j===1?'1xBet':'Cloudbet';const btn=mk('a','secondary-action',val+' ↗');btn.href=operatorHref(operator,eid,selectedKind);btn.target='_blank';btn.rel=operator==='Cloudbet'?'sponsored noopener noreferrer':'noopener noreferrer';btn.style.cssText='min-width:74px;padding:8px';btn.title='Open '+operator+(operator==='Cloudbet'?' promotional page · partner link':' (event when available)')+'; confirm '+label+' and current odds';btn.setAttribute('aria-label','Review '+operator+' '+label+' at '+val);btn.onclick=event=>{if(state.chosen?.eventId!==eid||state.kind!==selectedKind)event.preventDefault();};td.append(btn)}if(j===3&&winner!=='Not comparable')td.style.fontWeight='700';row.append(td)});table.append(row)});output.append(table)
  };
  const renderCommon=quotes=>{
   if(!Array.isArray(quotes)||!window.BetCheapMarkets)return;
   const rows=window.BetCheapMarkets.intersect(e,quotes).filter(r=>r.period!=='ft'||r.market!=='result');
   const heading=mk('h3','', 'Other common markets · '+rows.length+' selections');output.append(heading);
   if(!rows.length){output.append(mk('p','','No other identical markets and lines are currently quoted by both operators.'));return}
   const table=mk('table');table.style.cssText='width:100%;text-align:center';
   const head=mk('tr');['Market / period / line','1xBet','Cloudbet','Higher snapshot'].forEach(t=>head.append(mk('th','',t)));table.append(head);
   for(const r of rows){const tr=mk('tr');tr.append(mk('td','',window.BetCheapMarkets.label(r)));
    for(const [operator,price] of [['1xBet',r.one],['Cloudbet',r.cloud]]){const td=mk('td'),a=mk('a','secondary-action',price.toFixed(2)+' ↗');a.href=operatorHref(operator,eid,selectedKind);a.target='_blank';a.rel=operator==='Cloudbet'?'sponsored noopener noreferrer':'noopener noreferrer';a.title=window.BetCheapMarkets.label(r)+' at '+operator;a.onclick=ev=>{if(state.chosen?.eventId!==eid||state.kind!==selectedKind)ev.preventDefault()};td.append(a);tr.append(td)}
    tr.append(mk('td','',r.one>r.cloud?'1xBet':r.one<r.cloud?'Cloudbet':'Equal'));table.append(tr);
   }output.append(table);
  };
  renderTable();
  if(Number(e.sportId)!==1){message.textContent='Cloudbet matching currently supports football markets. No other sport is claimed as compared.';return}
  if(!['prematch','live'].includes(selectedKind)||eventTimestamp(e.start)===null){message.textContent='No valid event time or comparison mode. Cloudbet comparison unavailable.';return}
  message.textContent='Looking for the same '+(selectedKind==='live'?'LIVE':'upcoming')+' match in Cloudbet…';
  const query=new URLSearchParams({op:'compare',sportId:'1',kind:selectedKind,home:text(e.home),away:text(e.away),league:text(e.tournament)||$('leagueSelect').selectedOptions[0]?.text||'',start:new Date(eventTimestamp(e.start)).toISOString()});
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch('/.netlify/functions/cloudbet?'+query,{cache:'no-store',signal:controller.signal});const result=await response.json();if(request!==cloudbetRequest||state.chosen?.eventId!==eid||state.kind!==selectedKind)return;
   if(!response.ok||result.ok!==true){const reasons={cloudbet_auth_rejected:'Cloudbet rejected the API key or permissions.',cloudbet_rate_limited:'Cloudbet API rate limit reached.',cloudbet_bad_request:'Cloudbet rejected the market or competition request.',cloudbet_timeout:'Cloudbet API timed out.',cloudbet_invalid_response:'Cloudbet returned an unexpected data structure.'};message.textContent=(reasons[result.error]||'Cloudbet feed unavailable.')+(result.stage?' Stage: '+result.stage+'.':'')+(result.upstreamStatus?' HTTP '+result.upstreamStatus+'.':'')+' 1xBet prices only; retry after API availability recovers.';return}
   if(!result.matched){const explanations={competition_not_verified:'Competition not found unambiguously in Cloudbet.',event_not_verified:'Same match, timing and trading status not verified in Cloudbet.',individual_event_mismatch:'Single-event details disagree with the expected match; comparison blocked.',full_time_1x2_unavailable:'Matched game has no complete tradable full-time 1X2 market.',not_upcoming:'Event is no longer prematch.',not_in_live_window:'Event falls outside the LIVE validation window.'};const matchReasons={empty_competition:'Cloudbet returned no fixtures in this competition.',team_names_unavailable:'Cloudbet fixture names are unavailable in the expected format.',team_pair_not_found:'Cloudbet has no verified matching home/away team pair in this competition.',start_time_mismatch:'The matching teams have a different or unavailable kickoff time in Cloudbet.',trading_status_mismatch:'Cloudbet has not marked this fixture as tradable in the selected mode.',ambiguous_event:'Cloudbet lists multiple matching fixtures; a unique match cannot be confirmed.'};message.textContent=(matchReasons[result.diagnostic?.matchFailure]||explanations[result.reason]||'No verified same-match Cloudbet offer.')+' No second quote is shown.';return}
   verifiedCloudbetEventId=String(result.cloudbetEventId||'');renderTable(result.odds);renderCommon(result.markets);if(fields.some((field,i)=>Number.isFinite(Number(oneOdds[i]?.oddsMarket))&&Number(oneOdds[i]?.oddsMarket)>1&&Number.isFinite(Number(result.odds?.[field]))&&Number(result.odds?.[field])>1)||(window.BetCheapMarkets&&window.BetCheapMarkets.intersect(e,result.markets||[]).length>0)){$('shareMatchLink').disabled=false;$('shareMatchStatus').textContent='Share this match. Prices will be checked again when the link is opened.';document.dispatchEvent(new CustomEvent('betcheap:comparison'));}const oneTime=detailCache.get(selectedKind+':'+eid)?.when;message.textContent='VERIFIED SAME MATCH ('+selectedKind+') · 1xBet retrieved '+(oneTime?new Date(oneTime).toLocaleTimeString():'unknown')+' · Cloudbet received '+new Date(result.checkedAt).toLocaleTimeString()+'. Cloudbet affiliate odds can lag up to 60 seconds. Snapshots are not synchronized or guaranteed available.';
  }catch(err){if(request===cloudbetRequest&&state.chosen?.eventId===eid&&state.kind===selectedKind)message.textContent=err.name==='AbortError'?'Cloudbet comparison timed out after 45s — 1xBet odds only. Retry this match later.':'Cloudbet request failed — 1xBet snapshot only. No invented odds.';}finally{clearTimeout(timer)}
 }
 function groupMarket(x,football=true){const verified=football&&x.section==='Full match'?trustedTypes[Number(x.type)]:null;return {group:verified?verified[0]:(text(x.name)||text(x.display)?'Provider-named markets':'Unverified markets'),title:verified?verified[1]:(text(x.name)||text(x.display)||`Market code ${String(x.type??'?')}`),verified:!!verified};}
 $('allMarketsBtn').onclick=()=>{if(!state.chosen)return;state.viewAll=!state.viewAll;$('allMarkets').classList.toggle('hidden',!state.viewAll);$('allMarketsBtn').setAttribute('aria-expanded',String(state.viewAll));$('allMarketsBtn').textContent=state.viewAll?'Hide other markets ↑':'Browse other markets ↓';if(!state.viewAll)return;
  const host=$('allMarkets');host.replaceChildren();const a=allOdds(state.chosen.e);const groups=new Map();for(const x of a){const m=groupMarket(x,Number(state.chosen.e.sportId)===1);const key=x.section+' · '+m.group;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({x,m})}host.append(mk('p','fine-print',a.length+' actual price entries returned · not necessarily unique markets. Unverified types are labelled by code.'));
  for(const [title,items] of groups){const group=mk('div','market-block');group.append(mk('h4','',title+' ('+items.length+')'));const grid=mk('div','market-pills');for(const {x,m} of items){const pill=mk('button','market-pill selectable');pill.type='button';pill.setAttribute('aria-label','Review '+m.title+' at '+Number(x.oddsMarket).toFixed(2));pill.onclick=()=>openSelection(x,m.title+(x.parameter!==null&&x.parameter!==undefined?' ('+x.parameter+')':'')+(m.verified?'':' · unverified type '+String(x.type??'?')),x.section+' / '+m.group);const labels=mk('span');let line=x.parameter!==null&&x.parameter!==undefined&&String(x.parameter)!==''?' ('+x.parameter+')':'';labels.append(mk('span','',m.title+line));if(!m.verified)labels.append(mk('small','','Code '+String(x.type??'?')+' · unverified'));pill.append(labels,mk('b','',Number(x.oddsMarket).toFixed(2)));grid.append(pill)}group.append(grid);host.append(group)}
 };
 $('shareMatchLink').onclick=async()=>{
  if(!state.chosen||$('shareMatchLink').disabled)return;
  const url=new URL('/compare',location.href);
  for(const [key,value] of Object.entries({kind:state.kind,sportId:$('sportSelect').value,tournamentId:state.league,eventId:String(state.chosen.eventId)}))url.searchParams.set(key,value);
  const ref=new URL(location.href).searchParams.get('ref');if(['betcheap_x','championz'].includes(ref))url.searchParams.set('ref',ref);
  try{await navigator.clipboard.writeText(url.toString());$('shareMatchStatus').textContent='Match link copied. Odds are checked again when opened.'}
  catch{$('shareMatchStatus').textContent='Copy this match link: '+url.toString()}
 };
 $('changeMatch').onclick=()=>{$('eventDetails').classList.add('hidden');$('results').scrollIntoView({behavior:'smooth',block:'start'})};
 // Optional browser-side OCR. Never auto-select a match from OCR text.
 let ocrPromise=null;
 function loadOcr(){if(window.Tesseract)return Promise.resolve(window.Tesseract);if(ocrPromise)return ocrPromise;ocrPromise=new Promise((resolve,reject)=>{const el=document.createElement('script');el.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';el.async=true;el.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR unavailable'));el.onerror=()=>reject(Error('OCR library blocked or unavailable'));document.head.append(el)});return ocrPromise}
 function extractMatch(ocr){const lines=String(ocr).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);let line=lines.find(s=>/[\p{L}]{2}/u.test(s)&&(/\bvs?\.?\b|\bversus\b|\s[-–—]\s/i).test(s)&&s.length<110);if(line)return line.replace(/^(match|event|fixture)\s*[:=-]?\s*/i,'').replace(/\s+/g,' ').trim();const idx=lines.findIndex(s=>/^(event|match|fixture)\s*[:]/i.test(s));return idx>=0?lines[idx].replace(/^(event|match|fixture)\s*[:]\s*/i,'').trim():''}
 async function scanFile(file){if(!file)return;if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>8*1024*1024){setStatus('Choose a JPG, PNG or WEBP screenshot under 8 MB.','warning');return}const view=$('scanResult');view.classList.remove('hidden');$('detectedQuery').value='';$('useDetected').disabled=true;$('scanState').textContent='Reading screenshot…';$('scanHint').textContent='OCR is processed on this device; large images may take a moment.';
  if(state.scanURL)URL.revokeObjectURL(state.scanURL);state.scanURL=URL.createObjectURL(file);$('scanImg').src=state.scanURL;
  try{const ocr=await loadOcr();const result=await ocr.recognize(file,'eng');const query=extractMatch(result?.data?.text||'');$('detectedQuery').value=query;$('scanState').textContent=query?'Possible match detected':'No reliable match identified';$('scanHint').textContent=query?'Check and edit the exact team names; the next step lists real matches for confirmation.':'Type the match manually below; OCR cannot guarantee a correct match.';$('useDetected').disabled=false;
  }catch(e){$('scanState').textContent='Screenshot recognition unavailable';$('scanHint').textContent='Please type the match manually. '+e.message;$('useDetected').disabled=false;}
 }
 $('slipInput').onchange=e=>scanFile(e.target.files?.[0]);$('dropzone').ondragover=e=>{e.preventDefault();$('dropzone').classList.add('dragging')};$('dropzone').ondragleave=()=>$('dropzone').classList.remove('dragging');$('dropzone').ondrop=e=>{e.preventDefault();$('dropzone').classList.remove('dragging');scanFile(e.dataTransfer.files?.[0])};
 $('useDetected').onclick=()=>{const query=$('detectedQuery').value.trim();if(!query){setStatus('Enter the match name before continuing.','warning');$('detectedQuery').focus();return}showTab('search');$('teamQuery').value=query;state.query=query;state.visible=8;matchList();setStatus('Recognized text is only a suggestion. Select the competition, tap Show matches and confirm the exact fixture.');$('leagueSelect').focus();};
 $('privacyBtn').onclick=()=>$('privacyDialog').classList.remove('hidden');$('closePrivacy').onclick=$('privacyOk').onclick=()=>$('privacyDialog').classList.add('hidden');$('privacyDialog').onclick=e=>{if(e.target===$('privacyDialog'))$('privacyDialog').classList.add('hidden')};document.addEventListener('keydown',e=>{if(e.key==='Escape')$('privacyDialog').classList.add('hidden')});
 const kindButtons={prematch:$('modePrematch'),live:$('modeLive')};
 async function switchKind(kind){if(!['live','prematch'].includes(kind)||kind===state.kind)return;state.request++;sportRequest++;state.kind=kind;cancelAndClear();detailCache.clear();for(const [value,button] of Object.entries(kindButtons)){button.classList.toggle('active',value===kind);button.setAttribute('aria-pressed',String(value===kind));}const url=new URL(location.href);url.searchParams.set('kind',kind);url.searchParams.delete('eventId');url.searchParams.delete('tournamentId');history.replaceState(null,'',url);setStatus(kind==='live'?'Loading live sports and competitions…':'Loading upcoming sports and competitions…');await loadSports();}
 $('modePrematch').onclick=()=>switchKind('prematch');$('modeLive').onclick=()=>switchKind('live');
 // AUTO LIVE checks while the tab is visible, approximately once per minute. Cloudbet feed may lag 60 seconds.
 let autoLiveEnabled=true;
 function showAutoLive(){const b=$('autoLiveToggle');b.textContent=autoLiveEnabled?'● Auto LIVE ON (60s)':'○ Auto LIVE OFF';b.setAttribute('aria-pressed',String(autoLiveEnabled));}
 $('autoLiveToggle').onclick=()=>{autoLiveEnabled=!autoLiveEnabled;showAutoLive();setStatus(autoLiveEnabled?'Auto LIVE updates enabled while this tab is visible.':'Auto LIVE updates paused.','good')};showAutoLive();
 setInterval(()=>{if(!autoLiveEnabled||state.kind!=='live'||!state.chosen||document.visibilityState!=='visible'||$('refreshLive').disabled||$('eventDetails').classList.contains('hidden')||!$('selectionDialog').classList.contains('hidden'))return;$('refreshLive').click();},60000);
 $('refreshLive').onclick=async()=>{if(state.kind!=='live'||!state.chosen)return;const old=state.chosen.eventId;detailCache.delete('live:'+old);const token=state.request;const button=$('refreshLive');button.disabled=true;try{const fresh=await detail(old);if(token!==state.request||state.kind!=='live')return;if(!fresh){detailCache.delete('live:'+old);state.chosen=null;$('eventDetails').classList.add('hidden');$('allMarkets').classList.add('hidden');closeSelection();setStatus('LIVE event no longer available from the live API. Odds were hidden to prevent stale prices. Choose another live event.','warning');return;}state.chosen.e=fresh;const item=state.allEvents.find(x=>x.eventId===old);if(item)item.e=fresh;chooseEvent(old);setStatus('LIVE quote refreshed from 1xBet; prices may change immediately.','good');}catch(err){if(token===state.request&&state.kind==='live'){detailCache.delete('live:'+old);state.chosen=null;$('eventDetails').classList.add('hidden');$('allMarkets').classList.add('hidden');closeSelection();setStatus('LIVE refresh failed; previous odds were hidden to avoid displaying an unverified quote. Choose the match again.','warning')}}finally{button.disabled=false}};
 const startingKind=new URL(location.href).searchParams.get('kind');if(startingKind==='live'){state.kind='live';kindButtons.live.classList.add('active');kindButtons.prematch.classList.remove('active');kindButtons.live.setAttribute('aria-pressed','true');kindButtons.prematch.setAttribute('aria-pressed','false');}
 showTab('search');
 loadSports();
})();
