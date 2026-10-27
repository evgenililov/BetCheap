'use strict';
// Local files and mocked data only. No social posts, affiliate visits or production analytics.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],events=[],details=[];
  let matched=true,expired=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.copiedMatch=value}}}));
  await page.route('https://betcheap.netlify.app/**',async route=>{
   const url=new URL(route.request().url()),q=url.searchParams;
   const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname.endsWith('/referrals')){const body=route.request().postDataJSON();events.push(body);return json({token:'fixture-token',ok:true})}
   if(url.pathname.endsWith('/onexbet')){
    if(q.get('op')==='sports')return json({items:['1']});
    if(q.get('op')==='tournaments')return json({items:[{tournamentId:10,tournamentNameLocalization:'Fixture league'}]});
    if(q.get('op')==='events')return json({items:['123','124']});
    if(q.get('op')==='detail'){details.push(q.get('sportEventId'));return json({event:{kind:'prematch',sportEventId:Number(q.get('sportEventId')),sportId:1,home:'Fixture A',away:'Fixture B',tournament:'Fixture league',start:new Date(Date.now()+(expired?-86400000:86400000)).toISOString(),odds:[{type:1,oddsMarket:2},{type:2,oddsMarket:3},{type:3,oddsMarket:4}],subGames:[]}})}
   }
   if(url.pathname.endsWith('/cloudbet'))return json({ok:true,matched,cloudbetEventId:'fixture',reason:'event_not_verified',odds:{home:2.1,draw:3.1,away:4.1},markets:[],checkedAt:new Date().toISOString()});
   if(url.pathname.endsWith('/betsson'))return json({});
   let file;
   if(['/', '/compare','/compare.html'].includes(url.pathname))file='index.html';
   else if(/^\/assets\/[a-zA-Z0-9.-]+$/.test(url.pathname))file=url.pathname.slice(1);
   else return route.fulfill({status:404,body:'not found'});
   return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join(process.cwd(),file))});
  });
  await page.goto('https://betcheap.netlify.app/?ref=betcheap_x');await page.locator('#ageConfirm').click();
  assert.equal(await page.locator('#searchPane').isVisible(),true);assert.equal(await page.locator('#scanPane').isVisible(),false);assert.equal(events.length,0);
  await page.getByText('Allow measurement',{exact:true}).click();await page.getByText('Stop measurement',{exact:true}).waitFor();assert.equal(events[0].campaign,'betcheap_x');
  await page.goto('https://betcheap.netlify.app/compare?ref=betcheap_x&kind=prematch&sportId=1&tournamentId=10&eventId=123');
  await page.waitForFunction(()=>!document.getElementById('shareMatchLink').disabled,{},{timeout:10000}).catch(async error=>{console.error({errors,details,status:await page.locator('#systemStatus').innerText(),comparison:await page.locator('#cloudbetCompareText').innerText()});throw error});
  assert.deepEqual(details,['123']);assert.match(await page.locator('#eventTitle').innerText(),/Fixture A/);
  await page.locator('#shareMatchLink').click();const copied=new URL(await page.evaluate(()=>window.copiedMatch));
  assert.equal(copied.searchParams.get('ref'),'betcheap_x');assert.equal(copied.searchParams.get('eventId'),'123');assert.equal(copied.searchParams.get('tournamentId'),'10');
  await page.waitForTimeout(100);assert.equal(events.filter(e=>e.type==='comparison').length,1);
  matched=false;await page.reload();await page.waitForFunction(()=>document.getElementById('cloudbetCompareText').textContent.includes('No second quote'));
  assert.equal(await page.locator('#shareMatchLink').isDisabled(),true);
  await page.goto('https://betcheap.netlify.app/compare?tournamentId=10&eventId=999');await page.waitForFunction(()=>document.getElementById('systemStatus').textContent.includes('no longer listed'));
  assert.equal(await page.locator('#eventDetails').isVisible(),false);assert.ok(!details.includes('999'));
  expired=true;await page.goto('https://betcheap.netlify.app/compare?tournamentId=10&eventId=123');await page.waitForFunction(()=>document.getElementById('systemStatus').textContent.includes('already started'));
  assert.equal(await page.locator('#eventDetails').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('Acquisition browser PASS: mobile search-first, X consent, direct exact-match loading, campaign-preserving share, no share on missing comparison, unavailable/expired matches blocked; all data mocked.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
