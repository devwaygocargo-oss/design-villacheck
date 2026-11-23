import {publicPhase1Policy} from '../../server/public-phase1-release.mjs';
import {productionRequestAllowed} from '../../server/production-runtime.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {phase2ProductionPolicy,phase2ProductionReadAllowed,phase2ProductionTarget as target} from '../../server/phase2-production.mjs';
import {phase2Runtime,requirePhase2,requirePhase2Database} from '../../server/phase2-policy.mjs';
import {phase2Api,settlePhase2Sandbox} from '../../server/phase2.mjs';
import {fixture} from './fixture.mjs';
const env=()=>({APP_ENV:'production',VERCEL_ENV:'production',VERCEL_PROJECT_ID:target.projectId,APP_URL:'https://www.villacheckth.com',DATABASE_URL:`postgresql://${target.role}:synthetic-not-a-real-password@${target.host}/${target.database}?sslmode=verify-full`,PHASE2_ENABLED:'true',PHASE2_PRODUCTION_RELEASE_APPROVAL:'USER_REQUEST:PHASE2_RELEASE_20261118',PAYMENT_ACCESS_MODE:'DISABLED',PHASE2_SANDBOX_ENABLED:'false',PHASE2_EMAIL_ENABLED:'false',PHASE2_OWNER_CAPABILITY_CANDIDATE_ENABLED:'false',DEMO_MODE:'false',SEED_DEMO_ACCOUNTS:'false',SEED_PUBLIC_DEMO_DATA:'false'});
const config=()=>({...phase2Runtime(env()),appEnvironment:'production',productionRuntime:true,productionReleaseMode:'PHASE1_PUBLIC'});
test('Production opt-in requires exact target and no payment, provider, Owner or Demo activation',()=>{
 assert.equal(phase2ProductionPolicy({...env(),PHASE2_ENABLED:'false'}),null);assert.equal(config().phase2ProductionCoreOnly,true);
 for(const change of [{PHASE2_OWNER_QA_READ_ENABLED:'true'},{VERCEL_PROJECT_ID:'prj_staging'},{VERCEL_ENV:'preview'},{PHASE2_PRODUCTION_RELEASE_APPROVAL:''},{DATABASE_URL:'postgresql://u:p@localhost/staging?sslmode=require'},{PHASE2_SANDBOX_ENABLED:'true'},{PAYMENT_ACCESS_MODE:'MANUAL'},{PHASE2_EMAIL_ENABLED:'true'},{PHASE2_OWNER_CAPABILITY_CANDIDATE_ENABLED:'true'},{PHASE2_BUSINESS_OWNER_IDS:'["not-authorized"]'},{PHASE2_OMISE_TEST_SECRET_KEY:'skey_test_synthetic'},{DEMO_MODE:'true'}])assert.throws(()=>phase2ProductionPolicy({...env(),...change}));
 const db={dialect:'postgres',connectionIdentity:{host:target.host,database:target.database,role:target.role}};requirePhase2(config());requirePhase2Database(db,config());assert.throws(()=>requirePhase2Database(db));for(const key of ['host','database','role'])assert.throws(()=>requirePhase2Database({...db,connectionIdentity:{...db.connectionIdentity,[key]:'wrong'}},config()));
 assert(phase2ProductionReadAllowed('GET','/api/phase2/workspace'));for(const method of ['POST','PUT','DELETE'])assert(!phase2ProductionReadAllowed(method,'/api/phase2/policy'));assert(!phase2ProductionReadAllowed('GET','/api/phase2/unknown'));
});
test('Production core reads actual isolated PostgreSQL data while financial/policy/trial writes and Owner elevation stay denied',async t=>{
 const f=await fixture();t.after(f.close);const c=config();const db={...f.db,connectionIdentity:{host:target.host,database:target.database,role:target.role}};
 const actor={...f.users.merchant,primaryRole:'merchant'};const call=(path,method='GET',who=actor)=>phase2Api(db,who,{method},'/api/phase2/'+path,new URL('http://localhost/api/phase2/'+path),async()=>({}),c);
 const before=(await f.db.prepare('SELECT count(*)::int n FROM system_settings').get()).n;
 const catalog=await call('catalog');assert.equal(catalog.productionCoreOnly,true);assert.equal(catalog.canDecide,false);assert.equal(catalog.ownerCandidate,false);assert.equal(catalog.sandboxOnly,false);const w=await call('workspace');assert(w.villas.length>0);assert(w.villas.every(v=>v.owner_id===actor.id));
 for(const p of ['orders','payment','sandbox','policy','owner-session','notices','escalations','reviews','media','promotions'])await assert.rejects(()=>call(p,'POST'),e=>e.status===503);
 await assert.rejects(()=>settlePhase2Sandbox(db,actor,c,{}),e=>e.status===503);
 assert.equal((await f.db.prepare('SELECT count(*)::int n FROM system_settings').get()).n,before);assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(actor.id)).role,'merchant');
 const admin={...f.users.admin,primaryRole:'admin'};const activate=()=>phase2Api(db,admin,{method:'POST'},'/api/phase2/trial',new URL('http://localhost'),async()=>({villaId:f.villas[0].id}),c);const first=await activate();assert.equal(first.trial.environment,'PRODUCTION');assert.equal(Date.parse(first.trial.endsAt)-Date.parse(first.trial.startsAt),90*86400000);assert.equal((await activate()).created,false);assert.equal((await call('workspace')).grants.length,1);
 await f.db.prepare('DELETE FROM system_settings WHERE key=?').run('phase2:v1:account-trial:'+actor.id);await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('merchant_free_period:'+actor.id,JSON.stringify({retained:true}));await assert.rejects(activate,e=>e.status===409);
});

test('Outer Next Production allowlist admits only approved Phase2 routes after the complete target contract',()=>{
 const e={...env(),PRODUCTION_RELEASE_MODE:'PHASE1_PUBLIC',BUSINESS_INITIALIZATION_MODE:'EXISTING_CATALOG',PUBLIC_PHASE1_RELEASE_APPROVAL:'OWNER_DIRECTIVE:SYNTHETIC_TEST_ONLY'};
 const p=publicPhase1Policy(e);assert.equal(p.phase2ProductionCoreOnly,true);
 for(const route of ['catalog','workspace','public','policy'])assert.equal(productionRequestAllowed('GET','/api/phase2/'+route,'PHASE1_PUBLIC',p),true);
 assert.equal(productionRequestAllowed('POST','/api/phase2/trial','PHASE1_PUBLIC',p),true);
 for(const route of ['orders','sandbox','policy','payment','owner-session','reviews'])assert.equal(productionRequestAllowed('POST','/api/phase2/'+route,'PHASE1_PUBLIC',p),false);
 assert.equal(productionRequestAllowed('GET','/api/phase2/catalog','PHASE1_PUBLIC',publicPhase1Policy({...e,PHASE2_ENABLED:'false'})),false);
 assert.throws(()=>publicPhase1Policy({...e,VERCEL_PROJECT_ID:'prj_staging'}));
});

test('Integrated workspace capabilities use authenticated identity; ordinary roles cannot enter Owner or spoof roles',async t=>{
 const f=await fixture();t.after(f.close);const c=config(),db={...f.db,connectionIdentity:{host:target.host,database:target.database,role:target.role}};
 const call=(who,path,portal='user')=>phase2Api(db,who,{method:'GET',headers:{'x-villacheck-portal':portal}},'/api/phase2/'+path,new URL('http://localhost/api/phase2/'+path),async()=>({}),c);
 assert.deepEqual((await call(f.users.admin,'workspaces','admin')).workspaces.map(w=>w.id),['admin']);const adminAccess=await call(f.users.admin,'workspaces','admin');assert.equal(adminAccess.accountId,f.users.admin.id);assert.equal(adminAccess.sessionPortal,'admin');assert.equal((await call(f.users.merchant,'workspaces')).sessionPortal,'user');
 assert.deepEqual((await call(f.users.merchant,'workspaces','merchant')).workspaces.map(w=>w.id),['user','merchant']);
 assert.deepEqual((await call(f.users.reviewer,'workspaces')).workspaces.map(w=>w.id),['user']);
 for(const who of [f.users.admin,f.users.merchant,f.users.reviewer]){await assert.rejects(()=>call(who,'owner-workspace','admin'),e=>e.status===403);await assert.rejects(()=>call({...who,role:'owner'},'workspaces'),e=>e.status===403)}
 for(const route of ['workspaces','owner-workspace']){assert(phase2ProductionReadAllowed('GET','/api/phase2/'+route));assert(!phase2ProductionReadAllowed('POST','/api/phase2/'+route))}
 assert.equal((await f.db.prepare("SELECT count(*)::int n FROM system_settings WHERE key LIKE 'phase2:proposed-owner:%'").get()).n,0);
});

test('Explicit Production-only Owner contract permits binding only while payments, outbound and Sandbox remain disabled',async()=>{
 const {productionOwnerApproval:approval}=await import('../../server/phase2-production.mjs');
 const e={...env(),PHASE2_PRODUCTION_RELEASE_APPROVAL:approval,PHASE2_PRODUCTION_OWNER_APPROVAL:approval,PHASE2_OWNER_CAPABILITY_CANDIDATE_ENABLED:'true',PHASE2_OWNER_CAPABILITY_APPROVAL_REFERENCE:approval};
 const p=phase2ProductionPolicy(e);assert.equal(p.phase2ProductionOwnerMode,true);assert.deepEqual(Object.keys(p.phase2ProductionOwnerAccounts).sort(),['game','prin']);
 for(const delta of [{PHASE2_PRODUCTION_OWNER_APPROVAL:''},{PHASE2_OWNER_CAPABILITY_APPROVAL_REFERENCE:''},{PAYMENT_ACCESS_MODE:'MANUAL'},{PHASE2_SANDBOX_ENABLED:'true'},{PHASE2_EMAIL_ENABLED:'true'},{VERCEL_ENV:'preview'}])assert.throws(()=>phase2ProductionPolicy({...e,...delta}));
 assert(phase2ProductionReadAllowed('POST','/api/phase2/owner-session',p));for(const path of ['orders','sandbox','policy','payment','reviews'])assert(!phase2ProductionReadAllowed('POST','/api/phase2/'+path,p));assert(!phase2ProductionReadAllowed('POST','/api/phase2/owner-session',{}));
 const publicPolicy=publicPhase1Policy({...e,PRODUCTION_RELEASE_MODE:'PHASE1_PUBLIC',BUSINESS_INITIALIZATION_MODE:'EXISTING_CATALOG',PUBLIC_PHASE1_RELEASE_APPROVAL:'OWNER_DIRECTIVE:SYNTHETIC_TEST_ONLY'});assert(productionRequestAllowed('POST','/api/phase2/owner-session','PHASE1_PUBLIC',publicPolicy));
});
test('Production Owner scope binds existing Admin identities and denies Developer/foreign slot without changing primary roles',async t=>{
 const {productionOwnerApproval:approval}=await import('../../server/phase2-production.mjs');const {changeIndependentOwnerGrant,bindIndependentOwnerSession,activeOwnerGrant}=await import('../../server/phase2-owner-capability.mjs');const {businessPermissions}=await import('../../server/business-permissions.mjs');const {createUser}=await import('../../server/database.mjs');
 const f=await fixture();t.after(f.close);const second=await createUser(f.db,'second-'+crypto.randomUUID()+'@synthetic.invalid','Synthetic-Local-Only-123!','SYNTHETIC second admin','admin');
 // Only this disposable test replaces the server-owned identity inventory; no real company identity is impersonated.
 const c={...config(),phase2ProductionApproval:approval,phase2ProductionOwnerMode:true,phase2OwnerCapabilityCandidateEnabled:true,phase2OwnerCapabilityApprovalReference:approval,phase2ProductionOwnerAccounts:{game:{id:f.users.admin.id,email:f.users.admin.email},prin:{id:second.id,email:second.email}}},db={...f.db,connectionIdentity:{host:target.host,database:target.database,role:target.role}},actor={...f.users.admin,token_hash:(await f.db.prepare('SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires DESC').get(f.users.admin.id)).token_hash};
 const readOnlyBefore=Number((await f.db.prepare('SELECT count(*) n FROM system_settings').get()).n);const catalog=await phase2Api(db,actor,{method:'GET',headers:{'x-villacheck-portal':'admin'}},'/api/phase2/catalog',new URL('http://localhost'),async()=>({}),c);assert(catalog.packages.every(p=>p.vatMode==='EXCLUSIVE'&&p.billingDays===30));assert.equal(catalog.businessResponses.financeSignOff,false);assert.equal(catalog.businessResponses.prinApproval,false);assert.equal(catalog.newBannerEnabled,false);assert.equal(Number((await f.db.prepare('SELECT count(*) n FROM system_settings').get()).n),readOnlyBefore);
 for(const data of [{accountId:f.users.reviewer.id,slot:'dew'},{accountId:f.users.admin.id,slot:'dew'},{accountId:f.users.foreign.id,slot:'prin'}])await assert.rejects(changeIndependentOwnerGrant(db,actor,c,{...data,action:'grant',grantReference:'SYNTHETIC_ONLY'}),e=>e.status===403);
 for(const [slot,accountId] of [['prin',second.id]])await changeIndependentOwnerGrant(db,actor,c,{slot,accountId,action:'grant',grantReference:'SYNTHETIC_ONLY'});
 assert.equal((await businessPermissions(db,actor,c)).owner,false);await Promise.all([bindIndependentOwnerSession(db,actor,c),bindIndependentOwnerSession(db,actor,c)]);assert.equal((await businessPermissions(db,actor,c)).owner,true);assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(actor.id)).role,'admin');
 const before=await activeOwnerGrant(db,actor,c);await f.db.prepare('UPDATE users SET email=? WHERE id=?').run('changed@synthetic.invalid',actor.id);assert.equal(await activeOwnerGrant(db,{...actor,email:'changed@synthetic.invalid'},c),null);assert(before.id);assert.equal((await f.db.prepare("SELECT count(*)::int n FROM system_settings WHERE key LIKE 'phase2:proposed-owner-event:%'").get()).n,2);await f.db.prepare('UPDATE users SET email=? WHERE id=?').run(actor.email,actor.id);await changeIndependentOwnerGrant(db,actor,c,{accountId:actor.id,action:'revoke'});await assert.rejects(bindIndependentOwnerSession(db,actor,c),e=>e.status===403);assert.equal((await f.db.prepare("SELECT count(*)::int n FROM system_settings WHERE key LIKE 'phase2:proposed-owner-event:%'").get()).n,3);
});
