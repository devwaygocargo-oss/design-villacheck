// Local disposable accounts only. No real identities, grants or hosted requests.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from '../../tools/qa/node_modules/playwright-core/index.mjs';
import {fixture,syntheticPassword} from './fixture.mjs';
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const base='http://127.0.0.1:'+port,dir='qa-evidence/owner-login',results=[];fs.mkdirSync(dir,{recursive:true});
const fd=fs.openSync(dir+'/server.log','w');let child,browser;
try{
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,APP_ENV:'test',DATABASE_URL:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',fd,fd]});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/owner/login')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}assert(ready);
 browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const width of [1440,390]){
  const f=await fixture(),ctx=await browser.newContext({viewport:{width,height:1000}});try{
   await ctx.route(base+'/api/**',async route=>{const req=route.request(),u=new URL(req.url());const response=await route.fetch({url:f.base+u.pathname+u.search,headers:{...req.headers(),origin:f.base}});await route.fulfill({response});});
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.name));
   await p.goto(base+'/owner');await p.waitForURL(base+'/owner/login');await p.getByRole('heading',{name:'เข้าสู่ระบบ Business Owner',exact:true}).waitFor();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:dir+'/login-'+width+'.png',fullPage:true});results.push({width,flow:'Guest Owner route reaches dedicated login',status:'PASS'});
   await p.getByLabel('อีเมล Admin').fill(f.users.admin.email);await p.getByLabel('รหัสผ่าน',{exact:true}).fill('incorrect-synthetic-password');await p.getByRole('button',{name:'เข้าสู่ระบบ Business Owner',exact:true}).click();await p.getByRole('alert').waitFor();assert.equal(new URL(p.url()).pathname,'/owner/login');results.push({width,flow:'Incorrect credentials stay on login with error',status:'PASS'});
   await p.getByLabel('รหัสผ่าน',{exact:true}).fill(syntheticPassword);await p.getByRole('button',{name:'เข้าสู่ระบบ Business Owner',exact:true}).click();await p.waitForURL(base+'/owner?context=admin');await p.getByRole('heading',{name:'Business Owner — Access denied',exact:true}).waitFor();assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(f.users.admin.id)).role,'admin');results.push({width,flow:'Existing ADMIN logs in but receives no implicit Owner grant',status:'PASS'});
   await p.screenshot({path:dir+'/denied-'+width+'.png',fullPage:true});
   await p.goto(base+'/owner/login');await p.waitForURL(base+'/owner?context=admin');await p.getByRole('heading',{name:'Business Owner — Access denied',exact:true}).waitFor();results.push({width,flow:'Existing Admin session reused without another login',status:'PASS'});
   await p.getByRole('button',{name:'ออกจากระบบ / Logout',exact:true}).click();await p.waitForURL(base+'/admin/login');await p.getByRole('heading',{name:'เข้าสู่ระบบ Admin',exact:true}).waitFor();await p.getByRole('link',{name:'เข้าสู่ระบบ Business Owner',exact:true}).click();await p.waitForURL(base+'/owner/login');await p.getByRole('heading',{name:'เข้าสู่ระบบ Business Owner',exact:true}).waitFor();results.push({width,flow:'Logout removes Admin session; Admin login links to Owner login',status:'PASS'});
   await f.expect('/phase2/owner-workspace',undefined,f.sessions.merchant,403);assert.equal((await f.db.prepare("SELECT count(*)::int n FROM system_settings WHERE key LIKE 'phase2:proposed-owner:%'").get()).n,0);assert.deepEqual(errors,[]);results.push({width,flow:'Merchant denied server-side, no grants created or browser errors',status:'PASS'});
  }finally{await ctx.unrouteAll({behavior:'ignoreErrors'});await ctx.close();await f.close();}
 }
 console.log(JSON.stringify({status:'PASS',checks:results.length,target:'LOCAL_COMPILED_UI_REAL_DISPOSABLE_API',hostedWrites:0}));
}finally{await browser?.close();if(child){child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,3000);});}fs.closeSync(fd);fs.writeFileSync(dir+'/results.json',JSON.stringify({results,hostedWrites:0,realAccountsChanged:0},null,2)+'\n');}
