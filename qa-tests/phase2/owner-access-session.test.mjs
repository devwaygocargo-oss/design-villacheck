import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
test('Owner endpoints fail closed for missing, invalid and expired local sessions; ordinary Admin/User cannot bind',async t=>{
 const f=await fixture({phase2OwnerCapabilityCandidateEnabled:true,phase2OwnerCapabilityApprovalReference:'SYNTHETIC_SESSION_REGRESSION'});t.after(f.close);
 for(const key of ['admin','reviewer']){
  assert.equal((await f.expect('/phase2/catalog',undefined,f.sessions[key])).canBindOwner,false);
  await f.expect('/phase2/owner-workspace',undefined,f.sessions[key],403);
  await f.expect('/phase2/owner-session',{},f.sessions[key],403);
  const workspaces=await f.expect('/phase2/workspaces',undefined,f.sessions[key]);assert(!workspaces.workspaces.some(w=>w.id==='owner'));
 }
 for(const path of ['/phase2/owner-workspace','/phase2/workspaces','/auth/admin-me']){
  await f.expect(path,undefined,undefined,401);
  await f.expect(path,undefined,{cookie:'vc_admin_session='+'0'.repeat(64),csrf:'synthetic-only',role:'admin'},401);
 }
 await f.expect('/phase2/owner-session',{},undefined,401);
 await f.db.prepare('UPDATE sessions SET expires=? WHERE user_id=?').run(Date.now()-1000,f.users.admin.id);
 for(const path of ['/auth/admin-me','/phase2/owner-workspace','/phase2/workspaces'])await f.expect(path,undefined,f.sessions.admin,401);
 await f.expect('/phase2/owner-session',{},f.sessions.admin,401);
 assert.equal(Number((await f.db.prepare("SELECT count(*) n FROM system_settings WHERE key LIKE 'phase2:proposed-owner:%'").get()).n),0);
});
