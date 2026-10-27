(()=>{
 'use strict';
 const form=document.getElementById('reportForm'),date=document.getElementById('reportDate'),secret=document.getElementById('reportSecret'),out=document.getElementById('reportOutput');
 date.value=new Date().toISOString().slice(0,10);
 form.onsubmit=async event=>{
  event.preventDefault();out.textContent='Зареждане…';const value=secret.value;secret.value='';
  try{
   const r=await fetch('/.netlify/functions/referrals',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':value},body:JSON.stringify({action:'report',date:date.value,campaign:document.getElementById('reportCampaign').value})});
   const data=await r.json();
   if(!r.ok){out.textContent='Отчетът не е достъпен: '+String(data.error||r.status);return}
   const c=data.counts;
   out.textContent=[
    'Кампания: '+data.campaign,'Начало на сесиите (UTC): '+data.date,'',
    'Посещения със съгласие: '+c.visit,
    'Сесии с отворено сравнение: '+c.comparison,
    'Сесии с клик към 1xBet: '+c.onexbet_click,
    'Сесии с клик към Cloudbet: '+c.cloudbet_click,
    'Сесии с клик към Betsson: '+c.betsson_click,'',
    'Това са сесии, не уникални хора. Всяко действие се брои веднъж на сесия.',
    'Посетителите без съгласие не се измерват.',
    'Потвърдени клиенти, залози и комисиони: няма свързан операторски отчет.',
    data.truncated?'Внимание: частичен отчет — достигнат лимит от 10 000 записа.':''
   ].join('\n');
  }catch{out.textContent='Отчетът не е достъпен. Проверете връзката.'}
 };
})();
