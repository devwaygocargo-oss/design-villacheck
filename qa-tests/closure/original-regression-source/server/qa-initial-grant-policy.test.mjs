import {fixtureCover} from './master-test-fixtures.mjs';
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {qaGrantRuntimeContext,assertQaSyntheticGrant,verifyQaSyntheticGrant,isolatedQaGrantTarget as target} from './qa-initial-grant-policy.mjs'
import {productionRuntimePolicy} from './production-runtime.mjs'
import {openTestDatabase} from './test-database.mjs'
import {createUser,addMonths} from './database.mjs'
import {createApp} from './app.mjs'
import {recordApprovedGrant,initialGrantForReview} from './membership-lifecycle.mjs'
const reference='QA_ONLY:PHASE12C_INITIAL_V1',terms={status:'APPROVED',scope:'ISOLATED_QA_ONLY',target,approvalReference:reference,revision:'qa-initial-v1',billingCycle:'MONTHLY',initialGrantPolicy:'EXPLICIT_ADMIN_GRANT',renewal:'NO_AUTOMATIC_RENEWAL',startTrigger:'DOCUMENTS_COMPLETE_AND_ADMIN_ACTIVATION'}
const url=new URL('postgresql://runtime:synthetic@localhost/db');url.hostname='ep-solitary-rain-b3dx6378.c-4.ap-southeast-1.aws.neon.tech';url.username='villacheck_qa_runtime';url.pathname='/villacheck_qa_phase1';url.searchParams.set('sslmode','verify-full')
const env={APP_ENV:'staging',VERCEL_PROJECT_ID:target.vercelProjectId,DATABASE_URL:url.toString(),STAGING_RELEASE_POLICY:'PHASE1',PHASE1_ACTIVATION_MODE:'APPROVED_EXPLICIT_GRANTS',PHASE1_INITIAL_GRANT_POLICY:reference,QA_SYNTHETIC_GRANT_APPROVAL:reference}
test('QA-only approval is opt-in, hard-bound to QA role/target and never accepted on Production or Shared Staging',()=>{
 assert.equal(qaGrantRuntimeContext({}),undefined)
 const qaContext=qaGrantRuntimeContext(env);assert.equal(qaContext.scope,'ISOLATED_QA_ONLY')
 for(const patch of [{APP_ENV:'production'},{VERCEL_PROJECT_ID:'prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC'},{QA_SYNTHETIC_GRANT_APPROVAL:'OWNER-APPROVAL'},{PHASE1_INITIAL_GRANT_POLICY:'other'},{PHASE1_ACTIVATION_MODE:'BLOCKED'},{DATABASE_URL:url.toString().replace('villacheck_qa_runtime','villacheck_qa_owner')},{DATABASE_URL:url.toString().replace('villacheck_qa_phase1','villacheck_production')}])assert.throws(()=>qaGrantRuntimeContext({...env,...patch}),/QA synthetic/)
 assert.throws(()=>productionRuntimePolicy({...env,APP_ENV:'production'}),/QA synthetic/)
 for(const connectionIdentity of [{host:'ep-square-resonance-aohwf0z5.c-4.ap-southeast-1.aws.neon.tech',database:'villacheck_production',role:'villacheck_runtime'},{host:'localhost',database:'test',role:'postgres'}])assert.throws(()=>assertQaSyntheticGrant({connectionIdentity},{terms,qaContext}),/QA synthetic/)
})
test('Synthetic QA grant prepares no entitlement and activates only in Admin review transaction; foreign target/actor rejected',{skip:!process.env.TEST_DATABASE_URL},async t=>{
 const db=await openTestDatabase();t.after(()=>db.close());const actor=await createUser(db,'qa-admin@phase12c.invalid','SyntheticLocalPassword123','QA','admin'),owner=await createUser(db,'qa-merchant@phase12c.invalid','SyntheticLocalPassword123','QA','merchant'),id=randomUUID(),doc=randomUUID();
 await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(doc,owner.id,'synthetic.pdf','application/pdf',Buffer.from('%PDF-1.4'))
 await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,'basic','local')").run(owner.id)
 await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,created) VALUES (?,?,'QA','ชลบุรี','QA',?,'basic',?,'pending','local')").run(id,owner.id,owner.email,doc)
 await fixtureCover(db,id,owner.id);
 const qaContext={...qaGrantRuntimeContext(env),localRehearsal:true},grant={reason:'QA-only technical activation',evidenceRefs:['LOCAL-QA-APPROVAL'],id:randomUUID(),ownerId:owner.id,villaId:id,packageId:'basic',state:'APPROVED_PENDING_ACTIVATION',source:'QA_SYNTHETIC_NO_CHARGE',approvalReference:reference,termsRevision:terms.revision}
 await assert.rejects(recordApprovedGrant(db,{actor,grant,terms}),/QA synthetic/)
 await assert.rejects(recordApprovedGrant(db,{actor,grant,terms:{...terms,target:{...target,projectId:'green-sun-56847773'}},qaContext}),/QA synthetic/)
 assert.equal((await recordApprovedGrant(db,{actor,grant,terms,qaContext})).created,true)
 assert.equal((await recordApprovedGrant(db,{actor,grant,terms,qaContext})).created,false)
 assert.equal((await db.prepare('SELECT expires FROM subscriptions WHERE owner_id=?').get(owner.id)).expires,null)
 const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(id),at='2026-10-26T15:00:00.000Z'
 await assert.rejects(db.transaction(()=>initialGrantForReview(db,villa,reference,Date.parse(at),owner,qaContext)),/Admin/)
 await assert.rejects(db.transaction(()=>initialGrantForReview(db,villa,reference,Date.parse(at),actor)),/QA synthetic/)
 const app=createApp(db,{productionRuntime:true,productionReleaseMode:'PHASE1',phase1RequirementsRevision:'LOCAL-QA-ONLY',phase1ActivationMode:'APPROVED_EXPLICIT_GRANTS',phase1InitialGrantPolicy:reference,phase1EmailOtpDelivery:'DISABLED',paymentAccessMode:'DISABLED',appUrl:'http://localhost',allowedOrigins:['http://localhost'],otpSecret:'x'.repeat(48),qaGrantContext:qaContext})
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));const base='http://127.0.0.1:'+app.address().port
 const login=await fetch(base+'/api/auth/admin-login',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password:'SyntheticLocalPassword123'})});assert.equal(login.status,200);const csrf=(await login.json()).csrf,cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
 const review=()=>fetch(base+'/api/villas/'+id+'/review',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:cookie,'x-csrf-token':csrf},body:JSON.stringify({status:'approved'})})
 assert.equal((await review()).status,409,'Unreviewed cover must block grant activation');await db.prepare('UPDATE villas SET photo_reviewed_at=? WHERE id=?').run(new Date().toISOString(),id);
 assert.equal((await review()).status,200)
 const result=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('membership_grant:'+id)).value),approved=await db.prepare('SELECT * FROM villas WHERE id=?').get(id)
 assert.equal(result.source,'QA_SYNTHETIC_NO_CHARGE');assert.equal(result.validFrom,approved.reviewed_at);assert.equal(result.validUntil,addMonths(result.validFrom,1));assert.equal(approved.status,'approved');assert(approved.qr)
 assert.equal((await review()).status,409)
 assert.equal((await db.prepare('SELECT count(*) AS n FROM invoices').get()).n,0)
})

test('Matching QA metadata still requires actual SQL schema/role proof before a synthetic grant',async()=>{
 const context=qaGrantRuntimeContext(env),db={connectionIdentity:{host:url.hostname,database:target.database,role:'villacheck_qa_runtime'},prepare:()=>({get:async()=>({database:target.database,schema:'other',role:'villacheck_qa_runtime'})})}
 await assert.rejects(verifyQaSyntheticGrant(db,{terms,qaContext:context}),/QA synthetic/)
})
