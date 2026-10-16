'use strict';
const $=selector=>document.querySelector(selector);
$('#dataConfigBtn').onclick=async()=>{
  const button=$('#dataConfigBtn'),status=$('#dataConfigStatus');button.disabled=true;status.textContent='Checking configuration…';
  try{
    const response=await fetch('/.netlify/functions/data-status',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Configuration check unavailable. The new server function may not be deployed yet.');
    const data=await response.json();
    if(typeof data.configured!=='boolean'||data.connectionTested!==false)throw new Error('Unexpected configuration response.');
    status.textContent=data.message;
  }catch(error){status.textContent=error.name==='TimeoutError'?'Configuration check timed out. Please try again.':error.message}
  finally{button.disabled=false}
};