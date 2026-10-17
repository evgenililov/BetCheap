'use strict';
const input=document.getElementById('secret'),result=document.getElementById('result');
document.getElementById('generate').onclick=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));input.value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');result.textContent='Създаден е нов локален секрет. Копирайте го в TELEGRAM_WEBHOOK_SECRET в Netlify, запазете го и направете нов deploy.'};
document.getElementById('copy').onclick=async()=>{try{if(!input.value)return;await navigator.clipboard.writeText(input.value);result.textContent='Секретът е копиран. Не го изпращайте в чат.'}catch{result.textContent='Копирането не е разрешено от браузъра. Изберете и копирайте стойността от полето.'}};
const errors={unauthorized:'Секретът не съвпада с Netlify или променливата още не е публикувана.',wrong_bot_token:'Токенът в Netlify е за друг бот, не за @BetCheapBot.',bot_needs_channel_post_permission:'Добавете @BetCheapBot като администратор в @BetCheapOdds с Post Messages.',odds_credentials_missing:'Липсват API настройки за 1xBet или Cloudbet.',activation_or_status_failed:'Проверете токена, членството на бота в канала и достъпността на Netlify Blobs. Проверете Functions logs без да споделяте секрети.'};
for(const button of document.querySelectorAll('[data-action]'))button.onclick=async()=>{
 const secret=input.value.trim();if(!/^[A-Za-z0-9_-]{32,256}$/.test(secret)){result.textContent='Въведете webhook секрет от 32–256 букви, цифри, _ или -. Не въвеждайте токена на бота.';return}
 const buttons=document.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);result.textContent='Проверка…';
 try{const r=await fetch('/.netlify/functions/telegram-admin',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({action:button.dataset.action}),signal:AbortSignal.timeout(60000)});const data=await r.json();result.textContent=r.ok?JSON.stringify(data,null,2):(errors[data.error]||'Грешка при настройването. Проверете дали Functions са публикувани.')}
 catch{result.textContent='Няма потвърждение от сървъра. Натиснете „Провери връзката“, преди да активирате повторно.'}
 finally{buttons.forEach(b=>b.disabled=false)}
};
