import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {fixture} from './fixture.mjs';
import {dailyPermissions,ownerPermissions,businessPermissions,permissionForRequest,requireBusinessPermission,withPermissionContext} from '../../server/business-permissions.mjs';
import {changeIndependentOwnerGrant} from '../../server/phase2-owner-capability.mjs';
import {assertWriteSession} from '../../server/write-session.mjs';
import {approvedReviewAuthority} from '../../server/decision-audit.mjs';
const candidate={phase2OwnerCapabilityCandidateEnabled:true,phase2OwnerCapabilityApprovalReference:'SYNTHETIC_PERMISSION_MODEL_NOT_APPROVAL'};
async function actor(f,key='admin'){return {...f.users[key],token_hash:(await f.db.prepare('SELECT token_hash FROM sessions WHERE user_id=? AND expires>?').get(f.users[key].id,Date.now())).token_hash};}
async function owner(f,key='reviewer',slot='dew'){await changeIndependentOwnerGrant(f.db,await actor(f),f.config,{accountId:f.users[key].id,slot,grantReference:'SYNTHETIC_PERMISSION_TEST',action:'grant'});await f.expect('/phase2/owner-session',{},f.sessions[key]);}
test('Permission catalog separates daily operations from business configuration and rejects unknown/forged permissions',async t=>{
 const f=await fixture(candidate);t.after(f.close);const a=await actor(f),m=await actor(f,'merchant');
 assert.deepEqual((await businessPermissions(f.db,a,f.config)).permissions,[...dailyPermissions]);
 for(const p of dailyPermissions)await requireBusinessPermission(f.db,a,f.config,p);
 for(const p of ownerPermissions)await assert.rejects(requireBusinessPermission(f.db,a,f.config,p),e=>e.status===403);
 for(const p of [...dailyPermissions,...ownerPermissions])await assert.rejects(requireBusinessPermission(f.db,{...m,businessOwner:true,businessPermissions:[p]},f.config,p),e=>e.status===403);
 await assert.rejects(requireBusinessPermission(f.db,a,f.config,'arbitrary.superuser'),e=>e.status===403);
 assert.equal(permissionForRequest('POST','/api/admin/future-sensitive-operation'),'unmapped.admin');
 await assert.rejects(requireBusinessPermission(f.db,a,f.config,permissionForRequest('POST','/api/admin/future-sensitive-operation')),e=>e.status===403);
 for(const [method,path,p] of [['POST','/api/admin/receiving-bank','bank.manage'],['POST','/api/admin/packages/basic','packages.configure'],['POST','/api/admin/subscriptions/'+randomUUID(),'memberships.manage'],['POST','/api/admin/settings','system.configure'],['POST','/api/admin/promotions','promotions.configure'],['POST','/api/admin/payment-gateway','gateway.configure'],['POST','/api/admin/access-roles','roles.manage'],['POST','/api/invoices/'+randomUUID()+'/confirm','payments.review'],['POST','/api/admin/owner-verification','kyc.review']])assert.equal(permissionForRequest(method,path),p);
});
test('Ordinary Admin can use operational APIs but bank/system/role requests are denied server-side',async t=>{
 const f=await fixture(candidate);t.after(f.close);
 for(const path of ['/admin/accounts?role=user','/admin/reports','/admin/cms','/admin/audit-log'])await f.expect(path,undefined,f.sessions.admin);
 for(const path of ['/admin/receiving-bank','/admin/settings','/admin/access-roles']){await f.expect(path,undefined,f.sessions.admin,403);await f.expect(path,{action:'grant',accountId:f.users.admin.id,capability:'BUSINESS_OWNER',slot:'dew',reason:'FORGED'},f.sessions.admin,403);}
 await f.expect('/admin/audit-log',{action:'delete'},f.sessions.admin,403);
 assert.equal(Number((await f.db.prepare("SELECT count(*) n FROM system_settings WHERE key LIKE 'phase2:proposed-owner:%'").get()).n),0);
});
test('Owner inherits operations without rewriting primary identity; revocation removes inherited access but preserves real Admin',async t=>{
 const f=await fixture(candidate);t.after(f.close);await owner(f);const a=await actor(f,'reviewer');
 for(const p of [...dailyPermissions,...ownerPermissions])await requireBusinessPermission(f.db,a,f.config,p);
 for(const path of ['/admin/accounts?role=user','/admin/cms','/admin/settings','/admin/audit-log','/admin/access-roles'])await f.expect(path,undefined,f.sessions.reviewer);
 const me=await f.expect('/auth/admin-me',undefined,f.sessions.reviewer);assert.equal(me.user.role,'admin');assert.equal(me.user.primaryRole,'user');assert.equal(me.user.businessOwner,true);
 const projected=withPermissionContext({...a,primaryRole:'user',role:'admin',adminSession:true},f.config,'system.configure',true);await assertWriteSession(f.db,projected);
 await changeIndependentOwnerGrant(f.db,await actor(f),f.config,{accountId:a.id,action:'revoke'});
 await assert.rejects(assertWriteSession(f.db,projected),e=>e.status===403);await f.expect('/admin/accounts?role=user',undefined,f.sessions.reviewer,403);
 assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(a.id)).role,'user');assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(f.users.admin.id)).role,'admin');
});
test('Admin edits content but cannot change business/core settings by save, restore or publishing Owner draft',async t=>{
 const f=await fixture(candidate);t.after(f.close);const state=await f.expect('/admin/cms',undefined,f.sessions.admin),content=structuredClone(state.draft.content);content.site.description='SYNTHETIC CONTENT UPDATE';
 const saved=await f.expect('/admin/cms/save',{revision:state.draft.revision,content},f.sessions.admin);
 for(const change of [c=>c.business.monthlyRenewalMonths=12,c=>c.site.paymentInstructions='changed bank',c=>c.site.accent='#112233']){const next=structuredClone(saved.draft.content);change(next);await f.expect('/admin/cms/save',{revision:saved.draft.revision,content:next},f.sessions.admin,403);}
 await owner(f);const next=structuredClone(saved.draft.content);next.site.accent='#112233';const ownerDraft=await f.expect('/admin/cms/save',{revision:saved.draft.revision,content:next},f.sessions.reviewer);
 await f.expect('/admin/cms/publish',{revision:ownerDraft.draft.revision},f.sessions.admin,403);
 await f.expect('/admin/cms/publish',{revision:ownerDraft.draft.revision},f.sessions.reviewer);
});
test('Only Owner manages independent roles; no duplicate accounts, native Admin removal or last Owner revocation',async t=>{
 const f=await fixture(candidate);t.after(f.close);await owner(f);const before=Number((await f.db.prepare('SELECT count(*) n FROM users').get()).n);
 await f.expect('/admin/access-roles',{accountId:f.users.unverified.id,capability:'ADMIN',action:'grant',reason:'SYNTHETIC approved management'},f.sessions.reviewer);
 const grant=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('admin_access:'+f.users.unverified.id)).value);assert.equal(grant.state,'ACTIVE');assert.equal(grant.role,'admin');
 await f.expect('/admin/access-roles',{accountId:f.users.unverified.id,capability:'ADMIN',action:'revoke',reason:'SYNTHETIC revoke'},f.sessions.reviewer);
 await f.expect('/admin/access-roles',{accountId:f.users.admin.id,capability:'ADMIN',action:'revoke',reason:'SYNTHETIC unsafe native removal'},f.sessions.reviewer,409);
 await f.expect('/admin/access-roles',{accountId:f.users.reviewer.id,capability:'BUSINESS_OWNER',action:'revoke',reason:'SYNTHETIC last Owner'},f.sessions.reviewer,409);
 assert.equal(Number((await f.db.prepare('SELECT count(*) n FROM users').get()).n),before);assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(f.users.admin.id)).role,'admin');
});
test('KYC review records actor/time/outcome atomically and Merchant cannot read Audit or review others',async t=>{
 const f=await fixture(candidate);t.after(f.close);const v=f.villas[2],row=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('ownership_documents:'+v.id)).value);row.documents[0].status='pending';row.history=[];
 await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(row),'ownership_documents:'+v.id);
 const data={villaId:v.id,documentId:row.documents[0].id,action:'review',status:'rejected',remark:'SYNTHETIC mismatch',revision:row.revision};
 await f.expect('/admin/ownership-documents',data,f.sessions.merchant,403);await f.expect('/admin/ownership-documents',data,f.sessions.admin);
 const log=await f.expect('/admin/audit-log',undefined,f.sessions.admin),d=log.decisions.find(r=>r.targetId===data.documentId);assert.equal(d.actorId,f.users.admin.id);assert.equal(d.outcome,'REJECTED');assert.equal(d.kind,'KYC');assert.equal(d.previousStatus,'pending');assert.equal(d.newStatus,'rejected');assert.equal(d.effectiveRole,'ADMIN');assert.equal(d.effectivePermission,'kyc.review');assert.equal(d.action,'ownership_document.review');assert.equal(d.result,'REJECTED');assert.match(d.requestId,/^[a-f0-9-]{36}$/);assert(Number.isFinite(Date.parse(d.at)));await f.expect('/admin/audit-log',undefined,f.sessions.merchant,403);
});
test('Owner-only KYC approval remains verifiable through its scoped audit, without granting a database Admin role',async t=>{
 const f=await fixture(candidate);t.after(f.close);await owner(f);const v=f.villas[2],key='ownership_documents:'+v.id,row=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)).value),documentId=row.documents[0].id;
 assert.equal(await approvedReviewAuthority(f.db,f.users.reviewer,documentId,new Date().toISOString(),'OWNERSHIP_DOCUMENT'),false);
 row.documents[0].status='pending';row.history=[];await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(row),key);
 await f.expect('/admin/ownership-documents',{villaId:v.id,documentId,action:'review',status:'accepted',remark:'SYNTHETIC review complete',revision:row.revision},f.sessions.reviewer);
 const updated=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)).value),reviewedAt=updated.documents[0].reviewedAt;
 assert.equal(await approvedReviewAuthority(f.db,f.users.reviewer,documentId,reviewedAt,'OWNERSHIP_DOCUMENT'),true);
 assert.equal(await approvedReviewAuthority(f.db,f.users.reviewer,documentId,reviewedAt,'BANK_IDENTITY'),false);
 assert.equal(await approvedReviewAuthority(f.db,f.users.reviewer,randomUUID(),reviewedAt,'OWNERSHIP_DOCUMENT'),false);
 assert.equal((await f.db.prepare('SELECT role FROM users WHERE id=?').get(f.users.reviewer.id)).role,'user');
 f.advance(5000);await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin);
});
test('Admin payment approve/reject records actual actor and outcome; audit failure rolls back simulated payment',async t=>{
 const f=await fixture();t.after(f.close);f.config.phase2Enabled=false;f.config.paymentAccessMode='LEGACY_MANUAL';
 const ids=[];for(const v of f.villas.slice(0,3)){const id=randomUUID();ids.push(id);await f.db.prepare("INSERT INTO invoices(id,villa_id,amount,months,status,proof_id,reference,created,package_id) VALUES (?,?,?,1,'submitted',?,?,?,?)").run(id,v.id,1200,v.document_id,'SYNTHETIC_LOCAL_AUDIT_'+id,new Date().toISOString(),v.package_id);}
 await f.expect('/invoices/'+ids[0]+'/confirm',{},f.sessions.merchant,403);
 const approved=await fetch(f.base+'/api/invoices/'+ids[0]+'/confirm',{method:'POST',headers:{Origin:f.base,Cookie:f.sessions.admin.cookie,'Content-Type':'application/json','X-CSRF-Token':f.sessions.admin.csrf,'X-Request-ID':'FORGED_CLIENT_REFERENCE'},body:'{}'});assert.equal(approved.status,200);const requestId=approved.headers.get('X-Request-ID');await approved.json();assert.match(requestId,/^[a-f0-9-]{36}$/);
 await Promise.all([f.expect('/invoices/'+ids[0]+'/confirm',{},f.sessions.admin),f.expect('/invoices/'+ids[0]+'/confirm',{},f.sessions.admin)]);
 await f.expect('/invoices/'+ids[1]+'/reject',{reason:'SYNTHETIC local test rejection',actorId:'FORGED'},f.sessions.admin);
 let log=await f.expect('/admin/audit-log',undefined,f.sessions.admin);
 for(const [id,outcome] of [[ids[0],'APPROVED'],[ids[1],'REJECTED']]){const ds=log.decisions.filter(r=>r.targetId===id);assert.equal(ds.length,1);const d=ds[0];assert.equal(d.kind,'PAYMENT');assert.equal(d.actorId,f.users.admin.id);assert.equal(d.outcome,outcome);assert.equal(d.result,outcome);assert.equal(d.effectiveRole,'ADMIN');assert.equal(d.effectivePermission,'payments.review');assert.equal(d.previousStatus,'submitted');assert.equal(d.newStatus,outcome==='APPROVED'?'paid':'pending');assert.match(d.requestId,/^[a-f0-9-]{36}$/);if(outcome==='APPROVED')assert.equal(d.requestId,requestId);assert(Number.isFinite(Date.parse(d.at)));}
 await f.db.exec("CREATE FUNCTION reject_decision_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key LIKE 'decision_audit:%' THEN RAISE EXCEPTION 'SYNTHETIC audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_audit BEFORE INSERT ON system_settings FOR EACH ROW EXECUTE FUNCTION reject_decision_audit();");
 await f.expect('/invoices/'+ids[2]+'/confirm',{},f.sessions.admin,500);
 assert.equal((await f.db.prepare('SELECT status FROM invoices WHERE id=?').get(ids[2])).status,'submitted');
 log=await f.expect('/admin/audit-log',undefined,f.sessions.admin);assert(!log.decisions.some(r=>r.targetId===ids[2]));assert(!log.audits.some(r=>r.target_id===ids[2]&&r.action==='invoice.confirm'));
});
