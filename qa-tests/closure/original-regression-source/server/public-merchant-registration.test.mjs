import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openTestDatabase} from './test-database.mjs';
import {createUser,hashPassword} from './database.mjs';

const root=path.resolve(process.env.VC_AUTH_TEST_SOURCE_DIR||'artifacts/public-merchant-registration-20261030');
const nonce='a'.repeat(64),otherNonce='b'.repeat(64);
const cfg={appEnvironment:'test',otpSecret:'isolated-public-otp-secret-over-32-characters',smtpFrom:'sender@example.test',thaiBulkSmsOtpKey:'isolated-key',thaiBulkSmsOtpSecret:'isolated-secret',otpLoginTestTiming:true,otpLoginProviderTimeoutMs:30,otpLoginInvalidDelayMs:55,otpLoginEnabled:true};
function delivery(){
 const codes=new Map(),tokens=new Map();let sent=0;
 return {codes,get sent(){return sent;},transport:{sendMail:async m=>{codes.set(m.to,m.text.match(/\b\d{6}\b/)[0]);sent++;}},fetch:async(url,options)=>{
  const fields=new URLSearchParams(options.body);
  if(url.endsWith('/request')){const token=randomUUID(),code=String(100000+sent);tokens.set(token,code);codes.set('+'+fields.get('msisdn'),code);sent++;return{ok:true,status:200,json:async()=>({status:'success',token})};}
  return{ok:true,status:200,json:async()=>({status:tokens.get(fields.get('token'))===fields.get('pin')?'success':'invalid'})};
 }};
}
for(const environment of ['staging','production'])test(environment+': public role-separated OTP acceptance',async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());
 const {createLoginOtp}=await import(pathToFileURL(root+'/'+environment+'/server/login-otp.mjs'));
 const d=delivery(),otp=createLoginOtp(db,cfg,d.transport,d.fetch),options={existingAccountLogin:true,browserNonce:nonce};
 const request=async(data,extra={})=>{const c=await otp.request(data,null,{...options,...extra});await otp.runDeliveries();return c;};
 const verify=(c,destination,extra={})=>otp.verify({challengeId:c.challengeId,code:d.codes.get(destination),accountType:'admin',purpose:'register'},null,{...options,...extra});
 const age=()=>db.prepare('UPDATE login_otps SET created=?').run(Date.now()-3600001);
 const signup={accountType:'merchant',purpose:'register',registration:{name:'ผู้ประกอบการทดสอบ',businessNameEn:'Isolated Merchant'}};
 let member,merchant,phoneMerchant;
 await t.test('new User is created only after email verification; wrong browser fails; existing User logs in',async()=>{
  const contact='shared@example.test',c=await request({accountType:'user',channel:'email',destination:contact});
  assert.equal(await db.prepare('SELECT id FROM users WHERE email=?').get(contact),undefined);
  await assert.rejects(verify(c,contact,{browserNonce:otherNonce}),e=>e.status===401);
  member=await verify(c,contact);assert.equal(member.role,'user');
  await age();const next=await request({accountType:'user',channel:'email',destination:contact});assert.equal((await verify(next,contact)).id,member.id);
 });
 await t.test('User-only contact opens Merchant registration immediately; no OTP or new account',async()=>{
  await age();const sent=d.sent,c=await request({accountType:'merchant',channel:'email',destination:member.email});
  assert.equal(d.sent,sent);assert.deepEqual(c,{registrationRequired:true,nextAction:'register'});assert.equal(c.challengeId,undefined);
  await assert.rejects(verify(c,member.email),e=>e.status===401);assert.equal((await db.prepare('SELECT role FROM users WHERE id=?').get(member.id)).role,'user');
 });
 await t.test('Merchant registration with same email produces separate identity and preserves User',async()=>{
  const before=await db.prepare('SELECT * FROM users WHERE id=?').get(member.id);await age();
  const c=await request({...signup,channel:'email',destination:member.email});merchant=await verify(c,member.email);
  assert.equal(merchant.role,'merchant');assert.notEqual(merchant.id,member.id);
  assert.deepEqual(await db.prepare('SELECT * FROM users WHERE id=?').get(member.id),before);
  const {publicOtpEmail}=await import(pathToFileURL(root+'/'+environment+'/server/role-otp-contacts.mjs'));assert.equal(await publicOtpEmail(db,merchant),member.email);
 });
 await t.test('duplicate registration fails; registered Merchant email login returns same account',async()=>{
  await age();await assert.rejects(request({...signup,channel:'email',destination:member.email}),e=>e.status===409);
  const c=await request({accountType:'merchant',channel:'email',destination:member.email});assert.equal((await verify(c,member.email)).id,merchant.id);
  await assert.rejects(verify(c,member.email),e=>e.status===401);
 });
 await t.test('new User phone registration and same phone Merchant registration do not collide',async()=>{
  const contact='+66810000101',c=await request({accountType:'user',channel:'sms',destination:'0810000101'});const user=await verify(c,contact);assert.equal(user.role,'user');
  await age();const reg=await request({...signup,channel:'sms',destination:contact});phoneMerchant=await verify(reg,contact);assert.equal(phoneMerchant.role,'merchant');assert.notEqual(phoneMerchant.id,user.id);
  await age();const login=await request({accountType:'merchant',channel:'sms',destination:contact});assert.equal((await verify(login,contact)).id,phoneMerchant.id);
  await age();const userLogin=await request({accountType:'user',channel:'sms',destination:contact});assert.equal((await verify(userLogin,contact)).id,user.id);
 });
 await t.test('linking requires Merchant session; second channel logs in to same Merchant; no takeover',async()=>{
  const data={accountType:'merchant',purpose:'link_identity',channel:'sms',destination:'+66810000102'};
  await assert.rejects(request(data),e=>e.status===403);
  const c=await request(data,{bindingUser:merchant});await assert.rejects(verify(c,data.destination,{bindingUser:phoneMerchant}),e=>e.status===401);
  assert.equal((await verify(c,data.destination,{bindingUser:merchant})).id,merchant.id);
  await age();const login=await request({...data,purpose:'login'});assert.equal((await verify(login,data.destination)).id,merchant.id);
  await age();await assert.rejects(request(data,{bindingUser:phoneMerchant}),e=>e.status===409);
 });
 await t.test('unknown Merchant and Admin contacts route to registration; unverified profile phone cannot authenticate the existing Merchant',async()=>{
  await createUser(db,'admin-only@example.test','IsolatedPassword123','Admin','admin');
  const owner=await createUser(db,'contact-only@example.test','IsolatedPassword123','Contact','merchant');await db.prepare('UPDATE users SET phone=? WHERE id=?').run('+66810000103',owner.id);
  for(const [channel,destination] of [['email','unregistered@example.test'],['email','admin-only@example.test']]){
   const sent=d.sent,c=await request({accountType:'merchant',channel,destination});assert.equal(d.sent,sent);assert.deepEqual(c,{registrationRequired:true,nextAction:'register'});await assert.rejects(verify(c,destination),e=>e.status===401);
  }
  const contact='+66810000103',beforeCount=(await db.prepare('SELECT count(*) n FROM users').get()).n;
  const challenge=await request({accountType:'merchant',channel:'sms',destination:contact});assert.deepEqual(challenge,{registrationRequired:true,nextAction:'register'});await assert.rejects(verify(challenge,contact),e=>e.status===401);assert.equal(await db.prepare("SELECT user_id FROM oauth_identities WHERE provider='phone_otp' AND subject=?").get(contact),undefined);assert.equal((await db.prepare('SELECT count(*) n FROM users').get()).n,beforeCount);
 });
 await t.test('invalid, expired, exhausted attempts and simultaneous replay fail closed',async()=>{
  let c=await request({accountType:'user',channel:'email',destination:'invalid@example.test'});
  for(let i=0;i<5;i++)await assert.rejects(otp.verify({...c,code:'xxxxxx'},null,options),e=>e.status===401);
  for(let i=0;i<5;i++)await assert.rejects(otp.verify({...c,code:'999999'},null,options),e=>e.status===401);
  await assert.rejects(verify(c,'invalid@example.test'),e=>e.status===401);
  c=await request({...signup,channel:'email',destination:'expired@example.test'});await db.prepare('UPDATE login_otps SET expires=? WHERE id=?').run(Date.now()-1,c.challengeId);await assert.rejects(verify(c,'expired@example.test'),e=>e.status===401);
  c=await request({...signup,channel:'email',destination:'concurrent@example.test'});const results=await Promise.allSettled([verify(c,'concurrent@example.test'),verify(c,'concurrent@example.test')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 });
 await t.test('rate limiting is shared across role/purpose; resend invalidates old challenge',async()=>{
  const contact='rate@example.test',c=await request({accountType:'user',channel:'email',destination:contact});
  await assert.rejects(request({...signup,channel:'email',destination:contact}),e=>e.status===429);
  await age();const next=await request({accountType:'user',channel:'email',destination:contact});await assert.rejects(verify(c,contact),e=>e.status===401);await verify(next,contact);
 });
 await t.test('suspended account remains suspended even after provider verification',async()=>{
  await age();const c=await request({accountType:'merchant',channel:'email',destination:member.email});
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('account_status:'+merchant.id,JSON.stringify({status:'suspended'}));await assert.rejects(verify(c,member.email),e=>e.status===401);
 });
});

for(const environment of ['staging','production'])test(environment+': HTTP sessions, logout, role boundaries, CSRF and linking',async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());const d=delivery();
 const {createApp}=await import(pathToFileURL(root+'/'+environment+'/server/app.mjs'));
 const origin='http://localhost:8443',server=createApp(db,{...cfg,interactiveDemo:environment==='staging',appUrl:origin,allowedOrigins:[origin],serverless:true,fakeHash:hashPassword('IsolatedPassword123'),smsFetch:d.fetch},d.transport);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const post=(p,data,cookie='',csrf)=>fetch(base+'/api'+p,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...(csrf?{'X-CSRF-Token':csrf}:{})},body:JSON.stringify(data)});
 const cookies=r=>r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const sign=async(data)=>{const r=await post('/auth/otp/request',data);assert.equal(r.status,202);const c=await r.json();await server.runOtpDeliveries();const v=await post('/auth/otp/verify',{challengeId:c.challengeId,code:d.codes.get(data.destination)},cookies(r));assert.equal(v.status,200);return{cookie:cookies(v),...(await v.json())};};
 const u=await sign({channel:'email',destination:'http-user@example.test',accountType:'user'});
 assert.equal(u.user.role,'user');assert.equal((await fetch(base+'/api/merchant/profile',{headers:{Cookie:u.cookie}})).status,403);
 const m=await sign({channel:'email',destination:'http-owner@example.test',accountType:'merchant',purpose:'register',registration:{name:'Merchant',businessNameEn:'Merchant'}});
 assert.equal(m.user.role,'merchant');assert.equal((await fetch(base+'/api/auth/me',{headers:{Cookie:m.cookie}})).status,200);
 for(const p of ['/admin/accounts','/user/profile'])assert.equal((await fetch(base+'/api'+p,{headers:{Cookie:m.cookie}})).status,403,p);
 assert.equal((await post('/auth/otp/request',{channel:'sms',destination:'+66810000104',accountType:'merchant',purpose:'link_identity'},m.cookie,'forged')).status,403);
 const r=await post('/auth/otp/request',{channel:'sms',destination:'+66810000104',accountType:'merchant',purpose:'link_identity'},m.cookie,m.csrf);assert.equal(r.status,202);
 const c=await r.json();await server.runOtpDeliveries();const linked=await post('/auth/otp/verify',{challengeId:c.challengeId,code:d.codes.get('+66810000104')},m.cookie+'; '+cookies(r),m.csrf);assert.equal(linked.status,200);
 assert.equal((await fetch(base+'/api/auth/me',{headers:{Cookie:m.cookie}})).status,401,'session rotated');
 const s={cookie:cookies(linked),...(await linked.json())};assert.equal(s.user.id,m.user.id);
 assert.equal((await post('/auth/logout',{},s.cookie,s.csrf)).status,200);assert.equal((await fetch(base+'/api/auth/me',{headers:{Cookie:s.cookie}})).status,401);
});
