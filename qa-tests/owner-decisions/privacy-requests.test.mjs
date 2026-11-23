import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {merchantFixture} from '../closure/helpers/merchant-test-fixture.mjs';
test('Privacy intake is authenticated, own-account, idempotent and never executes deletion',async t=>{
 const f=await merchantFixture();t.after(()=>f.close());const user=await f.login(f.other),merchant=await f.login(f.legacy),admin=await f.login(f.admin)
 const before=await f.db.prepare('SELECT id,email,role FROM users ORDER BY id').all()
 await f.expect('/account/privacy-requests',undefined,undefined,401)
 await f.expect('/account/privacy-requests',{kind:'deletion',requestKey:randomUUID(),currentPassword:'wrong'},user,403)
 const body={kind:'deletion',requestKey:randomUUID(),currentPassword:'LocalPassword123',userId:f.legacy.id,consent:true,retentionDays:0}
 const result=await f.expect('/account/privacy-requests',body,user)
 assert.equal(result.body.request.userId,f.other.id);assert.equal(result.body.request.status,'pending_review');assert.equal(result.body.request.kind,'deletion')
 const again=await f.expect('/account/privacy-requests',body,user);assert.equal(again.body.request.id,result.body.request.id)
 assert.equal((await f.expect('/account/privacy-requests',undefined,merchant)).body.requests.length,0)
 const own=await f.expect('/account/privacy-requests',undefined,user);assert.equal(own.body.requests.length,1)
 assert(!JSON.stringify(own.body).includes('LocalPassword'));assert(!JSON.stringify(own.body).includes('retentionDays'));assert(!JSON.stringify(own.body).includes('consent'))
 await f.expect('/admin/privacy-requests',undefined,user,403)
 assert.equal((await f.expect('/admin/privacy-requests',undefined,admin)).body.requests.length,1)
 assert.deepEqual(await f.db.prepare('SELECT id,email,role FROM users ORDER BY id').all(),before)
 await f.expect('/account/privacy-requests',{...body,kind:'access'},user,409)
})
test('Privacy notice version is content-derived and never asserts legal approval',async t=>{
 const f=await merchantFixture();t.after(()=>f.close())
 const a=(await f.expect('/public/privacy-notice')).body,b=(await f.expect('/public/privacy-notice')).body
 assert.match(a.version,/^[a-f0-9]{64}$/);assert.equal(a.version,b.version);assert.equal(a.legalApproval,'NOT_ASSERTED')
 const {publishedCms}=await import('../../server/cms.mjs'),published=await publishedCms(f.db)
 const changed={...published,revision:published.revision+1,content:{...published.content,pages:published.content.pages.map(p=>p.slug==='privacy'?{...p,body:p.body+' Local revision'}:p)}}
 await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('cms_published',JSON.stringify(changed))
 const c=(await f.expect('/public/privacy-notice')).body;assert.notEqual(c.version,a.version);assert.equal(c.legalApproval,'NOT_ASSERTED')
})
test('Admin privacy workflow enforces RBAC, stale revision, review-before-close and retains all business data',async t=>{
 const f=await merchantFixture();t.after(()=>f.close());const user=await f.login(f.other),admin=await f.login(f.admin)
 const before=await f.db.prepare('SELECT id,email,role FROM users ORDER BY id').all()
 const created=(await f.expect('/account/privacy-requests',{kind:'deletion',requestKey:randomUUID(),currentPassword:'LocalPassword123'},user)).body.request
 assert(created.dueAt);assert.equal(created.revision,0)
 const body={id:created.id,status:'in_progress',revision:0,reason:'Identity and retention review started'}
 await f.expect('/admin/privacy-requests',body,user,403)
 await f.expect('/admin/privacy-requests',{...body,status:'completed'},admin,409)
 await f.expect('/admin/privacy-requests',{...body,reason:''},admin,400)
 const progress=(await f.expect('/admin/privacy-requests',body,admin)).body.request;assert.equal(progress.status,'in_progress');assert.equal(progress.history.length,1)
 await f.expect('/admin/privacy-requests',body,admin,409)
 const closed=(await f.expect('/admin/privacy-requests',{...body,status:'completed',revision:1,reason:'Privacy review recorded; no automatic erasure'},admin)).body.request
 assert.equal(closed.status,'completed');assert.equal(closed.history.length,2);const trail=await f.db.prepare('SELECT action FROM audits WHERE target_id=? ORDER BY action').all(created.id);assert.deepEqual(trail.map(row=>row.action),['privacy.request_completed','privacy.request_created','privacy.request_in_progress'])
 await f.expect('/admin/privacy-requests',{...body,revision:2,status:'rejected'},admin,409)
 assert.equal((await f.expect('/account/privacy-requests',undefined,user)).body.requests[0].status,'completed')
 assert.deepEqual(await f.db.prepare('SELECT id,email,role FROM users ORDER BY id').all(),before)
})
test('OTP/OAuth-capable accounts can submit intake using their valid session without a local password; intake never erases records',async t=>{
 const f=await merchantFixture();t.after(f.close);const user=await f.login(f.other);
 const result=(await f.expect('/account/privacy-requests',{kind:'access',requestKey:randomUUID()},user)).body;
 assert.equal(result.request.userId,f.other.id);assert.equal(result.request.status,'pending_review');
 assert(await f.db.prepare('SELECT id FROM users WHERE id=?').get(f.other.id));
 await f.expect('/account/privacy-requests',{kind:'deletion',requestKey:randomUUID()},undefined,401);
});
test('legacy privacy requests expose an operational deadline without writing or deleting the retained record',async t=>{
 const f=await merchantFixture();t.after(f.close);const user=await f.login(f.other),admin=await f.login(f.admin),key='privacy_request:'+f.other.id+':'+randomUUID();
 const value=JSON.stringify({id:randomUUID(),userId:f.other.id,kind:'access',status:'pending_review',requestedAt:'2026-11-01T12:00:00.000Z'});await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run(key,value);
 for(const [path,actor]of [['/account/privacy-requests',user],['/admin/privacy-requests',admin]]){const row=(await f.expect(path,undefined,actor)).body.requests[0];assert.equal(row.dueAt,'2026-12-01T12:00:00.000Z')}
 assert.equal((await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)).value,value);
});
