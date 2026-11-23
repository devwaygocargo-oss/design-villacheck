import {releaseManifestPath} from './release-test-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {openTestDatabase} from './test-database.mjs';
import {createUser,hashPassword} from './database.mjs';
const m=JSON.parse(fs.readFileSync(releaseManifestPath));
const load=f=>import(pathToFileURL(m.artifact+'/'+f));
const {productionRuntimePolicy,productionRequestAllowed,initializeRuntimeCatalog,verifyProductionData}=await load('server/production-runtime.mjs');
const env={APP_ENV:'production',NODE_ENV:'production',APP_URL:'https://www.villacheckth.com',DATABASE_URL:'postgresql://runtime:local-only@localhost/local',OTP_SECRET:'x'.repeat(48),COOKIE_SECURE:'true',PAYMENT_ACCESS_MODE:'DISABLED',OMISE_TEST_ENABLED:'false',DEMO_MODE:'false',SEED_DEMO_ACCOUNTS:'false',SEED_PUBLIC_DEMO_DATA:'false',PRODUCTION_RELEASE_MODE:'PRELAUNCH',BUSINESS_INITIALIZATION_MODE:'DISABLED_UNTIL_APPROVAL',OTP_DELIVERY_MODE:'DISABLED'};
test('Explicit PRELAUNCH empty-business policy requires both closed flags, preserves legacy PRELAUNCH and Stage',()=>{
 const p=productionRuntimePolicy(env);assert.equal(p.releaseMode,'PRELAUNCH');assert.equal(p.prelaunch,true);assert.equal(p.businessInitializationDisabled,true);
 for(const change of[{BUSINESS_INITIALIZATION_MODE:undefined},{OTP_DELIVERY_MODE:undefined},{BUSINESS_INITIALIZATION_MODE:'APPROVED'},{OTP_DELIVERY_MODE:'LIVE'},{SEED_PUBLIC_DEMO_DATA:'true'},{PAYMENT_ACCESS_MODE:'LIVE'},{THAIBULKSMS_API_KEY:'not-authorized'}])assert.throws(()=>productionRuntimePolicy({...env,...change}));
 const legacy={...env};delete legacy.BUSINESS_INITIALIZATION_MODE;delete legacy.OTP_DELIVERY_MODE;assert.deepEqual(productionRuntimePolicy(legacy),{prelaunch:true});assert.equal(productionRequestAllowed('GET','/api/state','PRELAUNCH'),false);assert.deepEqual(productionRuntimePolicy({APP_ENV:'staging',NODE_ENV:'production'}),{prelaunch:false});
});
test('PRELAUNCH closed-business read manifest never enables business, providers, workers or unauthenticated private access',()=>{
 const p=productionRuntimePolicy(env);
 for(const path of ['/api/config','/api/public/villas','/api/state','/api/admin/cms','/api/admin/packages','/api/user/profile','/api/merchant/profile'])assert.equal(productionRequestAllowed('GET',path,'PRELAUNCH',p),true,path);
 for(const method of ['POST','PATCH','DELETE'])for(const path of ['/api/villas','/api/merchant/villas/00000000-0000-4000-8000-000000000001','/api/admin/settings','/api/auth/register','/api/auth/otp/request','/api/payments','/api/public/reports','/api/admin/ownership-documents'])assert.equal(productionRequestAllowed(method,path,'PRELAUNCH',p),false,method+' '+path);
 for(const path of ['/api/ops/cron','/api/unknown'])assert.equal(productionRequestAllowed('GET',path,'PRELAUNCH',p),false,path);
 assert.equal(productionRequestAllowed('GET','/api/auth/oauth/google/callback','PRELAUNCH',p),true);assert.equal(productionRequestAllowed('POST','/api/auth/admin-login','PRELAUNCH',p),true);assert.equal(productionRequestAllowed('POST','/api/reviews','PRELAUNCH',p),true);assert.equal(productionRequestAllowed('DELETE','/api/reviews','PRELAUNCH',p),false);
});
test('Exact PRELAUNCH application serves empty/read-only real DB models, authenticates existing Local Admin, retains all data',async t=>{
 const db=await openTestDatabase();await db.prepare('DELETE FROM package_catalog').run();await db.prepare('DELETE FROM system_settings').run();
 const password='DisposablePrelaunchOnly123',admin=await createUser(db,'owner@legitimate-local.invalid',password,'ผู้ดูแล Local','admin');
 let seeds=0;await initializeRuntimeCatalog(db,env,()=>seeds++);assert.equal(seeds,0);await verifyProductionData(db,{allowUninitializedCatalog:true});
 const {createApp}=await load('server/app.mjs'),p=productionRuntimePolicy(env),app=createApp(db,{appEnvironment:'production',productionRuntime:true,productionReleaseMode:'PRELAUNCH',productionPrelaunch:p.prelaunch,businessInitializationDisabled:p.businessInitializationDisabled,paymentAccessMode:'DISABLED',otpSecret:'x'.repeat(48),serverless:true,appUrl:'http://localhost',allowedOrigins:['http://localhost'],fakeHash:hashPassword('TimingOnlyLocal123')});await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.close(r));await db.close()});const base='http://127.0.0.1:'+app.address().port;let session;
 async function request(path,data,status=200){const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:'http://localhost',...(data===undefined?{}:{'Content-Type':'application/json'}),...(session?{Cookie:session.cookie,'x-csrf-token':session.csrf,'x-villacheck-portal':'admin'}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});const body=await r.json();assert.equal(r.status,status,path);return {body,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};}
 const config=(await request('/api/config')).body;assert.equal(config.releaseMode,'PRELAUNCH');assert.equal(config.businessFeaturesEnabled,false);assert.equal(config.otp.sms,false);assert.deepEqual((await request('/api/public/villas')).body.villas,[]);await request('/api/state',undefined,401);await request('/api/documents/00000000-0000-4000-8000-000000000001',undefined,401);
 const login=await request('/api/auth/admin-login',{email:admin.email,password});session={cookie:login.cookie,csrf:login.body.csrf};assert.equal(login.body.user.id,admin.id);assert.deepEqual((await request('/api/state')).body.villas,[]);assert.deepEqual((await request('/api/admin/packages')).body.packages,[]);assert((await request('/api/admin/cms')).body.published);await request('/api/user/profile',undefined,403);
 for(const path of ['/api/villas','/api/auth/otp/request','/api/auth/register','/api/admin/settings'])await request(path,{},503);await request('/api/auth/admin-logout',{});await request('/api/auth/admin-me',undefined,401);
 assert.equal(Number((await db.prepare('SELECT count(*) n FROM users').get()).n),1);for(const table of ['villas','documents','package_catalog','system_settings','invoices','mails'])assert.equal(Number((await db.prepare('SELECT count(*) n FROM '+table).get()).n),0,table);
});
