'use strict';
const {eventClock}=require('./cloudbet-compare');
const label=v=>typeof v==='string'&&v.length<=160?v:null;
// Public sport metadata only. Never copy raw provider objects or market payloads.
function catalogRows(data){
 const rows=[];
 for(const c of data.categories||[])for(const t of c.competitions||[]){
  if(!label(c.name)||!label(t.name)||typeof t.key!=='string'||!/^[-a-z0-9]{1,160}$/.test(t.key))continue;
  rows.push({country:c.name,name:t.name,key:t.key});
 }
 return rows;
}
function fixturePage(data,offset){
 const events=data.events||[];
 return {total:events.length,offset,nextOffset:offset+100<events.length?offset+100:null,
  fixtures:events.slice(offset,offset+100).map(e=>({home:label(e.home?.name),away:label(e.away?.name),start:eventClock(e)?.value||null,status:label(e.status)}))};
}
module.exports={catalogRows,fixturePage};
