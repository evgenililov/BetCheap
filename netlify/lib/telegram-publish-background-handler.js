'use strict';
const s=require('./telegram-service');
const {publish,cleanup}=require('./telegram-publisher');
exports.handler=async event=>{
 if(event.httpMethod!=='POST'||!s.authorized(event))return s.response(401,{error:'unauthorized'});
 const store=s.storage(event),result=await publish(store);
 await cleanup(store);
 console.log(JSON.stringify({task:'telegram-publication',state:result.state}));
 return s.response(200,result);
};
