import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,syntheticPassword} from './fixture.mjs';
import {grantAdditionalAdmin} from '../../server/admin-access.mjs';
import {changeIndependentOwnerGrant,activeOwnerGrant} from '../../server/phase2-owner-capability.mjs';
const candidate={phase2OwnerCapabilityCandidateEnabled:true,phase2OwnerCapabilityApprovalReference:'SYNTHETIC_D1_VECTOR_NOT_APPROVAL'};
async function actor(f,key){return {...f.users[key],token_hash:(await f.db.prepare('SELECT token_hash FROM sessions WHERE user_id=? AND expires>?').get(f.users[key].id,Date.now())).token_hash};}
async function grant(f,key,slot='prin'){return changeIndependentOwnerGrant(f.db,await actor(f,'admin'),f.config,{accountId:f.users[key].id,slot,grantReference:'SYNTHETIC_ONLY',action:'grant'});}
test('Identical concurrent trusted Owner grant retries preserve grant, bound session and one audit event',async t=>{
 const f=await fixture(candidate);t.after(f.close);
 const first=await grant(f,'reviewer');await f.expect('/phase2/owner-session',{},f.sessions.reviewer);
 const before=await f.db.prepare("SELECT count(*) AS n FROM system_settings WHERE key LIKE 'phase2:proposed-owner-event:%'").get();
 const retried=await Promise.all(Array.from({length:4},()=>grant(f,'reviewer')));
 for(const current of retried)assert.deepEqual(current,first);
 assert.deepEqual(await f.db.prepare("SELECT count(*) AS n FROM system_settings WHERE key LIKE 'phase2:proposed-owner-event:%'").get(),before);
 await f.expect('/phase2/owner-workspace',undefined,f.sessions.reviewer);
});
test('Malformed persisted account status cannot authorize any Owner slot; valid active and absent status retain access',async t=>{
 const f=await fixture(candidate);t.after(f.close);
 for(const [key,slot] of [['reviewer','prin'],['unverified','game'],['admin','dew']]){
  await grant(f,key,slot);const user=f.users[key],setting='account_status:'+user.id;
  assert(await activeOwnerGrant(f.db,user,f.config));
  for(const value of ['BROKEN_JSON','null','false','0','[]','{}','{"status":"suspended"}','{"status":"unknown"}']){
   await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(setting,value);
   assert.equal(await activeOwnerGrant(f.db,user,f.config),null,'Owner must fail closed: '+slot+' / '+value);
  }
  await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run('{"status":"active"}',setting);assert(await activeOwnerGrant(f.db,user,f.config));
  await f.db.prepare('DELETE FROM system_settings WHERE key=?').run(setting);assert(await activeOwnerGrant(f.db,user,f.config));
 }
 assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(f.users.admin.id)).role,'admin');
});
test('Third Owner on primary User with separate Admin preserves both identities and requires bound Owner session',async t=>{
 const f=await fixture(candidate);t.after(f.close);const target=f.users.reviewer;
 await grantAdditionalAdmin(f.db,await actor(f,'admin'),target,{sha256:'a'.repeat(64),targets:[target]});
 const login=await f.request('/auth/admin-login',{email:target.email,password:syntheticPassword});assert.equal(login.status,200);
 const admin={cookie:login.cookie,csrf:login.body.csrf,role:'admin'};
 await grant(f,'reviewer','dew');await f.expect('/phase2/owner-workspace',undefined,admin,403);
 await f.expect('/phase2/owner-session',{},admin);await f.expect('/phase2/owner-workspace',undefined,admin);
 const c=await f.expect('/phase2/catalog',undefined,admin);assert.equal(c.canAdmin,true);assert.equal(c.canDecide,true);
 await f.expect('/phase2/owner-workspace',undefined,f.sessions.reviewer,403);
 await changeIndependentOwnerGrant(f.db,await actor(f,'admin'),f.config,{accountId:target.id,action:'revoke'});
 await f.expect('/phase2/owner-workspace',undefined,admin,403);assert.equal((await f.expect('/phase2/catalog',undefined,admin)).canAdmin,true);
 assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(target.id)).role,'user');
});
test('Third explicit Owner slot preserves both existing slots and primary Admin; no implicit or invalid grants',async t=>{
 const f=await fixture(candidate);t.after(f.close);
 await grant(f,'reviewer','prin');await grant(f,'unverified','game');
 assert.equal((await f.expect('/phase2/catalog',undefined,f.sessions.admin)).canDecide,false);
 await grant(f,'admin','dew');await f.expect('/phase2/owner-workspace',undefined,f.sessions.admin,403);
 for(const key of ['admin','reviewer','unverified'])await f.expect('/phase2/owner-session',{},f.sessions[key]);
 const c=await f.expect('/phase2/catalog',undefined,f.sessions.admin);assert.equal(c.canDecide,true);assert.equal(c.canAdmin,true);
 assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(f.users.admin.id)).role,'admin');
 await assert.rejects(grant(f,'foreign','dew'),e=>e.status===403);await assert.rejects(grant(f,'foreign','arbitrary'),e=>e.status===403);
 await changeIndependentOwnerGrant(f.db,await actor(f,'admin'),f.config,{accountId:f.users.admin.id,action:'revoke'});
 assert.equal((await f.expect('/phase2/catalog',undefined,f.sessions.admin)).canDecide,false);
 for(const key of ['reviewer','unverified'])assert.equal((await f.expect('/phase2/catalog',undefined,f.sessions[key])).canDecide,true);
 assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(f.users.admin.id)).role,'admin');
});
test('PROPOSED Owner capability is disabled by default; no grant or activation from HTTP',async t=>{const f=await fixture();t.after(f.close);await assert.rejects(grant(f,'reviewer'),e=>e.status===403);await f.expect('/phase2/owner-session',{},f.sessions.reviewer,403);assert.equal((await f.expect('/phase2/catalog',undefined,f.sessions.admin)).canDecide,false);});
test('PROPOSED Owner-only can read/decide independently without Admin; Admin-only cannot decide',async t=>{const f=await fixture(candidate);t.after(f.close);await grant(f,'reviewer');await grant(f,'unverified','game');
 const escalation=(await f.expect('/phase2/escalations',{kind:'POLICY_CHANGE',reason:'SYNTHETIC ONLY'},f.sessions.admin)).escalation;
 for(const key of ['reviewer','unverified']){await f.expect('/phase2/policy',undefined,f.sessions[key],403);await f.expect('/phase2/owner-session',{},f.sessions[key]);const c=await f.expect('/phase2/catalog',undefined,f.sessions[key]);assert.equal(c.canDecide,true);assert.equal(c.canAdmin,true);await f.expect('/phase2/policy',undefined,f.sessions[key]);await f.expect('/admin/accounts?role=user',undefined,f.sessions[key]);await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions[key]);}
 await f.expect('/phase2/escalations',{id:escalation.id,revision:1,decision:'approved',reason:'SYNTHETIC'},f.sessions.admin,403);
 await f.expect('/phase2/escalations',{id:escalation.id,revision:1,decision:'approved',reason:'SYNTHETIC'},f.sessions.reviewer);
 const second=(await f.expect('/phase2/escalations',{kind:'POLICY_CHANGE',reason:'SYNTHETIC'},f.sessions.admin)).escalation;
 await f.expect('/phase2/escalations',{id:second.id,revision:1,decision:'changes',reason:'SYNTHETIC'},f.sessions.unverified);
 for(const key of ['reviewer','unverified'])assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(f.users[key].id)).role,'user');
});
test('PROPOSED per-account revoke is immediate; regrant cannot revive stale binding; other Owner unaffected',async t=>{const f=await fixture(candidate);t.after(f.close);await grant(f,'reviewer');await grant(f,'unverified','game');for(const k of ['reviewer','unverified'])await f.expect('/phase2/owner-session',{},f.sessions[k]);
 await changeIndependentOwnerGrant(f.db,await actor(f,'admin'),f.config,{accountId:f.users.reviewer.id,action:'revoke'});assert.equal((await f.expect('/phase2/catalog',undefined,f.sessions.reviewer)).canDecide,false);assert.equal((await f.expect('/phase2/catalog',undefined,f.sessions.unverified)).canDecide,true);
 await grant(f,'reviewer');await f.expect('/phase2/policy',undefined,f.sessions.reviewer,403);await f.expect('/phase2/owner-session',{},f.sessions.reviewer);await f.expect('/phase2/policy',undefined,f.sessions.reviewer);
 await f.db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(f.users.reviewer.id);await f.expect('/phase2/policy',undefined,f.sessions.reviewer,401);
});
test('PROPOSED denies ordinary User/Merchant, forged CSRF/fields and trusted-operator misuse',async t=>{const f=await fixture(candidate);t.after(f.close);
 for(const key of ['reviewer','merchant','foreign'])await f.expect('/phase2/owner-session',{},f.sessions[key],403);
 await grant(f,'reviewer');assert.equal((await f.request('/phase2/owner-session',{}, {...f.sessions.reviewer,csrf:'FORGED'})).status,403);await f.expect('/phase2/owner-session',{role:'admin'},f.sessions.reviewer,400);
 await assert.rejects(changeIndependentOwnerGrant(f.db,await actor(f,'merchant'),f.config,{accountId:f.users.foreign.id,slot:'game',grantReference:'FORGED',action:'grant'}),e=>e.status===403);
 await assert.rejects(grant(f,'unverified','prin'),e=>e.status===403);
 await f.expect('/phase2/owner-session',{},f.sessions.reviewer);await f.db.prepare('UPDATE users SET role=? WHERE id=?').run('merchant',f.users.reviewer.id);await f.expect('/phase2/policy',undefined,f.sessions.reviewer,403);
});
test('PROPOSED Owner decision preserves audit and cannot imply policy or grant mutation',async t=>{const f=await fixture(candidate);t.after(f.close);await grant(f,'reviewer');await f.expect('/phase2/owner-session',{},f.sessions.reviewer);const before=(await f.expect('/phase2/policy',undefined,f.sessions.reviewer)).policy;const e=(await f.expect('/phase2/escalations',{kind:'TRIAL_EXCEPTION',reason:'SYNTHETIC'},f.sessions.admin)).escalation;const r=await f.expect('/phase2/escalations',{id:e.id,revision:1,decision:'approved',reason:'SYNTHETIC'},f.sessions.reviewer);assert.equal(r.automaticPolicyOrGrantChanges,false);assert.equal(r.escalation.decidedBy,f.users.reviewer.id);assert.deepEqual((await f.expect('/phase2/policy',undefined,f.sessions.reviewer)).policy,before);assert.equal((await f.db.prepare("SELECT count(*)::int n FROM audits WHERE action='phase2.escalation.decided' AND actor_id=?").get(f.users.reviewer.id)).n,1);});
