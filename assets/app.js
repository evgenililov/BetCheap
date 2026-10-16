const $=s=>document.querySelector(s); const cfg=window.BETCHEAP_CONFIG;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function money(x){return `€${Math.abs(Number(x)).toFixed(0)}`}
function setStatus(t,kind=''){const e=$('#liveStatus');e.textContent=t;e.className=`live-status ${kind}`}
function fillLeagues(){ $('#leagueSelect').innerHTML=cfg.leagues.map(([v,n])=>`<option value="${v}">${n}</option>`).join('') }
let activeEvent=null, activeSelection=null, liveMeta=null, searchGeneration=0;
const LOCAL_CACHE_TTL=5*60*1000;
function cacheKey(sport,region){return `betcheap_v210_odds_${sport}_${region}`}
function readLocalOdds(sport,region){try{const x=JSON.parse(localStorage.getItem(cacheKey(sport,region))||'null');if(x&&Number.isFinite(x.savedAt)&&Date.now()>=x.savedAt&&Date.now()-x.savedAt<LOCAL_CACHE_TTL)return x.data}catch{}return null}
function writeLocalOdds(sport,region,data){try{localStorage.setItem(cacheKey(sport,region),JSON.stringify({savedAt:Date.now(),data}))}catch{}}
function findEvent(events,q){
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const stop=new Set(['win','draw','vs','versus','the','to']);
  const terms=norm(q).split(/\s+/).filter(x=>x.length>2&&!stop.has(x));
  if(!terms.length)return null;
  let best=null,bestScore=-1;
  for(const e of events){
    const home=norm(e.home),away=norm(e.away),both=home+' '+away;
    const matched=terms.filter(t=>both.includes(t));
    const coverage=matched.length/terms.length;
    const homeHits=terms.filter(t=>home.includes(t)).length;
    const awayHits=terms.filter(t=>away.includes(t)).length;
    const bothSides=homeHits>0&&awayHits>0;
    const score=coverage*100+(bothSides?25:0)+(norm(q).includes(home)&&norm(q).includes(away)?50:0);
    if(score>bestScore){bestScore=score;best=e}
  }
  // OCR match-first searches must match most query terms and, for multi-team queries, both sides.
  const multiTeam=terms.length>=2;
  if(!best)return null;
  const bh=norm(best.home),ba=norm(best.away),bb=bh+' '+ba;
  const coverage=terms.filter(t=>bb.includes(t)).length/terms.length;
  const bothSides=terms.some(t=>bh.includes(t))&&terms.some(t=>ba.includes(t));
  return coverage>=0.75&&(!multiTeam||bothSides)?best:null;
}
function chooseSelection(selection){$('#result').classList.add('hidden');activeSelection=selection;document.querySelectorAll('.outcome-btn').forEach(b=>b.classList.toggle('selected',b.dataset.selection===selection));$('#setupError').textContent='';$('#currentOdds').focus()}
function showBetSetup(ev,q){activeEvent=ev;activeSelection=null;$('#setupTitle').textContent=`${ev.home} vs ${ev.away}`;const outcomes=[{label:'1',name:ev.home},{label:'X',name:'Draw'},{label:'2',name:ev.away}];$('#outcomeButtons').innerHTML=outcomes.map(o=>`<button class="outcome-btn" data-selection="${esc(o.name)}"><b>${o.label}</b><span>${esc(o.name)}</span></button>`).join('');document.querySelectorAll('.outcome-btn').forEach(b=>b.onclick=()=>chooseSelection(b.dataset.selection));const ql=q.toLowerCase();if(ql.includes(ev.home.toLowerCase()))chooseSelection(ev.home);else if(ql.includes(ev.away.toLowerCase()))chooseSelection(ev.away);$('#currentOdds').value='';$('#betSetup').classList.remove('hidden');$('#result').classList.add('hidden');$('#betSetup').scrollIntoView({behavior:'smooth',block:'center'})}
function decimalValue(v){const s=String(v??'').trim().replace(/\s/g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:NaN}
function getStake(){const v=decimalValue($('#stakeInput')?.value||100);return Number.isFinite(v)&&v>0?v:100}
function syncStake(v,fromRange=false){$('#result').classList.add('hidden');v=Math.max(.01,decimalValue(v)||100);$('#stakeInput').value=String(v);$('#stakeValue').textContent=`€${v.toLocaleString(undefined,{maximumFractionDigits:2})}`;if(!fromRange){$('#stakeRange').value=String(Math.min(1000,Math.max(1,v)))} }
function initStake(){const range=$('#stakeRange'),input=$('#stakeInput');if(!range||!input)return;range.oninput=()=>syncStake(range.value,true);input.oninput=()=>syncStake(input.value,false);document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>syncStake(b.dataset.stake));let saved=null;try{saved=JSON.parse(localStorage.getItem('betcheap_saved_bet')||'null')}catch{};if(saved?.stake)syncStake(saved.stake)}
function rememberBet(){if(!activeEvent||!activeSelection){$('#setupError').textContent='Choose your match and outcome first.';return}const data={home:activeEvent.home,away:activeEvent.away,selection:activeSelection,odds:decimalValue($('#currentOdds').value)||null,stake:getStake(),region:$('#regionSelect').value,league:$('#leagueSelect').value,savedAt:Date.now()};localStorage.setItem('betcheap_saved_bet',JSON.stringify(data));const b=$('#rememberBtn');b.textContent='✓ BET REMEMBERED';b.classList.add('saved-flash');setTimeout(()=>{b.textContent='♡ REMEMBER MY BET';b.classList.remove('saved-flash')},1800)}
function compareMyOdds(scroll=true){
  $('#result').classList.add('hidden');
  if(!activeEvent)return;
  if(!activeSelection){$('#setupError').textContent='Choose 1, X or 2 first.';return}
  const mine=decimalValue($('#currentOdds').value);
  if(!Number.isFinite(mine)||mine<=1){$('#setupError').textContent='Enter valid decimal odds, for example 1.84.';return}
  const comparison=window.BetcheapComparison.inspect(activeEvent,activeSelection,liveMeta);
  const rows=comparison.rows;
  if(rows.length<2){$('#setupError').textContent=comparison.message;return}
  $('#setupError').textContent='';
  const best=rows[0], stake=getStake(), delta=(best.price-mine)*stake;
  if(!Number.isFinite(delta)||!Number.isFinite(best.price*stake)){$('#setupError').textContent='Amount is too large to calculate accurately.';return}
  const better=delta>0, equal=Math.abs(delta)<0.000001;
  $('#marketTitle').textContent=`${activeEvent.home} vs ${activeEvent.away} — ${activeSelection}`;
  $('#yourPriceLine').textContent=`Your odds ${mine.toFixed(2)} → Best shown ${best.price.toFixed(2)}`;
  $('#gap').textContent=better?`+${money(delta)}`:equal?'€0':`-${money(delta)}`;
  $('#gap').classList.toggle('negative',!better);
  $('#gapLabel').textContent=better?`potential return on €${stake.toLocaleString()} vs your odds`:equal?`same potential return on €${stake.toLocaleString()}`:`your current price gives ${money(-delta)} more potential return on €${stake.toLocaleString()}`;
  $('#resultTag').textContent=better?'BETTER PRICE FOUND':equal?'HIGHEST SHOWN MATCHED':'YOUR PRICE IS HIGHER';
  $('#routeText').textContent=better?`${best.book}: +${money(delta)} potential return if the bet wins`:equal?'Your price matches the best shown':`Your ${mine.toFixed(2)} is higher than the highest compared price ${best.price.toFixed(2)}`;
  $('#routeSub').textContent=`Stake €${stake.toLocaleString()} • ${mine.toFixed(2)} → ${best.price.toFixed(2)}`;
  const top=rows.slice(0,10);
  $('#oddsRows').innerHTML=top.map((r,i)=>{
    const region=liveMeta?.region||$('#regionSelect').value;
    const country=$('#countryCode').value.trim().toUpperCase();
    const route=window.BetcheapComparison.partnerLink(cfg,r.key,country,region);
    const diff=(r.price-mine)*stake, recommended=r.price===best.price;
    const label=recommended?' • Highest among compared':'';
    const action=route?`<a class="offer" href="${esc(route.url)}" rel="nofollow sponsored noopener" target="_blank">VIEW PARTNER</a>`:'<button disabled>LINK NOT ACTIVE</button>';
    const disclosure=route?`<small>${esc(route.disclosure)} <a href="${esc(route.termsUrl)}" target="_blank" rel="noopener">Terms</a> • Opens partner landing page; confirm event and price.</small>`:'';
    return `<div class="odd ${recommended?'best':''}"><div><span>${esc(r.book)}</span><small>${esc(r.name)}${label}</small><small>Updated ${esc(r.lastUpdate)}${diff>0?` • +${money(diff)} potential return`:''}</small>${disclosure}</div><strong>${r.price.toFixed(2)}</strong>${action}</div>`

  }).join('');
  $('#resultNotice').textContent=comparison.message+' '+window.BetcheapDataStatus.inspect(liveMeta).message;
  $('#result').classList.remove('hidden');if(scroll)$('#result').scrollIntoView({behavior:'smooth'});
}
async function checkLive(){resetBetState();const generation=searchGeneration;const q=$('#betInput').value.trim();if(!q){setStatus('Type a team or match first.','error');return}const sport=$('#leagueSelect').value,region=$('#regionSelect').value;$('#checkBtn').disabled=true;$('#checkBtn').textContent='SEARCHING…';setStatus('Loading current matches and prices…');try{let d=readLocalOdds(sport,region),source='cached';if(!d){const r=await fetch(`${cfg.liveEndpoint}?sport=${encodeURIComponent(sport)}&region=${encodeURIComponent(region)}`);d=await r.json();if(!r.ok)throw new Error(d.error||'Live odds unavailable');if(!['invalid','demo'].includes(window.BetcheapDataStatus.inspect(d).state))writeLocalOdds(sport,region,d);source='live'}if(generation!==searchGeneration)return;renderDataProvenance(d);if(['invalid','demo'].includes(window.BetcheapDataStatus.inspect(d).state))throw new Error('Current data is unavailable: invalid or demonstration response.');const ev=findEvent(d.events||[],q);if(!ev){setStatus(`No matching event found in ${$('#leagueSelect').selectedOptions[0].text}. Try a team name or another league.`,'error');return}liveMeta=d;showBetSetup(ev,q);const age=d.fetchedAt?Math.max(0,Math.round((Date.now()-new Date(d.fetchedAt).getTime())/60000)):0;setStatus(`Match found • ${d.region.toUpperCase()} feed • ${source==='cached'?`cached ${age}m ago`:'provider response (may be cached)'}`,'ok')}catch(e){if(generation===searchGeneration)setStatus(e.message,'error')}finally{$('#checkBtn').disabled=false;$('#checkBtn').textContent='FIND MATCH'}}
fillLeagues();$('#checkBtn').onclick=checkLive;$('#compareBtn').onclick=()=>compareMyOdds();$('#betInput').addEventListener('keydown',e=>{if(e.key==='Enter')checkLive()});$('#currentOdds').addEventListener('keydown',e=>{if(e.key==='Enter')compareMyOdds()});
const gate=$('#ageGate');if(localStorage.getItem('betcheap_age_ok')==='1')gate.classList.add('hidden');$('#enterBtn').onclick=()=>{localStorage.setItem('betcheap_age_ok','1');gate.classList.add('hidden')};$('#exitBtn').onclick=()=>location.href='about:blank';
const copy={affiliate:`<h2>Affiliate Disclosure</h2><p>BETCHEAP may receive compensation when a user follows an approved partner link and completes a qualifying action. This does not change the displayed comparison methodology. Prices are ranked by decimal odds, independently of commissions. Only pre-match football 1X2 prices with all three outcomes and market timestamps within five minutes are compared. Exchange prices are excluded because commission and liquidity are not verified. At least two bookmakers are required. Operators without an approved link remain disabled.</p>`,privacy:`<h2>Privacy</h2><p>No BETCHEAP account is required in this version. Age-confirmation status is stored locally in your browser. Search requests are sent to our serverless comparison endpoint; the private odds-provider key is never exposed to the browser.</p>`,terms:`<h2>Terms</h2><p>BETCHEAP provides informational comparisons only. We do not guarantee odds, availability, eligibility, outcomes, winnings or financial benefit. Users are responsible for checking operator terms and local law. No wager is executed by BETCHEAP.</p>`};
document.querySelectorAll('[data-modal]').forEach(b=>b.onclick=()=>{$('#modalContent').innerHTML=copy[b.dataset.modal];$('#modal').classList.remove('hidden')});$('#closeModal').onclick=()=>$('#modal').classList.add('hidden');

// Bet slip screenshot recognition — OCR runs in the user's browser, not in a Netlify Function.
let detectedSlip=null;
function resetBetState(){searchGeneration++;renderDataProvenance(null);activeEvent=null;activeSelection=null;liveMeta=null;$('#betSetup').classList.add('hidden');$('#result').classList.add('hidden');$('#setupTitle').textContent='Choose outcome';$('#outcomeButtons').innerHTML='';$('#currentOdds').value='';$('#setupError').textContent='';}
function parseSlipText(text){
  const clean=String(text||'').replace(/\r/g,'\n');
  const lines=clean.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const moneyWords=/\b(stake|wager|bet amount|amount|return|returns|potential return|payout|win|winnings|balance|cash|deposit|withdraw|total|bonus|profit)\b/i;
  const oddsWords=/\b(odds?|price|decimal odds?|coef(?:ficient)?|коеф(?:ициент)?|коэффициент)\b/i;
  const selectionWords=/\b(selection|pick|prediction|market|outcome|your bet)\b/i;
  const eventWords=/\b(event|match|fixture|game)\b/i;
  const currency=/[€£$]|\b(EUR|USD|GBP|BGN)\b/i;
  const timeDate=/\b\d{1,2}:\d{2}\b|\b\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?\b/;
  const numRe=/(?<![\d])([1-9]\d?(?:[\.,]\d{1,3})?)(?![\d])/g;
  function numbers(line){return [...line.matchAll(numRe)].map(m=>Number(m[1].replace(',','.'))).filter(n=>Number.isFinite(n)&&n>=1.01&&n<100)}
  let odds=null, oddsConfidence=0, oddsLine='';
  // Prefer a number explicitly labelled as odds/price. Never use monetary lines as odds.
  for(const line of lines){
    if(moneyWords.test(line)||currency.test(line)) continue;
    const nums=numbers(line); if(!nums.length) continue;
    if(oddsWords.test(line)){odds=nums[nums.length-1];oddsConfidence=0.98;oddsLine=line;break}
  }
  // Fallback: standalone decimal number on a non-monetary line, with conservative range.
  if(!odds){
    for(const line of lines){
      if(moneyWords.test(line)||currency.test(line)||timeDate.test(line)) continue;
      const nums=numbers(line).filter(n=>n>=1.01&&n<=25&&/[\.,]\d{2,3}/.test(line));
      if(nums.length===1){odds=nums[0];oddsConfidence=0.62;oddsLine=line;break}
    }
  }
  const noise=/bet slip|booking|receipt|sportsbook|single|acca|parlay|cash out|placed|open bets?/i;
  const textCandidates=lines.filter(x=>x.length>=2&&x.length<=90&&/[A-Za-zÀ-žА-Яа-я]/.test(x)&&!moneyWords.test(x)&&!currency.test(x)&&!oddsWords.test(x)&&!noise.test(x)&&!timeDate.test(x));
  let query='', queryConfidence=0;
  const labelledEvent=lines.find(x=>eventWords.test(x)&&/[A-Za-zÀ-žА-Яа-я]/.test(x.replace(eventWords,'')));
  const versus=textCandidates.find(x=>/\b(vs?\.?|versus)\b|\s[-–—]\s/i.test(x));
  if(labelledEvent){query=labelledEvent.replace(eventWords,'').replace(/^\s*[:\-–—]\s*/,'').trim();queryConfidence=0.96}
  else if(versus){query=versus.replace(/\s+/g,' ');queryConfidence=0.92}
  else if(textCandidates.length>=2){query=textCandidates.slice(0,2).join(' vs ');queryConfidence=0.58}
  else if(textCandidates.length){query=textCandidates[0];queryConfidence=0.45}
  let selection='', selectionConfidence=0;
  for(let i=0;i<lines.length;i++){
    if(!selectionWords.test(lines[i])) continue;
    let v=lines[i].replace(selectionWords,'').replace(/^\s*[:\-–—]\s*/,'').trim();
    if(!v && lines[i+1]) v=lines[i+1].trim();
    if(v && /[A-Za-zÀ-žА-Яа-я]/.test(v) && !moneyWords.test(v)){selection=v;selectionConfidence=0.9;break}
  }
  // If no label, infer common 1X2 selection only when it clearly matches one side or Draw.
  if(!selection && query){
    const parts=query.split(/\bvs?\.?\b|\s[-–—]\s/i).map(x=>x.trim()).filter(Boolean);
    const draw=lines.find(x=>/^draw$/i.test(x));
    if(draw){selection='Draw';selectionConfidence=0.82}
    else for(const part of parts){const hit=lines.find(x=>x.toLowerCase()===part.toLowerCase());if(hit){selection=part;selectionConfidence=0.72;break}}
  }
  const confidence=Math.round(100*Math.min(queryConfidence||0, oddsConfidence||0, selection?selectionConfidence:0.55));
  return {query,selection,odds,confidence,queryConfidence,selectionConfidence,oddsConfidence,oddsLine,text:clean};
}
async function preprocessSlip(file){
  const bmp=await createImageBitmap(file);
  const maxW=1800, scale=Math.max(1,Math.min(3,maxW/bmp.width));
  const c=document.createElement('canvas'); c.width=Math.round(bmp.width*scale); c.height=Math.round(bmp.height*scale);
  const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(bmp,0,0,c.width,c.height);
  const im=x.getImageData(0,0,c.width,c.height), d=im.data;
  // High-contrast grayscale helps OCR on dark sportsbook UIs and iPhone screenshots.
  for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];const v=g>155?255:(g<75?0:Math.round((g-75)*255/80));d[i]=d[i+1]=d[i+2]=v}
  x.putImageData(im,0,0); return c;
}
function ocrQuality(text){
  const t=String(text||''); let q=0;
  if(/\b(vs?\.?|versus|draw|odds?|price|selection|event|match)\b/i.test(t))q+=3;
  if(/[A-Za-z]{4,}/.test(t))q+=2;
  if(/\b\d+[\.,]\d{2,3}\b/.test(t))q+=3;
  q+=Math.min(4,(t.match(/[A-Za-z]{3,}/g)||[]).length/3); return q;
}
async function scanSlip(file){
  if(!file)return;
  resetBetState(); detectedSlip=null; setStatus('Reading screenshot…');
  $('#scanPreview').classList.remove('hidden'); $('#useScanBtn').classList.add('hidden'); $('#useScanBtn').disabled=true; $('#useScanBtn').textContent='USE DETECTED MATCH';
  $('#slipPreview').src=URL.createObjectURL(file); $('#scanStatus').textContent='Optimizing screenshot…'; $('#scanExtract').textContent='OCR runs locally in this browser. No image is uploaded to BETCHEAP.';
  try{
    if(!window.Tesseract) throw new Error('OCR library could not load.');
    let source=file; try{source=await preprocessSlip(file)}catch{}
    const opts={logger:m=>{if(m.status==='recognizing text')$('#scanStatus').textContent=`Reading screenshot… ${Math.round((m.progress||0)*100)}%`;}};
    // First pass: processed high-contrast image. If weak, retry the original image.
    let r=await Tesseract.recognize(source,'eng',opts), best=r.data.text||'';
    if(ocrQuality(best)<5){
      $('#scanStatus').textContent='Improving recognition…';
      const r2=await Tesseract.recognize(file,'eng',opts);
      if(ocrQuality(r2.data.text)>ocrQuality(best))best=r2.data.text||'';
    }
    detectedSlip=parseSlipText(best);
    const bits=[]; if(detectedSlip.query)bits.push(`Event: ${detectedSlip.query}`); if(detectedSlip.selection)bits.push(`Selection: ${detectedSlip.selection}`); if(detectedSlip.odds)bits.push(`Odds: ${detectedSlip.odds.toFixed(2)}`); bits.push(`Confidence: ${detectedSlip.confidence}%`);
    const eventReliable=Boolean(detectedSlip.query && detectedSlip.queryConfidence>=0.75);
    const fullReliable=Boolean(eventReliable && detectedSlip.odds && detectedSlip.confidence>=60);
    $('#scanStatus').textContent=fullReliable?'Bet detected — confirm before comparing':eventReliable?'Match detected — choose your outcome and confirm odds':'Could not identify a reliable match';
    $('#scanExtract').textContent=(bits.join('\n')||'Try a tighter crop around the event, selection and odds, or use manual search.')+'\n\nRecognized text:\n'+detectedSlip.text.slice(0,600);
    if(eventReliable){$('#useScanBtn').classList.remove('hidden');$('#useScanBtn').disabled=false;$('#useScanBtn').textContent=fullReliable?'USE DETECTED BET':'USE DETECTED MATCH'}
    else { $('#useScanBtn').classList.add('hidden'); $('#useScanBtn').disabled=true; }
  }catch(e){$('#scanStatus').textContent='Scan failed';$('#scanExtract').textContent=e.message+' Try a tighter crop or use manual search.'}
}
$('#slipInput').addEventListener('change',e=>scanSlip(e.target.files?.[0]));
$('#useScanBtn').onclick=async()=>{
  if(!detectedSlip?.query || detectedSlip.queryConfidence<0.75)return;
  resetBetState();
  $('#betInput').value=detectedSlip.query;
  await checkLive();
  if(!activeEvent)return;
  if(detectedSlip.selection){const names=[activeEvent.home,'Draw',activeEvent.away];const wanted=names.find(n=>n.toLowerCase()===detectedSlip.selection.toLowerCase()||n.toLowerCase().includes(detectedSlip.selection.toLowerCase())||detectedSlip.selection.toLowerCase().includes(n.toLowerCase()));if(wanted)chooseSelection(wanted)}
  if(detectedSlip.odds && detectedSlip.oddsConfidence>=0.6)$('#currentOdds').value=detectedSlip.odds.toFixed(2);
  setStatus(`Match confirmed • choose 1 / X / 2 and confirm your bookmaker odds.`,'ok');
  $('#betSetup').scrollIntoView({behavior:'smooth',block:'center'});
};

if($('#rememberBtn')) $('#rememberBtn').onclick=rememberBet; initStake();

// Display source timestamps independently of retrieval/cache timestamps.
let provenanceData=null;
function renderDataProvenance(data){
  provenanceData=data;
  const panel=$('#dataProvenance');
  if(!data){panel.textContent='No data loaded for the current search.';panel.dataset.state='empty';return}
  const info=window.BetcheapDataStatus.inspect(data);
  panel.textContent=info.message;panel.dataset.state=info.state;
}
for(const id of ['#leagueSelect','#regionSelect'])$(id).addEventListener('change',()=>{resetBetState();setStatus('Search again for the selected league and feed.');});

setInterval(()=>{if(provenanceData){const info=window.BetcheapDataStatus.inspect(provenanceData);$('#dataProvenance').textContent=info.message;$('#dataProvenance').dataset.state=info.state;if(liveMeta&&!$('#result').classList.contains('hidden'))compareMyOdds(false)}},60000);

$('#countryCode').addEventListener('change',()=>{if(activeSelection&&!$('#result').classList.contains('hidden'))compareMyOdds(false)});

for(const selector of ['#currentOdds','#stakeInput','#stakeRange'])$(selector).addEventListener('input',()=>$('#result').classList.add('hidden'));
