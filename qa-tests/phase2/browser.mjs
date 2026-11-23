import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from '../../tools/qa/node_modules/playwright-core/index.mjs';
import {fixture,approvedTestBilling,syntheticPassword} from './fixture.mjs';
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const app='http://127.0.0.1:'+port,rows=[],f=await fixture();let browser,server;
const log=fs.openSync('qa-evidence/browser-server.log','w');
try{
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,PORT:String(port)},stdio:['ignore',log,log]});
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(app+'/phase2');if(r.status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}assert(ready,'Local compiled Next UI ready');
 await f.setPolicy({...approvedTestBilling,reviewsEnabled:true,allowImmediateReviews:true,publicReviews:true,premiumChannels:['facebook'],publicPromotions:true,homeSlots:1});
 browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:1000}});let exceptions=0;
  // Only API traffic is proxied to the actual disposable PostgreSQL application.
  // No provider, customer credentials or remote environment is used.
  await ctx.route(app+'/api/**',async route=>{
   const u=new URL(route.request().url());const response=await route.fetch({url:f.base+u.pathname+u.search,headers:{...route.request().headers(),origin:f.base}});await route.fulfill({response});
  });
  const page=await ctx.newPage();page.on('pageerror',()=>exceptions++);
  await page.goto(app+'/phase2');await page.waitForURL(app+'/login');rows.push({width,flow:'Guest sees explicit login error; no private workspace',status:'PASS'});
  async function login(key){
   const u=f.users[key],r=await ctx.request.post(f.base+'/api'+(u.role==='admin'?'/auth/admin-login':'/auth/login'),{headers:{Origin:f.base},data:{email:u.email,password:syntheticPassword}});assert.equal(r.status(),200);
  }
  await login('admin');await page.goto(app+'/admin#page=admin-membership');await page.getByRole('heading',{name:'สิทธิ์และวันหมดอายุ / Entitlements'}).waitFor();assert.equal(await page.getByRole('heading',{name:'กติกาที่ได้รับอนุมัติ / Approved policy'}).count(),0);
  assert.equal(await page.getByText('THB 990',{exact:true}).count(),1);assert.equal(await page.getByText('THB 4,990',{exact:true}).count(),1);
  await page.getByRole('button',{name:'เริ่มทดลองบัญชี 90 วัน / Activate account trial'}).click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
  await page.getByRole('button',{name:'ตรวจแจ้งหมดอายุ / Generate notices'}).click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
  rows.push({width,flow:'Admin catalog, trial and notices; no Owner policy controls',status:'PASS'});
  await login('merchant');await page.goto(app+'/merchant#page=owner-membership');await page.getByRole('heading',{name:'ซื้อหรือต่ออายุทดสอบ / Sandbox order'}).waitFor();
  const createdResponse=page.waitForResponse(r=>r.url().endsWith('/api/phase2/orders')&&r.request().method()==='POST');await page.getByRole('button',{name:'สร้างคำสั่งซื้อ Sandbox'}).click();const created=await createdResponse;assert.equal(created.status(),200);const purchased=(await created.json()).order;await page.getByRole('status').filter({hasText:'Saved'}).waitFor();assert.equal(await page.getByRole('button',{name:'Simulate succeeded'}).count(),0);
  rows.push({width,flow:'Merchant own workspace/order and dates; no Admin controls',status:'PASS'});
  const history=page.getByRole('region',{name:'คำสั่งซื้อและกระทบยอด'}),ownOrders=(await f.expect('/phase2/orders',undefined,f.sessions.merchant)).orders;
  assert(ownOrders.some(o=>o.id===purchased.id));await history.getByLabel('ค้นหาคำสั่งซื้อ / Search orders').fill(purchased.id);
  assert.equal(await history.locator('[data-phase2-order]').count(),1);await history.getByRole('button',{name:'รายละเอียด / Details'}).click();await history.getByText('ยังไม่เปิดสิทธิ์จากคำสั่งซื้อนี้',{exact:true}).waitFor();
  await f.settle(purchased,'pending');await f.settle(purchased,'succeeded');await page.reload();await page.goto(app+'/merchant#page=owner-membership');await page.getByRole('heading',{name:'ซื้อหรือต่ออายุทดสอบ / Sandbox order'}).waitFor();
  await history.getByLabel('ค้นหาคำสั่งซื้อ / Search orders').fill(purchased.providerReference);await history.getByLabel('สถานะคำสั่งซื้อ / Order status').selectOption('succeeded');assert.equal(await history.locator('[data-phase2-order]').count(),1);
  await history.getByRole('button',{name:'รายละเอียด / Details'}).click();await history.getByRole('heading',{name:'ผลเปิดสิทธิ์ / Granted period'}).waitFor();assert.equal(await history.getByRole('listitem').count(),2);assert((await history.getByRole('listitem').nth(0).innerText()).includes('pending'));assert((await history.getByRole('listitem').nth(1).innerText()).includes('succeeded'));await history.getByText(/เลขสิทธิ์:/).waitFor();
  await page.screenshot({path:'qa-evidence/reconciliation-'+width+'.png',fullPage:true});await history.getByLabel('ค้นหาคำสั่งซื้อ / Search orders').fill('not-an-existing-order');await history.getByText('ไม่พบคำสั่งซื้อตามเงื่อนไข',{exact:true}).waitFor();
  rows.push({width,flow:'Merchant search by ID/provider reference, status filter, pending/settled history, billing snapshot and linked grant',status:'PASS'});

  await login('reviewer');await page.goto(app+'/dashboard#page=user-membership');await page.getByLabel('ข้อความรีวิว',{exact:true}).waitFor();await page.getByLabel('ข้อความรีวิว',{exact:true}).fill('SYNTHETIC browser review '+width);await page.getByLabel('คะแนน',{exact:true}).selectOption('1');
  // Use different Villas for each viewport; do not bypass duplicate protection.
  await page.getByLabel('ที่พัก / Villa',{exact:true}).selectOption(f.villas[width===1440?1:2].id);
  await page.getByRole('button',{name:'ส่งรีวิว / Submit review'}).click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();assert.equal(await page.getByRole('button',{name:'เผยแพร่ / Publish'}).count(),0);
  rows.push({width,flow:'Verified synthetic User submits negative review; cannot publish',status:'PASS'});
  await page.goto(app+'/admin#page=admin-membership');await page.getByLabel('ที่พัก / Villa',{exact:true}).selectOption(f.villas[width===1440?1:2].id);await page.getByLabel('เหตุผลเปลี่ยนโหมด').waitFor();await page.getByLabel('เหตุผลเปลี่ยนโหมด').fill('SYNTHETIC content review accepted');await page.getByRole('button',{name:'เผยแพร่ / Publish'}).first().click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
  rows.push({width,flow:'Admin publishes same negative review under content rules',status:'PASS'});
  await login('merchant');await page.goto(app+'/merchant#page=owner-membership');await page.getByLabel('ที่พัก / Villa',{exact:true}).selectOption(f.villas[width===1440?1:2].id);await page.getByLabel('คำตอบ Merchant').waitFor();await page.getByLabel('คำตอบ Merchant').fill('SYNTHETIC merchant reply');await page.getByRole('button',{name:'ตอบรีวิว',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
  rows.push({width,flow:'Merchant own published reply',status:'PASS'});
  const target=f.villas[width===1440?1:2];await f.expect('/phase2/promotions',{villaId:target.id,placement:'detail',source:'TEAM',startsAt:new Date(f.now()-1000).toISOString(),endsAt:new Date(f.now()+86400000).toISOString(),approved:true},f.sessions.admin);
  const guest=await browser.newContext({viewport:{width,height:1000}});await guest.route(app+'/api/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:f.base+u.pathname+u.search,headers:{...route.request().headers(),origin:f.base}});await route.fulfill({response});});const publicPage=await guest.newPage();publicPage.on('pageerror',()=>exceptions++);await publicPage.goto(app+'/phase2/villa?villaId='+target.id);await publicPage.getByText('SYNTHETIC browser review '+width,{exact:false}).waitFor();await publicPage.locator('[data-phase2-banner] img').waitFor();await publicPage.waitForFunction(()=>[...document.querySelectorAll('[data-phase2-banner] img')].length>0&&[...document.querySelectorAll('[data-phase2-banner] img')].every(i=>i.complete&&i.naturalWidth>0));const href=await publicPage.locator('[data-phase2-banner] a').getAttribute('href');assert(href.includes('item=VC-'));await publicPage.screenshot({path:'qa-evidence/public-'+width+'.png',fullPage:true});assert(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));rows.push({width,flow:'Fresh Guest public preview: approved image, correct QR link, published negative review/reply, distinct media dates',status:'PASS'});const advertisedQr=new URLSearchParams(new URL(href,app).hash.slice(1)).get('item'),advertised=f.villas.find(v=>v.qr===advertisedQr);assert(advertised);await publicPage.evaluate(()=>window.scrollBy(0,700));assert.equal(await publicPage.locator('[data-phase2-banner] a').getAttribute('href'),href);const detailResponse=publicPage.waitForResponse(r=>r.url().includes('/api/public/qr/'+encodeURIComponent(advertisedQr)));await publicPage.locator('[data-phase2-banner] a').click();const detail=await detailResponse;assert.equal(detail.status(),200);const identity=await detail.json();assert.equal(identity.qr,advertised.qr);assert.equal(identity.name,advertised.name);assert.equal(f.villas.find(v=>v.qr===identity.qr)?.id,advertised.id);await publicPage.getByRole('heading',{name:advertised.name,exact:true}).first().waitFor();rows.push({width,flow:'Banner click opens exact existing Villa/QR in native property page',status:'PASS'});const reviewRecord=(await f.expect('/phase2/reviews',undefined,f.sessions.admin)).reviews.find(r=>r.villaId===target.id&&r.content==='SYNTHETIC browser review '+width);assert(reviewRecord);
  await page.goto(app+'/admin#page=admin-membership');await page.getByLabel('ที่พัก / Villa',{exact:true}).selectOption(f.villas[width===1440?1:2].id);await page.getByLabel('เหตุผลเปลี่ยนโหมด').fill('SYNTHETIC moderation privacy reason');await page.getByRole('button',{name:'ไม่เผยแพร่ — ต้องระบุเหตุผล'}).first().click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
  await publicPage.goto(app+'/phase2/villa?villaId='+target.id);await publicPage.getByText('ยังไม่มีรีวิวที่เผยแพร่',{exact:true}).waitFor();assert.equal(await publicPage.getByText('SYNTHETIC browser review '+width,{exact:false}).count(),0);await publicPage.screenshot({path:'qa-evidence/review-hidden-'+width+'.png',fullPage:true});
  await f.expect('/phase2/reply',{id:reviewRecord.id,content:'Hidden reply denied'},f.sessions.merchant,404);rows.push({width,flow:'Admin rejects published review with reason; Guest no longer sees review/reply; Merchant cannot reply to hidden review',status:'PASS'});
  await guest.unrouteAll({behavior:'ignoreErrors'});await guest.close();
  await page.screenshot({path:'qa-evidence/phase2-'+width+'.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(exceptions,0);await ctx.unrouteAll({behavior:'ignoreErrors'});await ctx.close();
 }
}finally{
 await browser?.close();if(server){server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(r,3000);});}fs.closeSync(log);await f.close();fs.writeFileSync('qa-evidence/browser.json',JSON.stringify({at:new Date().toISOString(),source:'LOCAL_COMPILED_NEXT_UI_REAL_DISPOSABLE_POSTGRES_API',syntheticOnly:true,remoteWrites:0,deployments:0,rows},null,2)+'\n');
}
console.log({browserChecks:rows.length,status:'PASS'});
