import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {phase2Runtime} from '../../server/phase2-policy.mjs';
import {paymentFixture} from './omise-fixture.mjs';
test('P2-07 Omise HTTP adapter: server retrieval, pending, delayed success, duplicate/concurrent webhook and QR preservation',async t=>{
 const f=await paymentFixture();t.after(f.close);const before=await f.db.prepare('SELECT * FROM villas WHERE id=?').get(f.order.villaId);
 const r=await f.checkout();assert.equal(r.status,200);assert.equal(r.body.order.status,'pending');assert.equal(f.state.creates,1);
 await f.expect('/phase2/sandbox',{orderId:f.order.id,status:'succeeded'},f.sessions.admin,403);
 await f.expect('/phase2/payment',{action:'status',orderId:f.order.id},f.sessions.foreign,404);
 assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,0);f.advance(2*86400000);
 const event=f.event('successful');const results=await Promise.all([f.request('/webhooks/omise',event),f.request('/webhooks/omise',event)]);assert(results.every(r=>r.status===200));
 const detail=await f.expect('/phase2/orders?orderId='+f.order.id,undefined,f.sessions.merchant);assert.equal(detail.order.status,'succeeded');assert.equal(detail.grant.startsAt,new Date(f.now()).toISOString());
 assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,1);assert.deepEqual(await f.db.prepare('SELECT * FROM villas WHERE id=?').get(f.order.villaId),before);
 assert.equal((await f.request('/webhooks/omise',f.event('successful'))).status,200);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,1);
 const decisions=(await f.expect('/admin/audit-log',undefined,f.sessions.admin)).decisions.filter(d=>d.targetId===f.order.id);
 assert.equal(decisions.length,1);assert.equal(decisions[0].actorId,null);assert.equal(decisions[0].actorType,'PROVIDER');assert.equal(decisions[0].effectiveRole,'VERIFIED_PROVIDER');assert.equal(decisions[0].effectivePermission,'provider.payment.verify');assert.equal(decisions[0].previousStatus,'pending');assert.equal(decisions[0].newStatus,'succeeded');assert.equal(decisions[0].result,'APPROVED');assert.equal(decisions[0].requestId,decisions[0].providerEvent.eventId);
});
for(const [providerStatus,result]of [['expired','cancelled'],['failed','failed']])test('P2-07 Omise '+providerStatus+' does not grant rights; terminal state and duplicate protected',async t=>{
 const f=await paymentFixture();t.after(f.close);assert.equal((await f.checkout()).status,200);const event=f.event(providerStatus);assert.equal((await f.request('/webhooks/omise',event)).status,200);assert.equal((await f.request('/webhooks/omise',event)).status,200);
 const d=await f.expect('/phase2/orders?orderId='+f.order.id,undefined,f.sessions.merchant);assert.equal(d.order.status,result);assert.equal(d.grant,null);assert.equal((await f.request('/webhooks/omise',f.event('successful'))).status,409);
});
test('P2-07 Omise rejects forged/live/uncaptured/incorrect amount or metadata and unknown events',async t=>{
 const f=await paymentFixture();t.after(f.close);await f.checkout();const charge=[...f.state.charges.values()][0],event=f.event('successful'),original=structuredClone(charge);
 for(const changes of [{amount:1},{currency:'USD'},{livemode:true},{paid:false},{transaction:'trxn_live_invalid'},{metadata:{invoiceId:randomUUID()}}]){
  Object.assign(charge,original,changes);const response=await f.request('/webhooks/omise',event);assert.equal(response.status,changes.livemode?502:409);
 }
 Object.assign(charge,original);await f.expect('/webhooks/omise',{id:'evnt_live_invalid'},undefined,400);await f.expect('/webhooks/omise',{id:'evnt_test_missing'},undefined,502);
 assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,0);
});
test('P2-07 Omise unknown creation persists reconciliation marker and cannot charge twice',async t=>{
 const f=await paymentFixture();t.after(f.close);f.state.unknown=true;assert.equal((await f.checkout()).status,503);assert.equal((await f.checkout()).status,409);assert.equal(f.state.creates,1);
 const row=await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:omise:'+f.order.id);assert.equal(JSON.parse(row.value).status,'RECONCILIATION_REQUIRED');
});
test('P2-07 live credentials/providers rejected; Omise Sandbox selected by default',()=>{
 assert.equal(phase2Runtime({}).phase2PaymentProvider,'OMISE_TEST');assert.throws(()=>phase2Runtime({PHASE2_OMISE_TEST_SECRET_KEY:'skey_live_invalid'}));assert.throws(()=>phase2Runtime({PHASE2_PAYMENT_PROVIDER:'LIVE'}));
});

test('P2-07 lost create response recovers only from server-retrieved webhook, without a second charge',async t=>{
 const f=await paymentFixture();t.after(f.close);f.state.unknownAfterCreate=true;assert.equal((await f.checkout()).status,503);assert.equal(f.state.creates,1);
 assert.equal((await f.checkout()).status,409);const event=f.event('successful');assert.equal((await f.request('/webhooks/omise',event)).status,200);assert.equal((await f.request('/webhooks/omise',event)).status,200);
 const d=await f.expect('/phase2/orders?orderId='+f.order.id,undefined,f.sessions.merchant);assert.equal(d.order.status,'succeeded');assert(d.grant);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,1);assert.equal(f.state.creates,1);
});

test('P2-07 Merchant cancellation before charge creates no provider charge or rights; started attempts cannot be locally cancelled',async t=>{
 const f=await paymentFixture();t.after(f.close);await f.expect('/phase2/payment',{action:'cancel',orderId:f.order.id},f.sessions.foreign,404);
 const cancelled=await f.expect('/phase2/payment',{action:'cancel',orderId:f.order.id},f.sessions.merchant);assert.equal(cancelled.order.status,'cancelled');assert.equal(cancelled.providerCancellation,false);assert.equal(f.state.creates,0);assert.equal((await f.checkout()).status,409);
 const order=(await f.buy(f.villas[0],'basic')).order;await f.expect('/phase2/payment',{action:'checkout',orderId:order.id,source:'src_test_synthetic'},f.sessions.merchant);await f.expect('/phase2/payment',{action:'cancel',orderId:order.id},f.sessions.merchant,409);assert.equal(f.state.creates,1);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,0);
});
