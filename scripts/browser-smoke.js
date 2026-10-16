'use strict';
// Requires playwright-core and Chromium. Feed fixtures are intercepted only in this test.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const start=new Date(Date.now()+86400000).toISOString();let failDetail=false;
  const json=(route,data)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  await page.route('**/.netlify/functions/onexbet?*',route=>{
   const q=new URL(route.request().url()).searchParams,op=q.get('op'),kind=q.get('kind');
   if(op==='sports')return json(route,{items:['1']});
   if(op==='tournaments')return json(route,{items:[{tournamentId:10,tournamentNameLocalization:'England. Premier League'}]});
   if(op==='events')return json(route,{items:['123']});
   if(op==='detail'&&failDetail)return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'upstream unavailable'})});
   if(op==='detail')return json(route,{event:{kind,sportEventId:123,sportId:1,home:'Arsenal',away:'Leeds United',tournament:'England. Premier League',start:kind==='live'?new Date(Date.now()-600000).toISOString():start,odds:[1,2,3].map((type,i)=>({type,oddsMarket:[2,3,4][i]})),subGames:[]}});
   return json(route,{});
  });
  await page.route('**/.netlify/functions/cloudbet?*',route=>json(route,{ok:true,matched:true,cloudbetEventId:'987',odds:{home:2.2,draw:2.9,away:4},checkedAt:new Date().toISOString()}));
  await page.route('**/.netlify/functions/betsson?*',route=>json(route,{}));
  await page.goto('http://127.0.0.1:8888/compare');
  await page.locator('#ageConfirm').click();
  await page.locator('#leagueSelect').selectOption('10');
  await page.locator('#loadMatches').click();
  await page.locator('#matchDropdown').selectOption('123');
  await page.waitForFunction(()=>document.getElementById('cloudbetCompareText').textContent.includes('VERIFIED SAME MATCH'));
  const rows=page.locator('#cloudbetCompareOdds tr');assert.equal(await rows.count(),4);
  assert.match(await rows.nth(1).innerText(),/Cloudbet/);
  assert.match(await rows.nth(2).innerText(),/1xBet/);
  assert.match(await rows.nth(3).innerText(),/Equal/);
  const links=page.locator('#cloudbetCompareOdds a');assert.equal(await links.count(),6);
  for(let i=0;i<6;i++){
   assert.match(await links.nth(i).getAttribute('href'),new RegExp('operator='+(i%2?'cloudbet':'onexbet')));
   assert.equal(await links.nth(i).getAttribute('target'),'_blank');
  }
  const navigation=page.waitForEvent('popup');await links.nth(1).click();
  const popup=await navigation;await popup.waitForLoadState().catch(()=>{});
  // External operator navigation can fail on restricted networks; the destination must be correct.
  const url=popup.url();assert.ok(url.startsWith('https://www.cloudbet.com/')||url==='chrome-error://chromewebdata/',url);
  await popup.close();
  assert.equal(await page.locator('#oddsGrid a').count(),3);
  // Missing second-provider prices must never leave the previous comparison visible.
  await page.unroute('**/.netlify/functions/cloudbet?*');
  await page.route('**/.netlify/functions/cloudbet?*',route=>json(route,{ok:true,matched:false,reason:'full_time_1x2_unavailable'}));
  await page.locator('#matchDropdown').selectOption('123');
  await page.waitForFunction(()=>document.getElementById('cloudbetCompareText').textContent.includes('No second quote'));
  assert.equal(await page.locator('#cloudbetCompareOdds a').count(),3);
  assert.match(await page.locator('#cloudbetCompareOdds').innerText(),/Not comparable/);
  for(let i=1;i<=3;i++)assert.equal(await page.locator('#cloudbetCompareOdds tr').nth(i).locator('td').nth(2).innerText(),'—');
  await page.locator('#modeLive').click();
  await page.locator('#leagueSelect').selectOption('10');
  await page.locator('#loadMatches').click();
  await page.locator('#matchDropdown').selectOption('123');
  assert.match(await page.locator('#oddsGrid a').first().getAttribute('href'),/kind=live/);
  failDetail=true;await page.locator('#refreshLive').click();
  await page.waitForFunction(()=>document.getElementById('eventDetails').classList.contains('hidden'));
  assert.match(await page.locator('#systemStatus').innerText(),/no longer available|refresh failed/);
  assert.deepEqual(errors,[]);
  console.log('Browser smoke PASS: age gate, string catalog IDs, event selection, three outcomes, best prices, six operator links, Cloudbet navigation, missing-market reset, LIVE routing, failed-refresh hides stale odds, no page errors. All odds in this test are fixtures.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
