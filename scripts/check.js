'use strict';
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
for(const directory of ['assets','netlify','scripts','tests']){
 for(const file of fs.readdirSync(directory,{recursive:true})){
  if(!/\.(js|mjs)$/.test(file))continue;
  const result=spawnSync(process.execPath,['--check',directory+'/'+file],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
 }
}
console.log('JavaScript syntax checks passed');
