import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,approvedTestBilling} from './fixture.mjs';
import {paymentFixture} from './omise-fixture.mjs';
import {inclusiveSatang,monthlyQuote} from '../../server/phase2-finance.mjs';
import {phase2Defaults,phase2Prices,validatePhase2Policy,phase2Runtime} from '../../server/phase2-policy.mjs';
import {canApprovePhase2,approvedOwnerMappings} from '../../server/phase2-approvers.mjs';
const day=86400000;
async function cloneVilla(f,{owner=f.users.merchant.id,status='pending'}={}){
 const v={...f.villas[0],id:randomUUID(),owner_id:owner,qr:'VC-'+randomUUID(),status,created:new Date(f.now()).toISOString()},keys=Object.keys(v);assert(keys.every(k=>/^[a-z_]+$/.test(k)));
 await f.db.prepare('INSERT INTO villas('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>v[k]));return v;
}
async function rights(f,v){const w=await f.expect('/phase2/workspace',undefined,f.sessions.admin);return w.packageRights.find(r=>r.villaId===v.id).phase2;}

test('Approved defaults are monthly inclusive/account trial; Finance inputs remain unset; seven-day in-app reminder is approved',()=>{
 assert.equal(phase2Defaults.billingCycle,'MONTHLY');assert.equal(phase2Defaults.vatMode,'INCLUSIVE');assert.equal(phase2Defaults.trialScope,'MERCHANT_ACCOUNT');
 for(const k of ['vatBasisPoints','vatRoundingPolicy','monthlyBoundary','billingDays','financeApprovalReference'])assert.equal(phase2Defaults[k],null);
 assert.equal(phase2Defaults.remindersEnabled,true);assert.deepEqual(phase2Defaults.noticeDays,[7]);assert.deepEqual(phase2Defaults.noticeChannels,['IN_APP']);assert.equal(phase2Defaults.noticeTimezone,null);
 assert.throws(()=>monthlyQuote('basic',phase2Prices,phase2Defaults),e=>e.status===409);
 for(const change of [{billingCycle:'ANNUAL'},{vatMode:'EXCLUSIVE'},{vatMode:'NO_VAT'},{trialScope:'VILLA'},{billingDays:365},{noticeDays:[3,0,-7]}])assert.throws(()=>validatePhase2Policy({...phase2Defaults,...change,approvalReference:'SYNTHETIC_VALIDATION_VECTOR_ONLY'}),e=>e.status===400);
});
test('Inclusive VAT uses exact BigInt satang arithmetic and explicit rounding; rate and rounding never default',()=>{
 for(const p of Object.values(phase2Prices))for(const rate of [0,700,10000])for(const rounding of ['HALF_UP','HALF_EVEN','DOWN']){
  const r=inclusiveSatang(p,rate,rounding);assert.equal(r.totalSatang,p);assert(Number.isSafeInteger(r.vatSatang));assert.equal(r.netSatang+r.vatSatang,p);
 }
 for(const [total,vat] of [[99000,6477],[199000,13019],[299000,19561],[499000,32645]])assert.deepEqual(inclusiveSatang(total,700,'HALF_UP'),{totalSatang:total,vatSatang:vat,netSatang:total-vat}); // Explicit synthetic 7% vector, not an approved tax rate.
 assert.equal(inclusiveSatang(1,10000,'HALF_UP').vatSatang,1);assert.equal(inclusiveSatang(1,10000,'HALF_EVEN').vatSatang,0);assert.equal(inclusiveSatang(3,10000,'HALF_EVEN').vatSatang,2);assert.equal(inclusiveSatang(3,10000,'DOWN').vatSatang,1);
 assert.equal(inclusiveSatang(Number.MAX_SAFE_INTEGER,700,'HALF_UP').netSatang+inclusiveSatang(Number.MAX_SAFE_INTEGER,700,'HALF_UP').vatSatang,Number.MAX_SAFE_INTEGER);
 assert.throws(()=>inclusiveSatang(99000,undefined,'HALF_UP'));assert.throws(()=>inclusiveSatang(99000,700,null));
 for(const change of [{vatBasisPoints:null},{vatRoundingPolicy:null},{monthlyBoundary:null},{financeApprovalReference:null},{invoiceRequirementsConfirmed:false}])assert.throws(()=>monthlyQuote('basic',phase2Prices,{...phase2Defaults,...approvedTestBilling,...change}),e=>e.status===409);
});
test('One account trial across concurrent different Villas: same grant, clock, audit; all legacy data untouched',async t=>{
 const f=await fixture();t.after(f.close);const before={villas:await f.db.prepare('SELECT * FROM villas ORDER BY id').all(),subscriptions:await f.db.prepare('SELECT * FROM subscriptions ORDER BY owner_id').all(),catalog:await f.db.prepare('SELECT * FROM package_catalog ORDER BY id').all()};
 const responses=await Promise.all(f.villas.map(v=>f.request('/phase2/trial',{villaId:v.id,merchantId:f.users.merchant.id},f.sessions.admin)));
 assert(responses.every(r=>r.status===200));assert.equal(responses.filter(r=>r.body.created).length,1);assert.equal(new Set(responses.map(r=>r.body.trial.id)).size,1);
 const g=responses[0].body.trial;assert.equal(g.userId,f.users.merchant.id);assert.equal(g.scope,'MERCHANT_ACCOUNT');assert.equal(Date.parse(g.startsAt),f.now());assert.equal(Date.parse(g.endsAt)-Date.parse(g.startsAt),90*day);
 for(const v of f.villas)assert.equal((await rights(f,v)).active[0].id,g.id);
 assert.deepEqual(await f.db.prepare('SELECT * FROM villas ORDER BY id').all(),before.villas);assert.deepEqual(await f.db.prepare('SELECT * FROM subscriptions ORDER BY owner_id').all(),before.subscriptions);assert.deepEqual(await f.db.prepare('SELECT * FROM package_catalog ORDER BY id').all(),before.catalog);
 assert.equal((await f.db.prepare("SELECT count(*)::int n FROM audits WHERE action='phase2.account_trial.started'").get()).n,1);
});
test('New Villa on day89 shares the original account trial; ownership transfer cannot borrow or restart it; exact expiry retains QR',async t=>{
 const f=await fixture();t.after(f.close);const trial=(await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin)).trial;f.advance(89*day);const added=await cloneVilla(f);
 const result=await f.expect('/phase2/trial',{villaId:added.id},f.sessions.admin);assert.equal(result.created,false);assert.equal(result.trial.id,trial.id);assert.equal(result.trial.endsAt,trial.endsAt);assert.equal((await rights(f,added)).active[0].id,trial.id);
 const pending=await f.expect('/phase2/public?villaId='+added.id);assert.equal(pending.packageState,'UNAVAILABLE');
 await f.expect('/phase2/trial',{villaId:added.id,merchantId:f.users.foreign.id},f.sessions.admin,409);await f.expect('/phase2/trial',{villaId:added.id},f.sessions.merchant,403);
 await f.db.prepare('UPDATE villas SET owner_id=? WHERE id=?').run(f.users.foreign.id,added.id);assert.deepEqual((await rights(f,added)).active,[]);await f.expect('/phase2/trial',{villaId:added.id},f.sessions.admin,409);
 f.advance(day);for(const v of f.villas){const r=await rights(f,v);assert.deepEqual(r.active,[]);assert.equal(r.expiryRightsPolicy,'PUBLIC_APPROVED_QR_RETAINED_MERCHANT_EDITING_DISABLED_AFTER_EXPIRY_OTHER_FEATURES_PENDING');assert.equal((await f.expect('/phase2/public?villaId='+v.id)).qr,v.qr);assert.equal((await f.db.prepare('SELECT qr FROM villas WHERE id=?').get(v.id)).qr,v.qr);}
});
test('Incomplete/future documents cannot start first account trial; old Phase2 per-Villa trial is not silently converted',async t=>{
 const f=await fixture();t.after(f.close);const v=f.villas[0];await f.db.prepare("UPDATE villas SET reviewed_at=? WHERE id=?").run(new Date(f.now()+day).toISOString(),v.id);await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin,409);
 await f.db.prepare('UPDATE villas SET reviewed_at=? WHERE id=?').run(v.reviewed_at,v.id);
 const old={userId:f.users.merchant.id,villaId:v.id,startsAt:v.created,endsAt:new Date(f.now()+day).toISOString()};await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('phase2:v1:trial:'+v.id,JSON.stringify(old));
 await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin,409);assert.equal(await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:account-trial:'+f.users.merchant.id),undefined);
 assert.deepEqual(JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:trial:'+v.id)).value),old);
});
test('Confirmed payment changes selected package immediately while account trial and all old grants/QR remain intact',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);const v=f.villas[0],trial=(await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin)).trial;
 const first=(await f.buy(v,'premium')).order;assert.equal((await rights(f,v)).selectedPackageId,'starter');await f.settle(first,'pending');assert.equal((await rights(f,v)).selectedPackageId,'starter');
 await f.settle(first,'succeeded');let r=await rights(f,v);assert.equal(r.selectedPackageId,'premium');assert.equal(Date.parse(r.active[0].startsAt),f.now());assert.equal((await rights(f,f.villas[1])).selectedPackageId,'starter');
 const before=await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:grant:'+r.active[0].id);f.advance(day);const next=(await f.buy(v,'basic')).order;await f.settle(next,'failed');assert.equal((await rights(f,v)).selectedPackageId,'premium');
 const replacement=(await f.buy(v,'basic')).order;await f.settle(replacement);r=await rights(f,v);assert.equal(r.selectedPackageId,'basic');assert.equal(Date.parse(r.active[0].startsAt),f.now());
 assert.deepEqual(await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:grant:'+JSON.parse(before.value).id),before);
 assert.deepEqual(JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:account-trial:'+f.users.merchant.id)).value),trial);assert.equal((await f.db.prepare('SELECT qr FROM villas WHERE id=?').get(v.id)).qr,v.qr);
 await f.settle(first,'succeeded');assert.equal((await rights(f,v)).selectedPackageId,'basic','Replay of old success must not re-select old package');
 f.advance(200*day);r=await rights(f,v);assert.equal(r.selectedPackageId,null);assert.deepEqual(r.active,[]);assert.equal((await f.expect('/phase2/public?villaId='+v.id)).qr,v.qr);
});
test('Renewal selection does not add unused prior paid time, alter old grants or apply financial credits',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);const v=f.villas[0];await f.settle((await f.buy(v,'premium')).order);const old=(await rights(f,v)).active[0],before=await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:grant:'+old.id);
 f.advance(day);await f.setPolicy({billingDays:28});await f.settle((await f.buy(v,'pro')).order);const current=(await rights(f,v)).active[0];assert.equal(current.packageId,'pro');assert.equal(Date.parse(current.startsAt),f.now());assert.equal(Date.parse(current.endsAt)-Date.parse(current.startsAt),28*day);assert.equal(current.endsAt,new Date(f.now()+28*day).toISOString());assert.deepEqual(await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:grant:'+old.id),before);
 const records=(await f.expect('/phase2/workspace',undefined,f.sessions.admin)).grants;assert.equal(records.length,2);assert(records.every(g=>g.financialAdjustment==='NONE_APPROVED_NO_REFUND_CARRYOVER_PRORATION'));
 f.advance(28*day);assert(Date.parse(old.endsAt)>f.now(),'Older paid grant still has recorded unused time');assert.equal((await rights(f,v)).selectedPackageId,null,'Expired replacement must not silently reactivate the old package');
});
test('Account reminder dedupe spans Villas; approved seven-day schedule sends nothing externally',async t=>{
 const f=await fixture();t.after(f.close);const trial=(await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin)).trial;f.advance(83*day);
 assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).notices.length,1);
 await f.setPolicy({noticeDays:[7],noticeChannels:['IN_APP']});const created=(await f.expect('/phase2/notices',{},f.sessions.admin)).created;assert.equal(created.length,1);assert.equal(created[0].grantId,trial.id);assert.equal(created[0].scope,'MERCHANT_ACCOUNT');assert.equal(created[0].villaId,undefined);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);
});
test('Prin and Game are independent approver slots; mapping alone is not a grant; pure vectors create no accounts',()=>{
 const p='00000000-0000-0000-0000-000000000001',g='00000000-0000-0000-0000-000000000002';
 const mappings={prin:{accountId:p,grantReference:'PURE_TEST_MAPPING_ONLY'},game:{accountId:g,grantReference:'PURE_TEST_MAPPING_ONLY'}},config={phase2OwnerApproverMappings:mappings,phase2BusinessOwnerIds:[p,g],phase2OwnerApprovalReference:'PURE_TEST_CONTRACT_NOT_REAL_GRANT'};
 assert(approvedOwnerMappings(mappings));assert(canApprovePhase2({id:p,role:'admin'},config));assert(canApprovePhase2({id:g,role:'admin'},config));assert(!canApprovePhase2({id:p,role:'merchant'},config));assert(!canApprovePhase2({id:randomUUID(),role:'admin'},config));assert(!canApprovePhase2({id:p,role:'admin'},{...config,phase2BusinessOwnerIds:[p]}));assert(!canApprovePhase2({id:p,role:'admin'},{...config,phase2OwnerApproverMappings:null}));
 assert(!approvedOwnerMappings({prin:mappings.prin}));assert(!approvedOwnerMappings({prin:mappings.prin,game:mappings.prin}));assert.equal(phase2Runtime({}).phase2OwnerApproverMappings,null);
});
test('Existing incompatible pending order is preserved but cannot create an Omise charge or grant under new Finance rules',async t=>{
 const f=await paymentFixture();t.after(f.close);const old={...f.order,vatMode:'EXCLUSIVE'};await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(old),'phase2:v1:order:'+old.id);await f.expect('/phase2/payment',{action:'checkout',orderId:old.id,source:'src_test_synthetic'},f.sessions.merchant,409);assert.equal(f.state.creates,0);assert.deepEqual(JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:order:'+old.id)).value),old);
});

test('Transferred Villa purchase cannot inherit the former owner legacy trial billing deferral',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);const v=f.villas[0],trial=(await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin)).trial;
 await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('phase2:v1:trial:'+v.id,JSON.stringify({...trial,villaId:v.id,scope:'VILLA'}));
 await f.db.prepare('UPDATE villas SET owner_id=? WHERE id=?').run(f.users.foreign.id,v.id);
 await f.expect('/phase2/orders',{villaId:v.id,packageId:'premium',requestKey:randomUUID()},f.sessions.foreign,409); // Old snapshot cannot authorize the new owner.
 const snapshot=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+v.id)).value);snapshot.villa.owner_id=f.users.foreign.id;snapshot.media=[];await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(snapshot),'villa_approved:'+v.id); // Synthetic newly approved owner snapshot, not a real transfer.
 const order=(await f.expect('/phase2/orders',{villaId:v.id,packageId:'premium',requestKey:randomUUID()},f.sessions.foreign)).order;await f.settle(order);
 const grant=(await f.expect('/phase2/workspace',undefined,f.sessions.foreign)).grants.find(g=>g.orderId===order.id);assert.equal(Date.parse(grant.billingStartsAt),f.now());assert.equal(grant.userId,f.users.foreign.id);assert.equal(Date.parse(trial.endsAt),f.now()+90*day);
 assert.deepEqual(JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:account-trial:'+f.users.merchant.id)).value),trial);
});
