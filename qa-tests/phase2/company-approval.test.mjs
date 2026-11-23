import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './fixture.mjs';
import {approvalReviewDigest} from '../../server/phase2-company-approval.mjs';
const terms={simulationOnly:true,billingUnit:'VILLA',reference:'SYNTHETIC_FINANCE_NOT_APPROVAL',vatBasisPoints:700,vatRoundingPolicy:'HALF_UP'};
const create=(f,patch={})=>({villaId:f.villas[3].id,packageId:'premium',requestKey:randomUUID(),...patch});
const state=async f=>({villas:await f.db.prepare('SELECT * FROM villas ORDER BY id').all(),documents:await f.db.prepare('SELECT * FROM documents ORDER BY id').all(),business:await f.db.prepare("SELECT * FROM system_settings WHERE key NOT LIKE 'phase2:v1:approval-request%' ORDER BY key").all()});
test('Authenticated manual requests serialize concurrent retries without creating payments or entitlements',async t=>{
 const f=await fixture({phase2GameResponses:true});t.after(f.close);const before=await state(f),data=create(f);
 const results=await Promise.all([1,2,3].map(()=>f.expect('/phase2/company-approval-requests',data,f.sessions.merchant)));
 assert.equal(new Set(results.map(r=>r.request.id)).size,1);assert.equal(results.filter(r=>r.created).length,1);assert.equal(results[0].request.status,'PENDING_REVIEW');assert.equal(results[0].request.companyApproved,false);const again=await f.expect('/phase2/company-approval-requests',{...data,requestKey:randomUUID()},f.sessions.merchant);assert.equal(again.request.id,results[0].request.id);assert.equal(again.created,false);
 await f.expect('/phase2/company-approval-requests',{...data,packageId:'basic'},f.sessions.merchant,409);
 assert.equal((await f.expect('/phase2/company-approval-requests',undefined,f.sessions.merchant)).requests.length,1);
 assert.deepEqual(await state(f),before);
});
test('Queue and preview enforce auth, ownership, portal, role and CSRF with no approval/permission endpoint',async t=>{
 const f=await fixture({phase2GameResponses:true,phase2ApprovalPreviewTerms:terms});t.after(f.close);const data=create(f);
 await f.expect('/phase2/company-approval-requests',data,undefined,401);await f.expect('/phase2/company-approval-requests',data,f.sessions.foreign,404);await f.expect('/phase2/company-approval-requests',data,f.sessions.reviewer,403);await f.expect('/phase2/company-approval-requests',data,{...f.sessions.merchant,csrf:'SYNTHETIC_WRONG'},403);
 const {request}=await f.expect('/phase2/company-approval-requests',data,f.sessions.merchant);
 assert.deepEqual((await f.expect('/phase2/company-approval-requests',undefined,f.sessions.foreign)).requests,[]);
 assert.equal((await f.request('/phase2/company-approval-requests',undefined,f.sessions.merchant,{'X-VillaCheck-Portal':'user'})).status,403);
 await f.expect('/phase2/company-approval-preview',{requestId:request.id},f.sessions.merchant,403);
 for(const patch of [{approvedAt:'2026-01-01T00:00:00.000Z'},{vatBasisPoints:0},{companyApproved:true},{totalSatang:1},{userId:f.users.foreign.id}])await f.expect('/phase2/company-approval-requests',{...create(f),...patch},f.sessions.merchant,400);
 await f.expect('/phase2/company-approval-preview',{requestId:request.id,approvedAt:'2026-01-01T00:00:00.000Z'},f.sessions.admin,400);
 await f.expect('/phase2/company-approval-decisions',{requestId:request.id,approve:true},f.sessions.admin,404);
});
test('Read-only preview integrates explicit VAT with server clock, stays nonfinancial, and preserves all business records',async t=>{
 const f=await fixture({phase2GameResponses:true});t.after(f.close);const {request}=await f.expect('/phase2/company-approval-requests',create(f),f.sessions.merchant);
 await f.expect('/phase2/company-approval-preview',{requestId:request.id},f.sessions.admin,409);
 f.config.phase2ApprovalPreviewTerms=terms;const before=await state(f);
 const {preview}=await f.expect('/phase2/company-approval-preview',{requestId:request.id},f.sessions.admin);
 assert.equal(preview.netSatang,499000);assert.equal(preview.vatSatang,34930);assert.equal(preview.totalSatang,533930);assert.equal(preview.period.startsAt,new Date(f.now()).toISOString());assert.equal(Date.parse(preview.period.endsAt)-f.now(),30*86400000);
 for(const k of ['companyApproved','financeSignOff','financialActionsEnabled','entitlementCreated'])assert.equal(preview[k],false);
 assert.equal((await f.expect('/phase2/company-approval-requests',undefined,f.sessions.admin)).requests[0].status,'PENDING_REVIEW');for(const route of ['orders','payment','sandbox','policy','promotions'])await f.expect('/phase2/'+route,{},f.sessions.admin,503);assert.deepEqual(await state(f),before);
 for(const patch of [{simulationOnly:false},{reference:'NOT_AUTHORITY'},{vatBasisPoints:null},{vatRoundingPolicy:null}]){f.config.phase2ApprovalPreviewTerms={...terms,...patch};await f.expect('/phase2/company-approval-preview',{requestId:request.id},f.sessions.admin,409);}
});
test('Selection, policy or ownership drift invalidates preview and idempotent retry; expired sessions cannot submit',async t=>{
 const f=await fixture({phase2GameResponses:true,phase2ApprovalPreviewTerms:terms});t.after(f.close);const data=create(f),{request}=await f.expect('/phase2/company-approval-requests',data,f.sessions.merchant);
 await f.db.prepare("INSERT INTO system_settings VALUES (?,?)").run('phase2:v1:selection:'+data.villaId,JSON.stringify({grantId:'SYNTHETIC_CHANGED_SELECTION'}));
 await f.expect('/phase2/company-approval-preview',{requestId:request.id},f.sessions.admin,409);await f.expect('/phase2/company-approval-requests',data,f.sessions.merchant,409);
 const next=create(f),second=await f.expect('/phase2/company-approval-requests',next,f.sessions.merchant);await f.setPolicy({higherTierMedia:false});await f.expect('/phase2/company-approval-preview',{requestId:second.request.id},f.sessions.admin,409);
 const third=await f.expect('/phase2/company-approval-requests',create(f),f.sessions.merchant);await f.db.prepare('UPDATE villas SET owner_id=? WHERE id=?').run(f.users.foreign.id,data.villaId);await f.expect('/phase2/company-approval-preview',{requestId:third.request.id},f.sessions.admin,409);
 await f.db.prepare('DELETE FROM sessions WHERE user_id=?').run(f.users.merchant.id);await f.expect('/phase2/company-approval-requests',create(f),f.sessions.merchant,401);
});
test('Absent candidate flag denies workflow even with synthetic preview terms configured',async t=>{
 const f=await fixture({phase2ApprovalPreviewTerms:terms});t.after(f.close);await f.expect('/phase2/company-approval-requests',undefined,f.sessions.merchant,503);
});

test('Corrupted idempotency or active indexes cannot substitute another package request',async t=>{
 const f=await fixture({phase2GameResponses:true});t.after(f.close);const data=create(f),first=await f.expect('/phase2/company-approval-requests',data,f.sessions.merchant),other=await f.expect('/phase2/company-approval-requests',create(f,{packageId:'basic'}),f.sessions.merchant);
 const key='phase2:v1:approval-request-key:'+approvalReviewDigest([f.users.merchant.id,data.requestKey]);const prior=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)).value);
 await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...prior,id:other.request.id}),key);await f.expect('/phase2/company-approval-requests',data,f.sessions.merchant,409);
 const active=(await f.db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'phase2:v1:approval-request-active:%'").all()).find(r=>JSON.parse(r.value).id===first.request.id);assert(active);
 await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({id:other.request.id}),active.key);await f.expect('/phase2/company-approval-requests',{...data,requestKey:randomUUID()},f.sessions.merchant,409);
});
