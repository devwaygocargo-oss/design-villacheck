import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {approvalFixture} from './fixture.mjs';
test('Production-equivalent missing current-cover review returns409; explicit media review then approval persists and publishes only approved snapshot',async t=>{
 const f=await approvalFixture();t.after(f.close);let r=await f.approve();assert.equal(r.status,409);assert.match(r.body.error,/ตรวจรูปหน้าปกปัจจุบัน/);assert.equal((await f.villa()).status,'pending');assert.equal((await f.villa()).qr,null);assert.equal((await f.expect('/public/villas')).body.villas.length,0);
 const trialBefore=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_free_trial:'+f.id)).value);assert.equal(trialBefore.startsAt,null);
 await f.cover();r=await f.approve();assert.equal(r.status,200,JSON.stringify(r.body));const v=await f.villa();assert.equal(v.status,'approved');assert.equal(v.reviewed_by,f.admin.id);assert(v.qr);assert.equal(Date.parse(v.expires)-Date.parse(v.reviewed_at),90*86400000);
 const stored=JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+f.id)).value);assert.equal(stored.villa.id,f.id);assert.equal(stored.villa.qr,v.qr);assert.equal((await f.expect('/public/villas')).body.villas[0].id,f.id);
 assert((await f.expect('/state',undefined,f.adminSession)).body.villas.some(v=>v.id===f.id&&v.status==='approved'));assert.equal((await f.db.prepare("SELECT count(*)::int n FROM audits WHERE action='villa.approved' AND target_id=?").get(f.id)).n,1);
});
test('Missing or replaced/unreviewed cover cannot be approved; original guard remains authoritative',async t=>{
 const f=await approvalFixture();t.after(f.close);await f.db.prepare("UPDATE villas SET photo_url='' WHERE id=?").run(f.id);assert.equal((await f.approve()).status,409);
 await f.db.prepare("UPDATE villas SET photo_url='/demo/villas/villa-1.jpg',photo_reviewed_at=?,photo_uploaded_at=? WHERE id=?").run(new Date(Date.now()-120000).toISOString(),new Date().toISOString(),f.id);assert.equal((await f.approve()).status,409);assert.equal((await f.villa()).status,'pending');
});
test('Unaccepted verification documents and pending Merchant KYC still block approval without a grant or snapshot',async t=>{
 const f=await approvalFixture();t.after(f.close);await f.cover();await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run('ownership_documents:'+f.id,JSON.stringify({revision:0,documents:[{id:f.doc,kind:'ownership',status:'pending'}],history:[]}));assert.equal((await f.approve()).status,409);
 await f.expect('/admin/ownership-documents',{villaId:f.id,revision:0,action:'review',documentId:f.doc,status:'accepted',remark:''},f.adminSession);
 await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run('merchant_registration_application:'+f.legacy.id,JSON.stringify({status:'pending'}));assert.equal((await f.approve()).status,409);assert.equal((await f.villa()).status,'pending');assert.equal((await f.villa()).qr,null);
});
test('Guest, Merchant and unrelated User cannot approve or mark the cover reviewed',async t=>{
 const f=await approvalFixture();t.after(f.close);assert.equal((await f.approve(null)).status,401);assert.equal((await f.approve(f.merchantSession)).status,403);assert.equal((await f.approve(f.otherSession)).status,403);await f.expect('/admin/property-media',{villaId:f.id,mediaId:'cover'},f.merchantSession,403);assert.equal((await f.villa()).photo_reviewed_at,null);
});
test('Concurrent/repeated approval creates one approved snapshot and audit; stale review IDs fail closed',async t=>{
 const f=await approvalFixture();t.after(f.close);await f.cover();assert.equal((await f.approve(f.adminSession,{expectedReviewId:randomUUID()})).status,409);
 const rs=await Promise.all([f.approve(),f.approve()]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);const v=await f.villa(),snapshot=(await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+f.id)).value;assert.equal((await f.approve()).status,409);assert.equal((await f.villa()).qr,v.qr);assert.equal((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+f.id)).value,snapshot);assert.equal((await f.db.prepare("SELECT count(*)::int n FROM audits WHERE action='villa.approved' AND target_id=?").get(f.id)).n,1);
});
test('Approval failure rolls back status, trial, QR and snapshot atomically',async t=>{
 const f=await approvalFixture();t.after(f.close);await f.cover();const original=f.db.prepare;f.db.prepare=sql=>{const stmt=original(sql);if(sql.includes('INSERT INTO audits')){const run=stmt.run;stmt.run=(...args)=>{if(args[2]==='villa.approved')throw Error('SYNTHETIC transaction fault');return run(...args)};}return stmt;};assert.equal((await f.approve()).status,500);f.db.prepare=original;const v=await f.villa();assert.equal(v.status,'pending');assert.equal(v.qr,null);assert.equal(v.expires,null);assert.equal(await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+f.id),undefined);assert.equal(JSON.parse((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_free_trial:'+f.id)).value).startsAt,null);
});
test('Publication disabled policy keeps an approved Villa private; approval is not unconditional public publication',async t=>{
 const f=await approvalFixture();t.after(f.close);await f.cover();assert.equal((await f.approve()).status,200);assert.equal((await f.villa()).status,'approved');Object.assign(f.config,{publicPublicationDisabled:true,internalAdminSetup:true});assert.equal((await f.expect('/public/villas')).body.villas.length,0);
});
test('Approving one Villa preserves a different approved Villa, its original QR and approved snapshot',async t=>{
 const f=await approvalFixture();t.after(f.close);const other={...await f.villa(),id:randomUUID(),name:'SYNTHETIC previously approved',status:'approved',qr:'VC-'+randomUUID(),expires:new Date(Date.now()+86400000).toISOString(),photo_reviewed_at:new Date().toISOString()},keys=Object.keys(other);assert(keys.every(k=>/^[a-z_]+$/.test(k)));await f.db.prepare('INSERT INTO villas('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>other[k]));const snapshot=JSON.stringify({villa:other,media:[],recordedAt:new Date().toISOString()});await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run('villa_approved:'+other.id,snapshot);await f.cover();assert.equal((await f.approve()).status,200);assert.deepEqual(await f.db.prepare('SELECT * FROM villas WHERE id=?').get(other.id),other);assert.equal((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+other.id)).value,snapshot);
});
