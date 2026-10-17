'use strict';
const {timingSafeEqual,createHmac}=require('node:crypto');
const APP='https://betcheap.netlify.app';
const CHANNEL='@BetCheapOdds';
const BOT='BetCheapBot';
const FOOTER='18+ · Gamble responsibly · Affiliate links. Odds may change; confirm at the operator. Cloudbet may lag up to 60s.';
function authorized(event){
 const expected=process.env.TELEGRAM_WEBHOOK_SECRET||'';
 const h=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 const supplied=h['x-telegram-bot-api-secret-token']||'';
 return /^[A-Za-z0-9_-]{32,256}$/.test(expected)&&typeof supplied==='string'&&Buffer.byteLength(expected)===Buffer.byteLength(supplied)&&timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}
function parse(event){
 if(event.isBase64Encoded||typeof event.body!=='string'||Buffer.byteLength(event.body)>16384)throw Error('invalid_update');
 return JSON.parse(event.body);
}
function command(update,now=Date.now()){
 const m=update?.message;
 if(!Number.isSafeInteger(update?.update_id)||update.update_id<0||m?.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0||m.from?.is_bot||m.from?.id!==m.chat.id||typeof m.text!=='string')return null;
 if(!Number.isInteger(m.date)||now-m.date*1000>600000||m.date*1000-now>60000)return null;
 const hit=/^\/(start|matches|compare|app|help)(?:@([A-Za-z0-9_]+))?(?:\s+(\S+))?\s*$/i.exec(m.text);
 if(!hit||hit[2]&&hit[2].toLowerCase()!==BOT.toLowerCase())return null;
 return {name:hit[1].toLowerCase(),arg:hit[3]||'',chatId:m.chat.id,updateId:update.update_id,date:m.date};
}
async function telegram(method,body){
 const token=process.env.TELEGRAM_BOT_TOKEN;
 if(!token)throw Error('telegram_not_configured');
 const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'});
 let data;try{data=await r.json()}catch{throw Error('telegram_invalid_response')}
 if(!r.ok||data?.ok!==true)throw Error('telegram_request_failed');
 return data.result;
}
function appLink(e){return APP+'/compare?'+new URLSearchParams({kind:'prematch',tournamentId:String(e.tournamentId),eventId:String(e.sportEventId)})}
function buttons(e){return {inline_keyboard:e?[[{text:'Compare all markets ↗',url:appLink(e)}],[{text:'1xBet ↗',url:APP+'/.netlify/functions/operator-link?operator=onexbet&kind=prematch&eventId='+e.sportEventId},{text:'Cloudbet ↗',url:APP+'/.netlify/functions/operator-link?operator=cloudbet'}]]:[[{text:'Open BetCheap ↗',url:APP}],[{text:'Follow BetCheapOdds',url:'https://t.me/BetCheapOdds'}]]}}
async function send(chatId,payload){return telegram('sendMessage',{chat_id:chatId,...payload,link_preview_options:{is_disabled:true}})}
function storage(event){const {getStore}=require('@netlify/blobs');return getStore({name:'betcheap-telegram',consistency:'strong'})}
async function claim(store,key){return (await store.setJSON(key,{at:new Date().toISOString()},{onlyIfNew:true})).modified}
function chatHash(chatId){return createHmac('sha256',process.env.TELEGRAM_WEBHOOK_SECRET).update(String(chatId)).digest('hex').slice(0,24)}
const response=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
module.exports={APP,CHANNEL,BOT,FOOTER,authorized,parse,command,telegram,send,storage,claim,chatHash,buttons,appLink,response};
