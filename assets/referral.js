/* Optional, first-party campaign measurement. No operator attribution is claimed. */
(()=>{
 'use strict';
 const key='betcheap_referral_session_v1',campaign=new URL(location.href).searchParams.get('ref');
 const campaigns={championz:'Champion Z',betcheap_x:'BetCheap on X'};
 const known=value=>Object.hasOwn(campaigns,value);
 let saved=null,active=null,stopped=false,starting=false;
 try{saved=JSON.parse(sessionStorage.getItem(key))}catch{}
 if(saved?.expires>Date.now()&&known(saved.campaign))active=saved;
 if(known(campaign)&&active&&active.campaign!==campaign)active=null;
 if(!known(campaign)&&!active)return;
 const selectedCampaign=known(campaign)?campaign:active.campaign;
 const panel=document.createElement('aside');panel.className='comparison-status';panel.setAttribute('aria-label','Optional campaign measurement');
 const text=document.createElement('p'),allow=document.createElement('button'),decline=document.createElement('button'),privacy=document.createElement('a');
 text.textContent='You arrived through '+campaigns[selectedCampaign]+'. Allow anonymous campaign measurement for this tab (up to 24 hours)? We count visits, comparisons and operator clicks—not bets or accounts.';
 allow.textContent='Allow measurement';decline.textContent='Continue without measurement';privacy.textContent='Privacy';privacy.href='/privacy.html';
 for(const button of [allow,decline]){button.type='button';button.className='secondary-action'}
 panel.append(text,allow,decline,privacy);(document.querySelector('main')||document.body).prepend(panel);
 async function post(body){const r=await fetch('/.netlify/functions/referrals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true});if(!r.ok)throw Error('unavailable');return r.json()}
 function enabled(){text.textContent='Campaign measurement is on for this tab. No betting account or bet is tracked.';allow.hidden=true;decline.textContent='Stop measurement'}
 if(active)enabled();
 decline.onclick=()=>{stopped=true;active=null;try{sessionStorage.removeItem(key)}catch{}panel.remove()};
 allow.onclick=async()=>{
  if(starting)return;starting=true;allow.disabled=true;
  try{const result=await post({action:'start',campaign:selectedCampaign,consent:true});if(stopped)return;active={campaign:selectedCampaign,token:result.token,expires:Date.now()+86300000};try{sessionStorage.setItem(key,JSON.stringify(active))}catch{}enabled()}
  catch{text.textContent='Measurement is unavailable. You can continue using BetCheap.';allow.disabled=false}
  finally{starting=false}
 };
 const sent=new Set();
 function track(type){if(!active||active.expires<=Date.now()||sent.has(type))return;sent.add(type);post({action:'event',token:active.token,type}).catch(()=>sent.delete(type))}
 document.addEventListener('betcheap:comparison',()=>track('comparison'));
 function click(event){
  if(event.type==='auxclick'&&event.button!==1)return;
  const a=event.target.closest?.('a[href]');if(!a)return;
  const url=new URL(a.href,location.href);
  if(url.origin===location.origin&&url.pathname==='/.netlify/functions/operator-link'){
   const operator=url.searchParams.get('operator');if(['onexbet','cloudbet','betsson'].includes(operator))track(operator+'_click');
  }
 }
 document.addEventListener('click',click);document.addEventListener('auxclick',click);
})();
