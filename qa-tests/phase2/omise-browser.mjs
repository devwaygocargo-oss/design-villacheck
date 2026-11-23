import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from '../../tools/qa/node_modules/playwright-core/index.mjs';
import {paymentFixture} from './omise-fixture.mjs';
import {syntheticPassword} from './fixture.mjs';
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const base='http://127.0.0.1:'+port,rows=[];let child,browser;
const fd=fs.openSync('qa-evidence/omise-browser-server.log','w');
try{
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,PORT:String(port)},stdio:['ignore',fd,fd]});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/phase2')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}assert(ready);browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const width of [1440,390]){
  const f=await paymentFixture();const ctx=await browser.newContext({viewport:{width,height:1000}});
  try{
   await ctx.route(base+'/api/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:f.base+u.pathname+u.search,headers:{...route.request().headers(),origin:f.base}});await route.fulfill({response});});
   await ctx.addInitScript(()=>{window.Omise={setPublicKey:()=>{},createSource:(_method,_data,callback)=>callback(200,{id:'src_test_synthetic',livemode:false})};});
   const login=await ctx.request.post(f.base+'/api/auth/login',{headers:{Origin:f.base},data:{email:f.users.merchant.email,password:syntheticPassword}});assert.equal(login.status(),200);
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.name));await page.goto(base+'/phase2');await page.goto(base+'/merchant#page=owner-membership');
   const cancelled=(await f.buy(f.villas[0],'basic')).order;await page.reload();await page.goto(base+'/merchant#page=owner-membership');
   const history=page.getByRole('region',{name:'คำสั่งซื้อและกระทบยอด'});await history.getByLabel('ค้นหาคำสั่งซื้อ / Search orders').fill(cancelled.id);await history.getByRole('button',{name:'รายละเอียด / Details'}).click();await history.getByRole('button',{name:'ยกเลิกก่อนเริ่มชำระ'}).click();await history.getByText(/— cancelled/).waitFor();assert.equal(f.state.creates,0);
   await history.getByLabel('ค้นหาคำสั่งซื้อ / Search orders').fill(f.order.id);await history.getByRole('button',{name:'รายละเอียด / Details'}).click();await history.getByRole('button',{name:'เริ่ม Omise Sandbox',exact:true}).click();await history.getByText('สถานะผู้ให้บริการ: pending',{exact:true}).waitFor();assert.equal(f.state.creates,1);
   const event=f.event('successful');assert.equal((await f.request('/webhooks/omise',event)).status,200);await history.getByRole('button',{name:'ตรวจผล Omise จาก Server'}).click();await history.getByText(/เลขสิทธิ์:/).waitFor();await history.getByText('สถานะผู้ให้บริการ: succeeded',{exact:true}).waitFor();
   assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,1);assert.equal(await page.getByRole('button',{name:'Simulate succeeded'}).count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   await page.screenshot({path:'qa-evidence/omise-checkout-'+width+'.png',fullPage:true});rows.push({width,status:'PASS',flow:'Merchant cancels before charge; mock Omise SDK → real API/PostgreSQL → existing Omise HTTP adapter with fake network → verified webhook → exactly one grant; UI status and order details'});
  }finally{await ctx.unrouteAll({behavior:'ignoreErrors'});await ctx.close();await f.close();}
 }
 console.log({omiseBrowserChecks:rows.length,status:'PASS',providerNetwork:'MOCKED_NOT_REAL_SANDBOX'});
}finally{await browser?.close();if(child){child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,3000);});}fs.closeSync(fd);fs.writeFileSync('qa-evidence/omise-browser.json',JSON.stringify({at:new Date().toISOString(),providerNetwork:'MOCKED',realProviderAcceptance:'BLOCKED_TEST_KEYS_REQUIRED',rows},null,2)+'\n');}
