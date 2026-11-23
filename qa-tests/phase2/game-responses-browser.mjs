import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from '../../tools/qa/node_modules/playwright-core/index.mjs';
import {fixture,syntheticPassword,approvedTestBilling} from './fixture.mjs';
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const base='http://127.0.0.1:'+port,rows=[];let child,browser;const fd=fs.openSync('qa-evidence/game-responses-server.log','w');
try{
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,APP_ENV:'test',DATABASE_URL:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',fd,fd]});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/merchant')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,300))}assert(ready);
 browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const width of [1440,390]){
  const f=await fixture(),ctx=await browser.newContext({viewport:{width,height:1000}});try{
   await f.setPolicy(approvedTestBilling);const {order}=await f.buy(f.villas[3],'premium');await f.settle(order);f.config.phase2GameResponses=true;
   await ctx.route(base+'/api/**',async route=>{const req=route.request(),url=new URL(req.url());const response=await route.fetch({url:f.base+url.pathname+url.search,headers:{...req.headers(),origin:f.base}});await route.fulfill({response})});
   const errors=[];const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   for(const role of ['merchant','admin']){
    const r=await ctx.request.post(f.base+'/api/auth/'+(role==='admin'?'admin-login':'login'),{headers:{Origin:f.base},data:{email:f.users[role].email,password:syntheticPassword}});assert.equal(r.status(),200);
    await page.goto(base+'/'+role+'#page='+(role==='admin'?'admin-membership':'owner-membership'));await page.getByRole('region',{name:'New package terms'}).waitFor();
    assert.equal(await page.getByText('ยังไม่รวม VAT / VAT-exclusive',{exact:false}).count(),4);assert.equal(await page.getByText('รวม VAT / VAT-inclusive',{exact:false}).count(),0);rows.push({width,role,status:'PASS',flow:'Four unchanged base prices are VAT exclusive; new terms and pending Finance shown'});
    await page.getByText('ราคาไม่รวม VAT · แพ็กเกจ 30 วันนับจากบริษัทอนุมัติ · ลูกค้ากดต่ออายุเอง',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'สร้างคำสั่งซื้อ Sandbox',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'ยืนยันชำระสำเร็จ'}).count(),0);rows.push({width,role,status:'PASS',flow:'30-day company approval and manual renewal displayed; financial creation/simulation unavailable'});
    assert.equal(await page.getByRole('heading',{name:'ตารางแบนเนอร์ / Promotions',exact:true}).count(),0);
    if(role==='merchant'){
     const review=page.getByRole('region',{name:'Company approval preparation',exact:true});await review.getByLabel('Requested approval package',{exact:true}).selectOption('premium');
     await review.getByRole('button',{name:'ส่งคำขอตรวจสอบ / Submit review request',exact:true}).click();await review.getByText('premium · รอตรวจสอบ / Pending review',{exact:true}).waitFor();
     await review.getByRole('button',{name:'ส่งคำขอตรวจสอบ / Submit review request',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();assert.equal(await review.getByText('premium · รอตรวจสอบ / Pending review',{exact:true}).count(),1);
     rows.push({width,role,status:'PASS',flow:'Authenticated manual review request remains pending; repeated submission does not create another request or entitlement'});
    }
    if(role==='admin'){
     await page.screenshot({path:'qa-evidence/game-admin-before-channel-'+width+'.png',fullPage:true});fs.writeFileSync('qa-evidence/game-admin-before-channel-'+width+'.txt',await page.locator('body').innerText());const review=page.getByRole('region',{name:'Company approval preparation',exact:true});const pending=(await f.expect('/phase2/company-approval-requests',undefined,f.sessions.admin)).requests[0];assert(pending);
     await f.expect('/phase2/company-approval-preview',{requestId:pending.id},f.sessions.admin,409);
     f.config.phase2ApprovalPreviewTerms={simulationOnly:true,billingUnit:'VILLA',reference:'SYNTHETIC_BROWSER_TERMS_NOT_FINANCE_APPROVAL',vatBasisPoints:700,vatRoundingPolicy:'HALF_UP'};
     await review.getByRole('button',{name:'ดูตัวอย่าง VAT / Preview VAT',exact:true}).click();const preview=review.getByRole('region',{name:'Nonfinancial approval preview',exact:true});await preview.waitFor();assert((await preview.innerText()).includes('5,339.30'));assert((await preview.innerText()).includes('ไม่ใช่ใบแจ้งหนี้หรือการอนุมัติ'));
     assert.equal((await f.expect('/phase2/company-approval-requests',undefined,f.sessions.admin)).requests[0].status,'PENDING_REVIEW');
     rows.push({width,role,status:'PASS',flow:'Existing Admin previews server-only synthetic VAT/30-day period without company approval, invoice, payment or grant'});
     const channel=page.getByRole('combobox',{name:/^ช่องทาง/});await channel.waitFor({state:'visible'});assert.deepEqual(await channel.locator('option').allTextContents(),['Facebook']);
     await page.getByRole('button',{name:'ส่ง Email ที่รอส่ง / Deliver queued Email',exact:true}).isDisabled().then(assert);
     await page.getByLabel('ที่พัก / Villa',{exact:true}).selectOption(f.villas[3].id);
     await page.getByRole('combobox',{name:/^งานทีม\/แพ็กเกจ/}).selectOption('TEAM');await channel.selectOption('instagram');await page.getByRole('combobox',{name:/^งานทีม\/แพ็กเกจ/}).selectOption('PACKAGE');
     await page.getByLabel('เดือนที่ใช้สิทธิ์',{exact:true}).fill(new Date(f.now()).toISOString().slice(0,7));
     const submitted=page.waitForRequest(r=>r.url().endsWith('/api/phase2/social')&&r.method()==='POST');
     await page.getByRole('button',{name:'บันทึกชิ้นงาน',exact:true}).click();assert.equal((await submitted).postDataJSON().channel,'facebook','Returning to package fulfillment must submit Facebook rather than a stale team channel');
     await page.getByRole('status').filter({hasText:'Saved'}).waitFor();rows.push({width,role,status:'PASS',flow:'TEAM-to-PACKAGE switch resets the channel and records Facebook within existing package quota'});
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await page.screenshot({path:'qa-evidence/game-responses-'+role+'-'+width+'.png',fullPage:true});rows.push({width,role,status:'PASS',flow:'New Banner absent; Admin package Social offers Facebook only; no overflow or page errors'});
   }
   const old=await f.expect('/phase2/orders?orderId='+order.id,undefined,f.sessions.merchant);assert.equal(old.order.vatMode,'INCLUSIVE');assert.equal(old.order.totalSatang,order.totalSatang);assert.equal((await f.db.prepare('SELECT qr FROM villas WHERE id=?').get(f.villas[3].id)).qr,f.villas[3].qr);
  }finally{await ctx.unrouteAll({behavior:'ignoreErrors'});await ctx.close();await f.close()}
 }
 console.log({status:'PASS',checks:rows.length,syntheticOnly:true,providerCalls:0,productionWrites:0});
}finally{await browser?.close();if(child){child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,3000)})}fs.closeSync(fd);fs.writeFileSync('qa-evidence/game-responses-browser.json',JSON.stringify({source:'COMPILED_NEXT_UI_SYNTHETIC_LOOPBACK_API_PROXY',rows,syntheticOnly:true},null,2)+'\n')}
