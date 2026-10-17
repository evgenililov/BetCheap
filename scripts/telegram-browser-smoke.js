'use strict';
const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/.netlify/functions/telegram-admin',async route=>{const req=route.request();calls.push({body:req.postDataJSON(),secret:req.headers()['x-telegram-bot-api-secret-token']});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,publishingEnabled:req.postDataJSON().action!=='pause'})})});
  await page.goto('http://127.0.0.1:8888/telegram-setup.html');
  await page.locator('[data-action="activate"]').click();assert.equal(calls.length,0);
  await page.locator('#generate').click();const secret=await page.locator('#secret').inputValue();assert.match(secret,/^[a-f0-9]{64}$/);
  await page.locator('[data-action="activate"]').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('"ok": true'));
  assert.equal(calls[0].secret,secret);assert.deepEqual(calls[0].body,{action:'activate'});assert(!(await page.locator('#result').innerText()).includes(secret));
  await page.locator('[data-action="pause"]').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('false'));assert.equal(calls[1].body.action,'pause');
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  await page.reload();assert.equal(await page.locator('#secret').inputValue(),'');assert.deepEqual(errors,[]);
  console.log('Telegram setup browser PASS: local secret generation, authenticated activate/pause, no browser secret persistence, no page errors; requests mocked.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
