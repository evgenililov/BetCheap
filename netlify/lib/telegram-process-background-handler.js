'use strict';
const s=require('./telegram-service');
const {commandReply}=require('./telegram-odds');
exports.handler=async event=>{
 if(event.httpMethod!=='POST'||!s.authorized(event))return s.response(401,{error:'unauthorized'});
 let c;try{c=s.command(s.parse(event))}catch{return s.response(400,{error:'invalid_update'})}
 if(!c)return s.response(200,{ok:true,ignored:true});
 const store=s.storage(event),day=new Date(c.date*1000).toISOString().slice(0,10),key=`updates/${day}/${c.updateId}`;
 if(!await s.claim(store,key))return s.response(200,{ok:true,duplicate:true});
 if(!await s.claim(store,`rate/${day}/${s.chatHash(c.chatId)}/${Math.floor(Date.now()/10000)}`))return s.response(200,{ok:true,throttled:true});
 let payload;
 try{payload=await commandReply(c)}catch{payload={text:'The odds feed is temporarily unavailable or this match is no longer upcoming. No unverified prices are shown. Try /matches later.',reply_markup:s.buttons()}}
 // Do not retry sendMessage automatically: a timeout may occur after Telegram has accepted it.
 try{const result=await s.send(c.chatId,payload);await store.setJSON(key,{state:'sent',messageId:result.message_id,at:new Date().toISOString()})}
 catch{await store.setJSON(key,{state:'delivery_unknown',at:new Date().toISOString()})}
 return s.response(200,{ok:true});
};
