import {getStore} from '@netlify/blobs';
// Scheduled handler only: no public action or operator/customer data is accepted.
export default async ()=>{
 const store=getStore({name:'betcheap-referrals',consistency:'strong'});
 const cutoff=new Date(Date.now()-31*86400000).toISOString().slice(0,10);
 let removed=0;
 for await(const page of store.list({paginate:true})){
  for(const blob of page.blobs){if(/^\d{4}-\d{2}-\d{2}\//.test(blob.key)&&blob.key.slice(0,10)<cutoff){await store.delete(blob.key);removed++;if(removed>=10000)return new Response(null,{status:204})}}
 }
 return new Response(null,{status:204});
};
export const config={schedule:'30 3 * * *'};
