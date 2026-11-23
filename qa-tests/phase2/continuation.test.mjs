import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,approvedTestBilling} from './fixture.mjs';
import {paymentFixture} from './omise-fixture.mjs';
const day=86400000;
async function queued(t){
 const f=await fixture();t.after(f.close);let sent=0;
 Object.assign(f.config,{phase2ReminderDeliveryAcceptanceReference:"SYNTHETIC_LOCAL_ONLY",phase2Scheduler:{enabled:true,approvalReference:"SYNTHETIC_LOCAL_ONLY"},phase2EmailEnabled:true,phase2NoticeTransport:{sendMail:async()=>sent++},smtpFrom:'qa@synthetic.invalid',phase2EmailRecipientAllowlist:[f.users.merchant.email]});
 await f.setPolicy({...approvedTestBilling,noticeDays:[7],noticeChannels:['EMAIL']});await f.settle((await f.buy(f.villas[0],'basic')).order);f.advance(23*day);await f.expect('/phase2/notices',{},f.sessions.admin);
 return {...f,sent:()=>sent};
}
for(const change of [{noticeChannels:['IN_APP']},{remindersEnabled:false}])test('Email queue rechecks current channel/schedule approval before delivery '+JSON.stringify(change),async t=>{
 const f=await queued(t);await f.setPolicy(change);const r=await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin);assert.equal(r.cancelled,1);assert.equal(f.sent(),0);
});
for(const mutation of ['recipient','suspension','ownership'])test('Email stale '+mutation+' cancels queue without leaking delivery',async t=>{
 const f=await queued(t);
 if(mutation==='recipient')await f.db.prepare('UPDATE users SET email=? WHERE id=?').run('changed@synthetic.invalid',f.users.merchant.id);
 if(mutation==='suspension')await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('account_status:'+f.users.merchant.id,JSON.stringify({status:'suspended'}));
 if(mutation==='ownership')await f.db.prepare('UPDATE villas SET owner_id=? WHERE id=?').run(f.users.foreign.id,f.villas[0].id);
 assert.equal((await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)).cancelled,1);assert.equal(f.sent(),0);
});
test('P2-05 home slots/rotation/channel/publication policies remain gated and only synthetic configured rights permit output',async t=>{
 const f=await fixture();t.after(f.close);const v=f.villas[0],data={villaId:v.id,placement:'home',source:'TEAM',startsAt:new Date(f.now()-1000).toISOString(),endsAt:new Date(f.now()+day).toISOString(),approved:true};
 await f.expect('/phase2/promotions',data,f.sessions.admin);const path='/phase2/public?placement=home&seed=fixed';
 assert.deepEqual((await f.expect(path)).promotions,[]);await f.setPolicy({publicPromotions:true,homeSlots:1});assert.deepEqual((await f.expect(path)).promotions,[]);
 await f.setPolicy({homeRotation:'STABLE_SESSION'});assert.equal((await f.expect(path)).promotions.length,1);assert.deepEqual(await f.expect(path),await f.expect(path));
 await f.setPolicy({publicPromotions:false});assert.deepEqual((await f.expect(path)).promotions,[]);
 await f.setPolicy({...approvedTestBilling,premiumChannels:[]});await f.settle((await f.buy(f.villas[3],'premium')).order);
 const social={villaId:f.villas[3].id,source:'PACKAGE',kind:'video',channel:'instagram',month:new Date(f.now()).toISOString().slice(0,7),status:'scheduled'};
 await f.expect('/phase2/social',social,f.sessions.admin,409);await f.setPolicy({premiumChannels:['facebook']});await f.expect('/phase2/social',social,f.sessions.admin,409);
});
test('P2-06 published review, reply and public media disappear on Villa suspension; moderation never depends on positive rating',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({reviewsEnabled:true,publicReviews:true});const v=f.villas[0];
 const r=(await f.expect('/phase2/reviews',{villaId:v.id,content:'Synthetic negative review',rating:1},f.sessions.reviewer)).review;
 await f.expect('/phase2/moderate',{id:r.id,status:'published',reason:'Synthetic content review'},f.sessions.admin);
 await f.expect('/phase2/reply',{id:r.id,content:'Own reply'},f.sessions.foreign,404);await f.expect('/phase2/reply',{id:r.id,content:'Own reply'},f.sessions.merchant);
 const path='/phase2/public?villaId='+v.id;assert.equal((await f.expect(path)).reviews[0].reply.content,'Own reply');
 await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('villa_qr:'+v.id,'SUSPENDED');const hidden=await f.expect(path);assert.deepEqual(hidden.reviews,[]);assert.deepEqual(hidden.media,[]);assert.equal(hidden.qr,null);
 await f.db.prepare('DELETE FROM system_settings WHERE key=?').run('villa_qr:'+v.id);
 await f.expect('/phase2/moderate',{id:r.id,status:'rejected',reasonCode:'privacy',reason:'Synthetic privacy issue'},f.sessions.admin);assert.deepEqual((await f.expect(path)).reviews,[]);await f.expect('/phase2/reply',{id:r.id,content:'Cannot reply hidden'},f.sessions.merchant,404);
});
test('P2-07 simultaneous Merchant checkout requests reserve at most one provider charge',async t=>{
 const f=await paymentFixture();t.after(f.close);const r=await Promise.all([f.checkout(),f.checkout()]);assert(r.every(x=>[200,409].includes(x.status)));assert.equal(f.state.creates,1);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,0);
});
test('P2-07 settled transaction cannot be reused by a second order; reconciliation preserves first grant and snapshots',async t=>{
 const f=await paymentFixture();t.after(f.close);await f.checkout();await f.expect('/webhooks/omise',f.event('successful'));const first=[...f.state.charges.values()][0];
 const order=(await f.buy(f.villas[0],'basic')).order;await f.expect('/phase2/payment',{action:'checkout',orderId:order.id,source:'src_test_second'},f.sessions.merchant);
 const second=[...f.state.charges.values()][1];Object.assign(second,{status:'successful',paid:true,transaction:first.transaction});
 await f.expect('/phase2/payment',{action:'status',orderId:order.id},f.sessions.merchant,409);const detail=await f.expect('/phase2/orders?orderId='+order.id,undefined,f.sessions.merchant);assert.equal(detail.grant,null);assert.equal(detail.order.status,'pending');assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,1);
});

test('Email failure retries stop at eight attempts and sending leases prevent concurrent duplicate dispatch',async t=>{
 const f=await queued(t);let calls=0;f.config.phase2NoticeTransport={sendMail:async()=>{calls++;throw Error('SENSITIVE_SMTP_DETAIL');}};
 for(let i=0;i<8;i++){assert.equal((await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)).failed,1);f.advance(3600001);}
 assert.equal((await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)).failed,0);assert.equal(calls,8);
 const rows=await f.db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:notice-email:%'").all();assert(!JSON.stringify(rows).includes('SENSITIVE_SMTP_DETAIL'));
});
test('Omise charge retrieval must match the requested event charge ID, including lost-response recovery',async t=>{
 const f=await paymentFixture();t.after(f.close);f.state.unknownAfterCreate=true;await f.checkout();const event=f.event('successful');const charge=[...f.state.charges.values()][0];charge.id='chrg_test_wrongresponse';
 await f.expect('/webhooks/omise',event,undefined,502);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,0);
});
test('Omise webhook settling during lost create response keeps its authoritative binding and one grant',async t=>{
 const f=await paymentFixture();t.after(f.close);f.state.onCreate=async()=>{await f.expect('/webhooks/omise',f.event('successful'));};f.state.unknownAfterCreate=true;
 assert.equal((await f.checkout()).status,503);const row=await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:omise:'+f.order.id);const attempt=JSON.parse(row.value);assert(attempt.chargeId);assert.equal(attempt.status,'succeeded');
 const detail=await f.expect('/phase2/orders?orderId='+f.order.id,undefined,f.sessions.merchant);assert.equal(detail.order.status,'succeeded');assert(detail.grant);assert.equal(f.state.creates,1);
});
test('P2-05 configured home slot cap is stable; owner suspension hides every placement and team selection consumes no Social quota',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({publicPromotions:true,homeSlots:2,homeRotation:'STABLE_SESSION'});
 for(const v of f.villas)await f.expect('/phase2/promotions',{villaId:v.id,placement:'home',source:'TEAM',startsAt:new Date(f.now()-1000).toISOString(),endsAt:new Date(f.now()+day).toISOString(),approved:true},f.sessions.admin);
 const path='/phase2/public?placement=home&seed=synthetic-stable';const first=await f.expect(path);assert.equal(first.promotions.length,2);assert.deepEqual(await f.expect(path),first);assert(first.promotions.every(p=>f.villas.some(v=>v.id===p.villaId&&p.href.includes(encodeURIComponent(v.qr)))));
 assert.deepEqual((await f.expect('/phase2/social',undefined,f.sessions.admin)).jobs,[]);
 await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('account_status:'+f.users.merchant.id,JSON.stringify({status:'suspended'}));assert.deepEqual((await f.expect(path)).promotions,[]);
});
test('P2-07 ownership change before capture blocks grant; CSRF denies reconciliation requests',async t=>{
 const f=await paymentFixture();t.after(f.close);const forged=await f.request('/phase2/payment',{action:'status',orderId:f.order.id},f.sessions.merchant,{'X-CSRF-Token':'invalid'});assert.equal(forged.status,403);
 await f.checkout();await f.db.prepare('UPDATE villas SET owner_id=? WHERE id=?').run(f.users.foreign.id,f.order.villaId);await f.expect('/webhooks/omise',f.event('successful'),undefined,409);
 assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.admin)).grants.length,0);const d=await f.expect('/phase2/orders?orderId='+f.order.id,undefined,f.sessions.merchant);assert.equal(d.order.status,'pending');assert.equal(d.grant,null);
});
