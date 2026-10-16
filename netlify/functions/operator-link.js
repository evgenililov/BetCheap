'use strict';
// Public operator navigation is separate from verified affiliate/selection routing.
// Never accept a destination URL from the browser or invent an event deep link.
const {fetchEventForRouting}=require('./onexbet');
const {verifiedTarget}=require('../lib/dynamic-event-routing');
const {trackingUrl}=require('../lib/betsson-affiliate');
const operators={
 betsson:{url:trackingUrl,hosts:['record.betsson.com']},
 onexbet:{url:'https://1xbet.com/en',hosts:['1xbet.com','www.1xbet.com']},
 cloudbet:{url:'https://www.cloudbet.com/en/sports',hosts:['cloudbet.com','www.cloudbet.com']}
};
exports.handler=async event=>{
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(event.httpMethod!=='GET')return {statusCode:405,headers:{...headers,Allow:'GET'},body:''};
 const q=event.queryStringParameters||{},operator=Object.hasOwn(operators,q.operator)?operators[q.operator]:null;
 if(!operator)return {statusCode:400,headers,body:'Unknown operator'};
 let destination=operator.url,kind=q.operator==='betsson'?'affiliate':'operator';
 if(q.operator==='onexbet'&&/^\d{1,18}$/.test(q.eventId||'')&&['live','prematch'].includes(q.kind)){
  try{
   const e=await fetchEventForRouting(q.eventId,q.kind);
   const path=verifiedTarget(e?.link);
   const u=path?new URL(e.link):null;
   if(e&&String(e.sportEventId)===q.eventId&&e.kind===q.kind&&u&&operator.hosts.includes(u.hostname)&&path.startsWith(q.kind==='live'?'/en/live/':'/en/line/')){
    destination=u.toString();kind='event';
   }
  }catch{/* The public operator page remains available if the feed is offline. */}
 }
 return {statusCode:302,headers:{...headers,Location:destination,'X-BetCheap-Link-Kind':kind},body:''};
};
