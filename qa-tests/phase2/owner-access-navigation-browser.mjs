import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from '../../tools/qa/node_modules/playwright-core/index.mjs';
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const base='http://127.0.0.1:'+port,dir='qa-evidence/owner-access-20261124';fs.mkdirSync(dir,{recursive:true});
let server,browser;const rows=[];const fd=fs.openSync(dir+'/browser-server.log','w');
try{
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,APP_ENV:'test',DATABASE_URL:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',fd,fd]});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/owner/login')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,300));}assert(ready);
 browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();page.setDefaultTimeout(12000);page.on("pageerror",e=>console.error("LOCAL_PAGE_ERROR",e.message));let allowed=true,bound=false,authStatus=200,bindCalls=0;const requests=[];
  await context.route(base+'/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;requests.push({path,portal:req.headers()['x-villacheck-portal']});
   let status=200,body={};
   if(path==='/api/auth/admin-me') {status=authStatus;body=status===200?{user:{id:'synthetic-owner',name:'Synthetic Owner',email:'owner@synthetic.invalid',role:'admin',businessPermissions:[]},csrf:'synthetic-only'}:{error:status===401?'กรุณาเข้าสู่ระบบ':'Forbidden'};}
   else if(path==='/api/auth/me'){status=401;body={error:'กรุณาเข้าสู่ระบบ'};}
   else if(path==='/api/phase2/owner-workspace'){status=bound?200:403;body=bound?{workspace:'owner',escalations:[]}:{error:'Forbidden'};}
   else if(path==='/api/phase2/workspaces')body={sessionPortal:'admin',workspaces:[{id:'admin',href:'/admin'},...(bound?[{id:'owner',href:'/owner'}]:[])]};
   else if(path==='/api/phase2/catalog')body={canBindOwner:allowed};
   else if(path==='/api/phase2/owner-session'){bindCalls++;status=allowed&&authStatus===200?200:authStatus===401?401:403;bound=status===200;body=bound?{bound:true}:{error:status===401?'กรุณาเข้าสู่ระบบ':'Forbidden'};}
   else body={items:[],villas:[],pages:[],entries:[],settings:{},tickets:[],packages:[],permissions:[],notifications:[]};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  try{
   await page.goto(base+'/admin#page=admin-tickets');
   if(width===390)await page.locator('.portal-menu-toggle').click();
   await page.getByRole('navigation',{name:'เปลี่ยนพื้นที่ทำงาน / Switch workspace'}).getByRole('link',{name:'Business Owner',exact:true}).waitFor();
   await page.goto(base+'/owner');await page.getByRole('button',{name:/Confirm Owner access/}).waitFor();
   if(width===390)await page.locator('.portal-menu-toggle').click();
   const nav=page.getByRole('navigation',{name:'เปลี่ยนพื้นที่ทำงาน / Switch workspace'});
   await nav.getByRole('link',{name:'Business Owner',exact:true}).waitFor();assert.equal(bindCalls,0);
   assert.equal(await nav.getByRole('link',{name:'Business Owner',exact:true}).getAttribute('href'),'/owner?context=admin');
   await page.screenshot({path:dir+'/unbound-'+width+'.png'});
   allowed=false;await page.evaluate(()=>window.dispatchEvent(new Event('auth-session-changed')));await nav.getByRole('link',{name:'Business Owner',exact:true}).waitFor({state:'detached'});
   // Wait until refresh has finished, then prove ordinary Admin has no Owner link.
   await nav.getByRole('link',{name:'Admin',exact:true}).waitFor();assert.equal(await nav.getByRole('link',{name:'Business Owner',exact:true}).count(),0);
   allowed=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await nav.getByRole('link',{name:'Business Owner',exact:true}).waitFor();
   for(const code of [401,403]){authStatus=code;await page.getByRole('button',{name:/Confirm Owner access/}).click();await page.getByRole('alert').filter({hasText:code===401?'กรุณาเข้าสู่ระบบ':'Forbidden'}).waitFor();assert.equal(bindCalls,0);assert.equal(bound,false);}
   authStatus=200;await page.getByRole('button',{name:/Confirm Owner access/}).click();await page.getByRole('heading',{name:'Business Owner workspace',exact:true}).waitFor();assert.equal(bindCalls,1);
   assert(!requests.some(r=>r.path==='/api/auth/me'));assert(requests.filter(r=>r.path==='/api/auth/admin-me').every(r=>r.portal==='admin'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/bound-'+width+'.png'});
   rows.push({width,status:'PASS_ISOLATED_MOCK_HTTP',checks:['bare Owner uses admin-me','no automatic bind','Owner link from server capability','ordinary Admin no Owner link','session event/focus refresh','401/403 do not bind','explicit confirm opens Owner','no horizontal overflow']});
  }catch(error){await page.screenshot({path:dir+"/failure-"+width+".png"});console.error((await page.locator("body").innerText()).slice(0,1500));throw error;}finally{await context.close();}
 }
}finally{await browser?.close();server?.kill('SIGTERM');fs.closeSync(fd);fs.writeFileSync(dir+'/browser-results.json',JSON.stringify({rows,productionVerified:false,environment:'Local built app, synthetic mocked HTTP; backend checked separately'},null,2));}
console.log(JSON.stringify(rows));
