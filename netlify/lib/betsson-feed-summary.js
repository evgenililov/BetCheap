'use strict';
// ISA v1.10 pp.12-14. Descriptive diagnostics only: numeric statuses are not documented enums.
const str=v=>typeof v==='string'?v.slice(0,180):null;
const id=v=>typeof v==='string'||Number.isSafeInteger(v)?String(v).slice(0,180):null;
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
function summarizeEvent(e){
 const markets=Array.isArray(e?.ml)?e.ml:[];
 return {
  eventId:id(e?.eit)||id(e?.ei),name:str(e?.en),start:str(e?.sd),phase:num(e?.cep),eventType:num(e?.et),categoryId:id(e?.ci),category:str(e?.cn),region:str(e?.rn),competition:str(e?.scn),
  participants:(Array.isArray(e?.epl)?e.epl:[]).slice(0,20).map(p=>({id:id(p?.pi),name:str(p?.pn),sortOrder:num(p?.so)})),
  marketCount:markets.length,
  marketSamples:markets.slice(0,20).map(m=>({marketId:id(m?.mit)||id(m?.mi),templateId:id(m?.mti),name:str(m?.mn),status:id(m?.msi),lineValue:typeof m?.lv==='string'?str(m.lv):num(m?.lv),lineValueType:id(m?.lvt),
   selections:(Array.isArray(m?.msl)?m.msl:[]).slice(0,10).map(s=>({selectionId:id(s?.msit)||id(s?.msi),templateId:id(s?.msti),text:str(s?.mst),status:id(s?.si),settledStatus:id(s?.ssi),participantId:id(s?.pi),hasDecimalPrice:typeof s?.msp==='number'&&Number.isFinite(s.msp)&&s.msp>1}))})),
  marketsVerified:false
 };
}
module.exports={summarizeEvent};
