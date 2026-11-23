import {releaseManifestPath} from './release-test-source.mjs';
import {fixturePhoto} from './master-test-fixtures.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {pathToFileURL} from 'node:url';import {createHash,randomUUID} from 'node:crypto';import {createUser} from './database.mjs';import {merchantFixture} from '../scripts/continuation-local-fixture.mjs';
const manifest=releaseManifestPath,m=JSON.parse(fs.readFileSync(manifest)),load=f=>import(pathToFileURL(m.artifact+'/'+f)),sha=b=>createHash('sha256').update(b).digest('hex');
test('Exact candidate preserves target/scope/default-deny guards and same Production core without Demo assets',async()=>{
 const {scope,actorAllowed,requestAllowed}=await load('server/staging-interactive-policy.mjs');assert.equal(scope.protectedVillaIds.length,57);assert.throws(()=>actorAllowed({id:randomUUID(),email:'unallocated@villacheck.example',role:'admin'}))
 assert.equal(requestAllowed('POST','/api/auth/register-user-phone'),false);assert.equal(requestAllowed('POST','/api/auth/register-phone'),false);assert.equal((await import('./staging-interactive-policy.mjs')).requestAllowed('POST','/api/auth/mfa/enroll'),false);assert.equal(requestAllowed('POST','/api/admin/settings'),true);assert.equal(requestAllowed('POST','/api/admin/unlisted-resource'),false)
 const base=JSON.parse(fs.readFileSync('reports/staging-release-candidate-20261106/vc04-timing-qa/fix-manifest.json'))
 for(const file of ['server/shared-application-environment.mjs','backend/prisma.service.ts'])assert.equal(m.files.find(f=>f.file===file).sha256,base.files.find(f=>f.file===file).sha256,file)
 const runtime=await load('server/production-runtime.mjs');assert.equal((await import('./production-runtime.mjs')).productionRequestAllowed('POST','/api/auth/mfa/enroll','PRELAUNCH'),false);assert.equal(runtime.productionRequestAllowed('POST','/api/admin/settings','PRELAUNCH'),false);assert.equal(runtime.productionRequestAllowed('POST','/api/auth/mfa/enroll','unknown'),false);
 const prod={files:m.files.filter(f=>!f.file.startsWith('public/demo/'))};assert(prod.files.length<m.files.length);for(const f of prod.files){assert(!f.file.startsWith('public/demo/'));assert.equal(f.sha256,m.files.find(s=>s.file===f.file).sha256)}

 for(const f of m.files)assert.equal(sha(fs.readFileSync(m.artifact+'/'+f.file)),f.sha256,f.file)
 const {stagingDemoEnvironment}=await load('server/staging-demo-safety.mjs');const url='postgresql://neondb_owner:LOCAL_ONLY_SYNTHETIC@ep-lively-wildflower-azuxgq19.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';const env=stagingDemoEnvironment({VERCEL_PROJECT_ID:'prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC',DATABASE_URL:url,ADMIN_MFA_ENCRYPTION_KEY:'ab'.repeat(32),ADMIN_PASSWORD:'LOCAL_NOT_A_BOOTSTRAP',THAIBULKSMS_API_KEY:'LOCAL_NOT_A_PROVIDER'})
 assert.equal(env.ADMIN_PASSWORD,undefined);assert.equal(env.THAIBULKSMS_API_KEY,undefined);assert.equal(env.ADMIN_MFA_ENCRYPTION_KEY,undefined);assert.equal(env.SEED_DEMO_ACCOUNTS,'false')
})
test('Exact restricted Stage candidate denies mutations of every protected57 fixture without any current second-factor enrollment surface',async t=>{
 const saved=process.env.VILLACHECK_STAGE_TEST_MANIFEST;process.env.VILLACHECK_STAGE_TEST_MANIFEST=manifest;let f;try{f=await merchantFixture()}finally{if(saved===undefined)delete process.env.VILLACHECK_STAGE_TEST_MANIFEST;else process.env.VILLACHECK_STAGE_TEST_MANIFEST=saved}t.after(()=>f.close())
 const {scope}=await load('server/staging-interactive-policy.mjs'),owner=await createUser(f.db,'original-fixture@local.synthetic.invalid','LocalPassword123','Original fixture','merchant'),doc=randomUUID();await f.db.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(doc,owner.id,'LOCAL.pdf','application/pdf',Buffer.from('%PDF-LOCAL'))
 for(const id of scope.protectedVillaIds)await f.db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created) VALUES (?,?,?,'Local','Fixture',?,'basic',?,'approved',?,?)").run(id,owner.id,'Protected local '+id,owner.email,doc,'VC-LOCAL-'+id,'2026-10-01')
 const rows=await f.db.prepare('SELECT * FROM villas ORDER BY id').all(),before=sha(JSON.stringify(rows)),admin=await f.login(f.admin),merchant=await f.login(f.merchant),user=await f.login(f.other)
 for(const id of scope.protectedVillaIds)await f.expect('/villas/'+id+'/review',{status:'approved'},admin,403)
 await f.expect('/merchant/villas/'+scope.protectedVillaIds[0],{name:'DEMO forbidden',nameEn:'DEMO forbidden'},merchant,403)
 await f.expect('/auth/register-user-phone',{email:'new@villacheck.example',phone:'0812345678'},undefined,503)
 assert.equal(sha(JSON.stringify(await f.db.prepare('SELECT * FROM villas ORDER BY id').all())),before)
})
test('Restricted Stage phone enrollment uses exact pending allocations and provider authorization without opening original records',async t=>{
 const saved=process.env.VILLACHECK_STAGE_TEST_MANIFEST;process.env.VILLACHECK_STAGE_TEST_MANIFEST=manifest;let f
 const phones={user:'+66812345601',merchant:'+66812345602'},requests=[]
 try{f=await merchantFixture({phoneRegistrationEnabled:true,stagingRegistrationPhones:phones,stagingSmsAllowlist:Object.values(phones),otpSecret:'LOCAL_ONLY_SCOPE_SECRET_12345678901234567890',thaiBulkSmsOtpKey:'LOCAL_ONLY',thaiBulkSmsOtpSecret:'LOCAL_ONLY',smsFetch:async(url,options)=>{requests.push(new URL(url).pathname);if(url.endsWith('/request'))return {ok:true,status:200,json:async()=>({status:'success',token:'LOCAL_ONLY_'+requests.length})};const data=new URLSearchParams(options.body);return {ok:data.get('pin')==='123456',status:data.get('pin')==='123456'?200:400,json:async()=>({status:data.get('pin')==='123456'?'success':'invalid'})}}})}finally{if(saved===undefined)delete process.env.VILLACHECK_STAGE_TEST_MANIFEST;else process.env.VILLACHECK_STAGE_TEST_MANIFEST=saved}t.after(()=>f.close())
 const {scope}=await load('server/staging-interactive-policy.mjs');const sessions={}
 await f.expect('/auth/register-user-phone',{email:'unallocated@villacheck.example',phone:phones.user,name:'DEMO User',password:'LocalPassword123'},undefined,403)
 assert.equal(requests.length,0)
 for(const role of ['user','merchant']){
  const actor=[...scope.users,...scope.merchants].find(a=>a.pendingRegistration&&a.role===role),path=role==='user'?'/auth/register-user-phone':'/auth/register-phone'
  await f.expect(path,{email:actor.email,phone:role==='user'?phones.merchant:phones.user,name:'DEMO controlled',businessNameEn:'DEMO COMPANY',password:'LocalPassword123'},undefined,403)
  const pending=await f.expect(path,{email:actor.email,phone:phones[role],name:'DEMO controlled '+role,businessNameEn:'DEMO COMPANY',password:'LocalPassword123',id:randomUUID(),role:'admin'},undefined,202)
  await f.expect('/auth/otp/verify',{challengeId:pending.body.challengeId,code:'123456'},undefined,403)
  const complete=await f.expect('/auth/registration/verify',{challengeId:pending.body.challengeId,code:'123456'},{cookie:pending.cookie})
  assert.equal(complete.body.user.id,actor.id);assert.equal(complete.body.user.role,role)
  const session={cookie:complete.cookie,csrf:complete.body.csrf};sessions[role]=session
  await f.expect(role==='user'?'/user/profile':'/merchant/profile',undefined,session)
  const stored=await f.db.prepare('SELECT id,role,phone FROM users WHERE id=?').get(actor.id);assert.equal(stored.phone,phones[role]);assert.equal(stored.role,role)
 }
 assert.equal(requests.filter(path=>path.endsWith('/request')).length,2)
 const merchant=scope.merchants.find(a=>a.pendingRegistration),admin=await f.login(f.admin)
 const {merchantDemoPdf}=await import('./merchant-test-fixture.mjs')
 const created=await f.expect('/villas',{photo:fixturePhoto(),name:'DEMO Security Scope Villa',nameEn:'DEMO Security Scope Villa',province:'ภูเก็ต',merchant:'DEMO Merchant',email:merchant.email,document:{name:'DEMO-NOT-LEGAL.pdf',data:'data:application/pdf;base64,'+merchantDemoPdf().toString('base64')}},sessions.merchant,201)
 assert.equal(created.body.createdId,merchant.villaIds[0]);await f.expect('/villas/'+created.body.createdId+'/review',{status:'approved',verificationLevel:'VERIFIED'},sessions.merchant,403)
 await f.expect('/villas/'+created.body.createdId+'/review',{status:'approved',verificationLevel:'VERIFIED'},admin,409);await f.expect('/admin/property-media',{villaId:created.body.createdId,mediaId:'cover'},admin);await f.expect('/villas/'+created.body.createdId+'/review',{status:'approved',verificationLevel:'VERIFIED'},admin)
 assert.equal((await f.db.prepare('SELECT status FROM villas WHERE id=?').get(created.body.createdId)).status,'approved')
 const state=await f.expect('/state',undefined,sessions.merchant);assert(state.body.villas.every(v=>v.id===created.body.createdId));assert.equal(await f.db.prepare('SELECT id FROM users WHERE id=?').get('00000000-0000-4000-8000-000000000001'),undefined)
})
