'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'dist');
fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
for(const file of fs.readdirSync(root))if(file.endsWith('.html'))fs.copyFileSync(path.join(root,file),path.join(dest,file));
fs.cpSync(path.join(root,'assets'),path.join(dest,'assets'),{recursive:true});
console.log('Built static site in dist; functions are bundled separately by Netlify.');
