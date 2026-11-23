import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from '../../tools/qa/node_modules/playwright-core/index.mjs';
import {fixture,syntheticPassword,approvedTestBilling} from './fixture.mjs';
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const base='http://127.0.0.1:'+port,rows=[];let child,browser;fs.mkdirSync('qa-evidence',{recursive:true});const fd=fs.openSync('qa-evidence/consolidated-server.log','w');
try{
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,APP_ENV:'test',DATABASE_URL:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',fd,fd]});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/merchant')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,300));}assert(ready);
 browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const width of [1440,390]){
  const f=await fixture(),ctx=await browser.newContext({viewport:{width,height:1000}});try{
   await f.setPolicy({...approvedTestBilling,vatMode:'EXCLUSIVE',paidStartRule:'COMPANY_APPROVAL',vatBasisPoints:700});
   const v=f.villas[1],{order}=await f.buy(v,'starter');const paid=(await f.settle(order,'succeeded')).order;assert.equal(paid.grantId,null);
   await ctx.route(base+'/api/**',async route=>{const req=route.request(),u=new URL(req.url());const response=await route.fetch({url:f.base+u.pathname+u.search,headers:{...req.headers(),origin:f.base}});await route.fulfill({response});});
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.name));
   for(const role of ['merchant','admin']){
    const login=await ctx.request.post(f.base+'/api/auth/'+(role==='admin'?'admin-login':'login'),{headers:{Origin:f.base},data:{email:f.users[role].email,password:syntheticPassword}});assert.equal(login.status(),200);
    await page.goto(base+'/'+role+'#page='+(role==='admin'?'admin-membership':'owner-membership'));
    await page.getByRole('region',{name:'New package terms'}).waitFor();assert.equal(await page.getByText('ยังไม่รวม VAT / VAT-exclusive',{exact:false}).count(),4);
    await page.getByText('ราคาไม่รวม VAT · แพ็กเกจ 30 วันนับจากบริษัทอนุมัติ · ลูกค้ากดต่ออายุเอง',{exact:true}).waitFor();
    if(role==='merchant'){assert.equal(await page.getByRole('button',{name:'บริษัทอนุมัติ / Approve',exact:true}).count(),0);await page.getByRole('button',{name:'สร้างคำสั่งซื้อ Sandbox',exact:true}).waitFor();rows.push({width,role,flow:'Exclusive prices/30-day/manual renewal and no Admin approval control',status:'PASS'});}
    else{
     const article=page.locator('[data-phase2-order="'+order.id+'"]');await article.getByRole('button',{name:'บริษัทอนุมัติ / Approve',exact:true}).click();await article.getByText(/APPROVED/).waitFor();
     const stored=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:order:'+order.id)).value);assert.equal(stored.companyStatus,'APPROVED');assert(stored.grantId);assert.equal(Date.parse(stored.companyDecidedAt),f.now());
     await page.getByRole('heading',{name:'ตารางแบนเนอร์ / Promotions',exact:true}).waitFor();const social=page.getByRole('region',{name:'Social job tracking',exact:true});assert.equal(await social.locator('option[value="instagram"],option[value="tiktok"]').count(),0);
     rows.push({width,role,flow:'Real UI company approval -> local backend grant; company banner controls; Facebook-only selector',status:'PASS'});
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'qa-evidence/consolidated-'+role+'-'+width+'.png'});
   }
   const merchantLogin=await ctx.request.post(f.base+'/api/auth/login',{headers:{Origin:f.base},data:{email:f.users.merchant.email,password:syntheticPassword}});assert.equal(merchantLogin.status(),200);
   await page.goto(base+'/merchant#page=owner-membership');await page.getByRole('region',{name:'New package terms'}).waitFor();
   await page.getByRole('combobox',{name:'ที่พัก / Villa',exact:true}).selectOption(v.id);
   const countdown=page.locator('[data-phase2-countdown="'+v.id+'"]');await countdown.waitFor();assert.equal(await countdown.getAttribute('data-expiry-state'),'ACTIVE');assert.match(await countdown.textContent(),/เหลือ 30 วัน/);assert.match(await countdown.textContent(),/บริษัทอนุมัติ/);
   await page.screenshot({path:'qa-evidence/consolidated-countdown-'+width+'.png'});rows.push({width,role:'merchant',flow:'Approved grant appears as30-day server countdown with payment+company-approval QR restoration rule',status:'PASS'});
   assert.deepEqual(errors,[]);
  }finally{await ctx.close();await f.close();}
 }
}finally{await browser?.close();child?.kill('SIGTERM');fs.closeSync(fd);fs.writeFileSync('qa-evidence/consolidated-browser.json',JSON.stringify({rows,productionAccessed:false,providersCalled:false,scope:'Built local Next frontend proxied to real local isolated PostgreSQL application API; synthetic authorized accounts only'},null,2)+'\n');}
console.log(JSON.stringify(rows));
