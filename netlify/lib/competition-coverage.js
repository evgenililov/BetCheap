'use strict';
const {competitionMatch}=require('./cloudbet-compare');
function competitionCoverage(catalog,providerResult,kind){
 if(providerResult?.ok!==true||!Array.isArray(providerResult.items))throw Error('invalid_onexbet_catalog');
 const competitions=providerResult.items.map(row=>{
  const name=typeof row?.tournamentNameLocalization==='string'?row.tournamentNameLocalization:'';
  const id=String(row?.tournamentId??'');
  if(!name||!/^\d+$/.test(id))return {id:null,name:null,status:'invalid_provider_entry',cloudbet:null};
  const match=competitionMatch(catalog,name);
  return {id,name,status:match.reason,cloudbet:match.competition?{key:match.competition.key,name:match.competition.name}:null};
 });
 const counts={};for(const row of competitions)counts[row.status]=(counts[row.status]||0)+1;
 return {kind,scope:'competition_catalog_only',marketsChecked:false,
  fetchedAt:providerResult.fetchedAt||null,reportedCount:providerResult.reportedCount??null,
  possiblyTruncated:Boolean(providerResult.possiblyTruncated),total:competitions.length,counts,competitions};
}
module.exports={competitionCoverage};
