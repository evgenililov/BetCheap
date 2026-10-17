'use strict';
const s=require('./telegram-service');
exports.handler=async event=>{
 if(event.httpMethod!=='POST'||!s.authorized(event))return s.response(401,{error:'unauthorized'});
 let action;try{action=s.parse(event).action}catch{return s.response(400,{error:'invalid_body'})}
 if(!['activate','status','pause'].includes(action))return s.response(400,{error:'invalid_action'});
 try{
  const store=s.storage(event);
  if(action==='pause'){await store.setJSON('settings',{publishingEnabled:false});return s.response(200,{ok:true,publishingEnabled:false})}
  const me=await s.telegram('getMe',{});
  if(me.username?.toLowerCase()!==s.BOT.toLowerCase())return s.response(409,{error:'wrong_bot_token'});
  const member=await s.telegram('getChatMember',{chat_id:s.CHANNEL,user_id:me.id});
  const canPost=member.status==='administrator'&&member.can_post_messages===true;
  if(action==='status'){
   const webhook=await s.telegram('getWebhookInfo',{}),settings=await store.get('settings',{type:'json'});
   const publication=await store.get('publication/'+new Date().toISOString().slice(0,10),{type:'json'});
   return s.response(200,{ok:true,bot:me.username,canPost,webhookCorrect:webhook.url===s.APP+'/.netlify/functions/telegram',pendingUpdates:webhook.pending_update_count,publishingEnabled:settings?.publishingEnabled===true,today:publication?.state||'not_attempted'});
  }
  if(!canPost)return s.response(409,{error:'bot_needs_channel_post_permission'});
  if(!process.env.ONEXBET_CLIENT_ID||!process.env.ONEXBET_CLIENT_SECRET||!process.env.ONEXBET_REF||!process.env.CLOUDBET_API_KEY)return s.response(409,{error:'odds_credentials_missing'});
  const {leagues}=require('./telegram-odds');leagues();
  await s.telegram('setMyCommands',{commands:[{command:'start',description:'About BetCheap (18+)'},{command:'matches',description:'Upcoming football in selected competitions'},{command:'compare',description:'Verified comparison: /compare EVENT_ID'},{command:'app',description:'Open BetCheap'},{command:'help',description:'How to use the bot'}]});
  await s.telegram('setWebhook',{url:s.APP+'/.netlify/functions/telegram',secret_token:process.env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message'],max_connections:5,drop_pending_updates:false});
  await store.setJSON('settings',{publishingEnabled:true,activatedAt:new Date().toISOString()});
  return s.response(200,{ok:true,bot:me.username,channel:s.CHANNEL,publishingEnabled:true,schedule:'Daily 12:00 UTC',note:'No post is sent during activation. Live odds still require verification.'});
 }catch{return s.response(502,{error:'activation_or_status_failed',hint:'Check bot token, channel membership, Netlify Blobs and function logs. No secret values are returned.'})}
};
