import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,approvedTestBilling} from './fixture.mjs';
import {phase2Defaults,validatePhase2Policy} from '../../server/phase2-policy.mjs';
const day=86400000;
const edit=v=>({name:v.name,nameEn:'SYNTHETIC Villa',province:v.province,merchant:v.merchant,phone:'0812345678',bankName:'',accountName:'',accountNumber:'',photoUrl:v.photo_url,guestCapacity:12});
const rights=async(f,v)=>(await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).packageRights.find(r=>r.villaId===v.id).phase2.access;
test('Final expiry: account-wide exact boundary denies property mutations, keeps original QR/latest approved snapshot and leaves Admin verification/renewal operational',async t=>{
 const f=await fixture();t.after(f.close);const v=f.villas[0],mediaId=v.photo_url.split('/').at(-1);const before=await f.db.prepare('SELECT * FROM villas WHERE id=?').get(v.id);const snapshot=await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+v.id);
 await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin);assert.equal((await rights(f,v)).remainingDays,90);f.advance(90*day-1);assert.equal((await rights(f,v)).remainingDays,1);assert.equal((await rights(f,v)).canEdit,true);f.advance(1);
 for(const own of f.villas){const r=await rights(f,own);assert.equal(r.state,'EXPIRED');assert.equal(r.remainingDays,0);assert.equal(r.canEdit,false);assert.equal(Date.parse(r.expiresAt),f.now());}
 for(const [path,data]of [
 ['/merchant/villas/'+v.id,edit(v)],['/villas/'+v.id+'/resubmit',{}],
 ['/merchant/property-media',{villaId:v.id,action:'reorder',mediaIds:[]}],['/merchant/property-media',{villaId:v.id,action:'remove',mediaId}],['/merchant/property-media',{villaId:v.id,youtubeUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}],
 ['/merchant/ownership-documents',{villaId:v.id,revision:1,action:'remove',documentId:v.document_id}],['/phase2/media',{villaId:v.id,mediaId,action:'capture',takenAt:null}]
 ])await f.expect(path,data,f.sessions.merchant,403);
 assert.deepEqual(await f.db.prepare('SELECT * FROM villas WHERE id=?').get(v.id),before);assert.deepEqual(await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+v.id),snapshot);
 // Make legacy expiry past too, proving QR continuity does not borrow live Phase 1 rights.
 await f.db.prepare('UPDATE villas SET expires=? WHERE id=?').run(new Date(Date.now()-day).toISOString(),v.id);
 const qr=await f.expect('/public/qr/'+v.qr);assert.equal(qr.valid,true);assert.equal((await f.expect('/admin/qr-verification/'+v.qr,undefined,f.sessions.admin)).valid,false,'Admin verification must not be renewed by public continuity');assert.equal(qr.qr,v.qr);assert.equal(qr.name,JSON.parse(snapshot.value).villa.name);assert.equal(qr.phone,undefined);assert.equal(qr.accountNumber,undefined);assert((await f.expect('/public/villas')).villas.some(x=>x.id===v.id));
 const photo=await fetch(f.base+v.photo_url);assert.equal(photo.status,200);assert.equal((await fetch(f.base+'/api/public/property-media?qr='+v.qr)).status,200);
 await f.expect('/phase2/media',{villaId:v.id,mediaId,action:'verify',confirmReviewed:true,reason:'Synthetic independent verification'},f.sessions.admin);
 for(const [k,value]of [['account_status:'+v.owner_id,JSON.stringify({status:'suspended'})],['villa_qr:'+v.id,'SUSPENDED']]){await f.db.prepare('INSERT INTO system_settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,value);{const denied=await f.request('/public/qr/'+v.qr);assert([200,404].includes(denied.status));if(denied.status===200)assert.equal(denied.body.valid,false);}await f.db.prepare('DELETE FROM system_settings WHERE key=?').run(k);}
 await f.db.prepare("UPDATE villas SET status='pending' WHERE id=?").run(v.id);await f.expect('/public/qr/'+v.qr,undefined,undefined,404);await f.db.prepare("UPDATE villas SET status='approved' WHERE id=?").run(v.id);
 await f.setPolicy(approvedTestBilling);const o=(await f.buy(v,'premium')).order;assert.deepEqual(o.switchingPolicy,{version:1,effective:'CONFIRMED_SUCCESS_IMMEDIATE',refund:'NONE',unusedDaysCarryover:0,balanceCarryoverSatang:0,proration:'NONE',approvalReference:'BUSINESS_OWNER_FINAL_DECISIONS_20261117'});await f.settle(o);assert.equal((await rights(f,v)).remainingDays,30);assert.equal((await rights(f,v)).canEdit,true);assert.equal((await rights(f,f.villas[1])).canEdit,false);assert.equal((await f.db.prepare('SELECT qr FROM villas WHERE id=?').get(v.id)).qr,v.qr);
 await f.expect('/phase2/media',{villaId:v.id,mediaId,action:'capture',takenAt:null},f.sessions.merchant);
});
test('Seven-day schedule: durable single account reminder, forbidden offsets, renewal cancels stale notice and SMTP/scheduler remain closed',async t=>{
 for(const days of [[3],[0],[-7],[7,3],[7,7]])assert.throws(()=>validatePhase2Policy({...phase2Defaults,noticeDays:days,approvalReference:'SYNTHETIC_VECTOR'}));
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,noticeDays:[7],noticeChannels:['IN_APP','EMAIL']});const trial=(await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin)).trial;
 let list=await f.db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:notice:%'").all();assert.equal(list.length,1);const scheduled=JSON.parse(list[0].value);assert.equal(Date.parse(scheduled.scheduledFor),Date.parse(trial.endsAt)-7*day);assert.equal(scheduled.scope,'MERCHANT_ACCOUNT');assert.deepEqual((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).notices,[]);
 f.advance(83*day);const concurrent=await Promise.all([f.expect('/phase2/notices',{},f.sessions.admin),f.expect('/phase2/notices',{},f.sessions.admin)]);assert.equal(concurrent.reduce((n,r)=>n+r.created.length,0),1);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).notices.length,1);await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin,503);
 for(const delta of [4*day,3*day,day]){f.advance(delta);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);}
 list=await f.db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:notice:%'").all();assert.equal(list.length,1);assert.equal(JSON.parse(list[0].value).offsetDays,7);
 const order=(await f.buy(f.villas[0],'basic')).order;await f.settle(order);assert.equal((await rights(f,f.villas[0])).remainingDays,30);const queue=(await f.db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:notice-email:%'").all()).map(r=>JSON.parse(r.value));assert(queue.some(q=>q.notice.grantId===trial.id),'Other owned Villas retain the one shared expired trial history');assert.equal(queue.filter(q=>q.notice.grantId!==trial.id).length,1);
});

test('Historical seven-day notice key is retained without a second notice, silent backfill or legacy undated email delivery',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,noticeDays:[7],noticeChannels:['IN_APP','EMAIL']});const trial=(await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin)).trial;
 const row=await f.db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'phase2:v1:notice:%'").get();const old=JSON.parse(row.value);delete old.scheduledFor;delete old.createdAt;old.status='IN_APP_AVAILABLE';await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(old),row.key);
 const mail=await f.db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'phase2:v1:notice-email:%'").get();const job=JSON.parse(mail.value);job.notice=old;job.nextAttempt=0;await f.db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(job),mail.key);
 f.advance(83*day);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);assert.equal((await f.db.prepare("SELECT count(*)::int n FROM system_settings WHERE key LIKE 'phase2:v1:notice:%'").get()).n,1);
 let sent=0;Object.assign(f.config,{phase2ReminderDeliveryAcceptanceReference:'SYNTHETIC_LOCAL_ONLY',phase2Scheduler:{enabled:true,approvalReference:'SYNTHETIC_LOCAL_ONLY'},phase2EmailEnabled:true,phase2NoticeTransport:{sendMail:async()=>sent++},smtpFrom:'qa@synthetic.invalid',phase2EmailRecipientAllowlist:[f.users.merchant.email]});assert.equal((await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)).cancelled,1);assert.equal(sent,0);assert.equal(JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get(row.key)).value).grantId,trial.id);
});
