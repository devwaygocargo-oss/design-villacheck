import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openPostgres} from '../../server/postgres.mjs';
import {createUser,hashPassword} from '../../server/database.mjs';
import {createApp} from '../../server/app.mjs';
import {phase2Defaults} from '../../server/phase2-policy.mjs';
export const syntheticPassword='Synthetic-Local-Only-123!';
export async function fixture(overrides={}){
 const url=process.env.TEST_DATABASE_URL;if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Disposable local PostgreSQL required');
 const schema='p2_'+randomUUID().replaceAll('-',''),control=await openPostgres(url,{bootstrap:false});await control.exec('CREATE SCHEMA '+schema);await control.close();
 const db=await openPostgres(url,{options:'-c search_path='+schema});
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('phase2:synthetic-runtime','LOCAL_SYNTHETIC_ONLY');
 const users={};for(const [key,role]of Object.entries({admin:'admin',merchant:'merchant',foreign:'merchant',reviewer:'user',unverified:'user'}))users[key]=await createUser(db,key+'-'+randomUUID()+'@synthetic.invalid',syntheticPassword,'SYNTHETIC '+key,role);
 await db.prepare("INSERT INTO oauth_identities(provider,subject,user_id) VALUES ('google',?,?)").run('SYNTHETIC_LOCAL_ONLY_'+randomUUID(),users.reviewer.id);
 let clock=Date.now();const config={appEnvironment:'development',appUrl:'http://localhost',allowedOrigins:['http://localhost'],phase2Enabled:true,phase2SandboxEnabled:true,phase2PaymentProvider:'LOCAL_SIMULATOR',phase2BusinessOwnerIds:[],phase2OwnerApprovalReference:'',fakeHash:hashPassword('Synthetic-Unused-123!'),otpSecret:'SYNTHETIC_LOCAL_ONLY_SECRET_12345678901234567890',seedDemo:false,paymentAccessMode:'DISABLED',serverless:false,phase2Clock:()=>clock,...overrides};
 const server=createApp(db,config);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;config.allowedOrigins.push(base);
 const request=async(path,data,s,extra={})=>{const r=await fetch(base+'/api'+path,{method:data===undefined?'GET':'POST',headers:{Origin:base,...(data===undefined?{}:{'Content-Type':'application/json'}),...(s?{Cookie:s.cookie,'X-CSRF-Token':s.csrf,'X-VillaCheck-Portal':s.role}:{}),...extra},...(data===undefined?{}:{body:JSON.stringify(data)})});const body=await r.json();return {status:r.status,body,cookie:r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')};};
 const expect=async(path,data,s,status=200)=>{const r=await request(path,data,s);assert.equal(r.status,status,path+' expected status '+status);return r.body;};
 const sessions={};for(const [key,u]of Object.entries(users)){const r=await request(u.role==='admin'?'/auth/admin-login':'/auth/login',{email:u.email,password:syntheticPassword});assert.equal(r.status,200,'Synthetic login '+key);sessions[key]={cookie:r.cookie,csrf:r.body.csrf,role:u.role};}
 const villas=[];
 for(const plan of ['basic','starter','pro','premium']){
  const id=randomUUID(),doc=randomUUID(),photo=randomUUID(),at=new Date(clock-60000).toISOString(),image='/api/public/property-media-file/'+photo;
  await db.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(doc,users.merchant.id,'SYNTHETIC-NOT-LEGAL.pdf','application/pdf',Buffer.from('%PDF-1.4 SYNTHETIC NOT LEGAL'));
  await db.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(photo,users.merchant.id,'property-media','image/jpeg',fs.readFileSync('public/demo/villas/villa-1.jpg'));
  await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,expires,created,photo_url,photo_uploaded_at,photo_reviewed_at) VALUES (?,?,?,'ภูเก็ต','SYNTHETIC',?,?,?,'approved',?,?,?,?,?,?)").run(id,users.merchant.id,'SYNTHETIC '+plan,users.merchant.email,plan,doc,'VC-'+id,new Date(clock+365*86400000).toISOString(),at,image,at,at);
  await db.prepare('UPDATE villas SET reviewed_at=?,reviewed_by=? WHERE id=?').run(at,users.admin.id,id);const v=await db.prepare('SELECT * FROM villas WHERE id=?').get(id);villas.push(v);
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('villa_approved:'+id,JSON.stringify({villa:v,media:[{id:photo,villaId:id,url:image,kind:'image',uploadedAt:at,takenAt:null,reviewedAt:at}],recordedAt:at}));
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('ownership_documents:'+id,JSON.stringify({documents:[{id:doc,status:'accepted',reviewedBy:users.admin.id,reviewedAt:at}],revision:1}));
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('property_media:'+id+':'+photo,JSON.stringify({id:photo,villaId:id,kind:'image',uploadedAt:at,takenAt:null,reviewedAt:at,reviewedBy:users.admin.id,url:image}));
 }
 // Seed isolated test configuration directly; never invent an Owner identity/approval.
 const setPolicy=async changes=>{const row=await db.prepare("SELECT value FROM system_settings WHERE key='phase2:v1:policy'").get();const current=row?JSON.parse(row.value):phase2Defaults;const reminderVector=changes.noticeDays?.length?{remindersEnabled:true,noticeChannels:['IN_APP'],noticeTimezone:'UTC',noticeScheduleApprovalReference:'SYNTHETIC_REMINDER_VECTOR_NOT_APPROVAL'}:{};const policy={...current,...reminderVector,...changes,revision:current.revision+1,approvalReference:'SYNTHETIC_CONFIG_NOT_BUSINESS_APPROVAL'};await db.prepare("INSERT INTO system_settings(key,value) VALUES ('phase2:v1:policy',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(policy));return {policy};};
 const buy=async(v=villas[2],plan=v.package_id)=>expect('/phase2/orders',{villaId:v.id,packageId:plan,requestKey:randomUUID()},sessions.merchant);
 const settle=async(o,status='succeeded')=>expect('/phase2/sandbox',{orderId:o.id,status},sessions.admin);
 const close=async()=>{await new Promise(r=>server.close(r));await db.exec('DROP SCHEMA '+schema+' CASCADE');await db.close();};
 return {db,schema,url,server,base,config,users,sessions,villas,request,expect,setPolicy,buy,settle,now:()=>clock,advance:ms=>{clock+=ms;},close};
}
export const approvedTestBilling={trialScope:'MERCHANT_ACCOUNT',billingCycle:'MONTHLY',billingUnit:'VILLA',billingDays:30,monthlyBoundary:'EXPLICIT_ELAPSED_DAYS',vatMode:'INCLUSIVE',vatBasisPoints:0,vatRoundingPolicy:'HALF_UP',financeApprovalReference:'SYNTHETIC_FINANCE_VECTOR_NOT_BUSINESS_APPROVAL',invoiceRequirementsConfirmed:true,paidStartRule:'AFTER_TRIAL_OR_SETTLEMENT'};
