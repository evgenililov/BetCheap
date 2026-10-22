'use strict';
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const calls=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const html='<main><a id="operator" href="/.netlify/functions/operator-link?operator=cloudbet" target="_blank">Cloudbet</a></main><script>'+fs.readFileSync('assets/referral.js','utf8')+'</script>';
  await page.route('https://betcheap.netlify.app/**',async route=>{
   if(route.request().url().includes('/.netlify/functions/referrals')){calls.push(route.request().postDataJSON());return route.fulfill({contentType:'application/json',body:JSON.stringify({token:'mock-signed-token',ok:true})})}
   return route.fulfill({contentType:'text/html',body:html});
  });
  await page.goto('https://betcheap.netlify.app/?ref=championz');
  assert.equal(calls.length,0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  await page.getByText('Continue without measurement',{exact:true}).click();
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('betcheap:comparison')));assert.equal(calls.length,0);
  await page.reload();await page.getByText('Allow measurement',{exact:true}).click();
  await page.getByText('Stop measurement',{exact:true}).waitFor();assert.equal(calls[0].action,'start');
  await page.evaluate(()=>{document.dispatchEvent(new CustomEvent('betcheap:comparison'));document.dispatchEvent(new CustomEvent('betcheap:comparison'));document.getElementById('operator').dispatchEvent(new MouseEvent('click',{bubbles:true}))});
  await page.waitForFunction(()=>true);await page.waitForTimeout(100);
  assert.equal(calls.filter(x=>x.type==='comparison').length,1);assert.equal(calls.filter(x=>x.type==='cloudbet_click').length,1);
  await page.reload();await page.getByText('Stop measurement',{exact:true}).waitFor();assert.equal(calls.filter(x=>x.action==='start').length,1);
  await page.getByText('Stop measurement',{exact:true}).click();assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  await page.goto('https://betcheap.netlify.app/?ref=unknown');assert.equal(await page.locator('aside').count(),0);
  assert.deepEqual(errors,[]);console.log('Referral browser PASS: no telemetry before consent, decline, accept, comparison/click, session reuse, stop and unknown code; requests mocked.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
