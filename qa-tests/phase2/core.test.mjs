import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {fixture,approvedTestBilling} from './fixture.mjs';
import {settlePhase2Sandbox} from '../../server/phase2.mjs';
import {requirePhase2,requirePhase2Database} from '../../server/phase2-policy.mjs';
import {bangkokLocalToUtc} from '../../server/phase2-time.mjs';
import {createUser} from '../../server/database.mjs';
import {syntheticPassword} from './fixture.mjs';
const day=86400000;
test('Scheduling inputs use Bangkok wall time; invalid calendar dates rejected',()=>{assert.equal(bangkokLocalToUtc('2026-11-10T10:00'),'2026-11-10T03:00:00.000Z');for(const value of ['2026-02-31T10:00','2026-13-01T10:00','2026-11-10T25:00',''])assert.throws(()=>bangkokLocalToUtc(value));});
test('Phase2 default/production/PHASE1/Staging guards deny even explicitly enabled flags',()=>{
 for(const config of [{},{phase2Enabled:true,appEnvironment:'production'},{phase2Enabled:true,appEnvironment:'staging'},{phase2Enabled:true,appEnvironment:'development',productionReleaseMode:'PHASE1'},{phase2Enabled:true,appEnvironment:'development',productionRuntime:true}])assert.throws(()=>requirePhase2(config),e=>e.status===503);
});
test('Phase2 refuses remote Production/Staging DB bindings independently of environment flags',()=>{for(const host of ['ep-square-resonance-aohwf0z5.c-2.ap-southeast-1.aws.neon.tech','ep-lively-wildflower-azuxgq19.c-3.ap-southeast-1.aws.neon.tech'])assert.throws(()=>requirePhase2Database({dialect:'postgres',connectionIdentity:{host}}),e=>e.status===503);});
test('P2-03 exact prices, explicit Owner authority, existing role preservation, unknown policy fail closed',async t=>{
 const f=await fixture();t.after(f.close);const before=await f.db.prepare('SELECT id,role FROM users ORDER BY id').all();
 const c=await f.expect('/phase2/catalog',undefined,f.sessions.merchant);assert.deepEqual(c.packages.map(p=>p.amountSatang),[99000,199000,299000,499000]);assert(c.packages.every(p=>p.billingDays===null&&p.vatMode==='INCLUSIVE'&&p.billingCycle==='MONTHLY'));
 await f.expect('/phase2/catalog',undefined,undefined,401);await f.expect('/phase2/policy',undefined,f.sessions.reviewer,403);
 await f.expect('/phase2/policy',{policy:{...approvedTestBilling,revision:0,approvalReference:'FORGED'},reason:'cannot grant own authority'},f.sessions.admin,403);
 await f.expect('/phase2/orders',{villaId:f.villas[0].id,packageId:'basic',requestKey:randomUUID()},f.sessions.merchant,409);
 await f.expect('/phase2/orders',{villaId:f.villas[0].id,packageId:'basic',requestKey:randomUUID()},f.sessions.foreign,404);
 await f.setPolicy(approvedTestBilling);assert.deepEqual(await f.db.prepare('SELECT id,role FROM users ORDER BY id').all(),before);
});
test('P2-03 Admin escalation stays pending without authorized Owner; no synthetic Owner or entitlement side effects',async t=>{
 const f=await fixture();t.after(f.close);const e=(await f.expect('/phase2/escalations',{kind:'TRIAL_EXCEPTION',reason:'Synthetic request'},f.sessions.admin)).escalation;
 await f.expect('/phase2/escalations',{id:e.id,revision:1,decision:'approved',reason:'Cannot self approve'},f.sessions.admin,403);
 await f.expect('/phase2/escalations',{id:e.id,revision:1,decision:'approved',reason:'No authorized Owner available'},f.sessions.admin,403);
 await f.expect('/phase2/escalations',{id:e.id,revision:1,decision:'approved',reason:'Stale'},f.sessions.admin,403);
 assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,0);
});
test('P2-04 exactly90days, approval completeness, duplicate activation, Thai-readable timestamp and legacy QR unchanged',async t=>{
 const f=await fixture();t.after(f.close);const v=f.villas[0],before=await f.db.prepare('SELECT * FROM villas WHERE id=?').get(v.id);
 await f.expect('/phase2/trial',{villaId:v.id},f.sessions.merchant,403);await f.setPolicy({trialScope:'MERCHANT_ACCOUNT'});
 await f.db.prepare("UPDATE villas SET status='pending' WHERE id=?").run(v.id);await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin,409);await f.db.prepare("UPDATE villas SET status='approved' WHERE id=?").run(v.id);
 const r=await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin);assert.equal(Date.parse(r.trial.endsAt)-Date.parse(r.trial.startsAt),90*day);assert.equal(r.trial.packageId,'starter');f.advance(day);
 assert.equal((await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin)).created,false);assert.deepEqual(await f.db.prepare('SELECT * FROM villas WHERE id=?').get(v.id),before);
 f.advance(89*day);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants[0].state,'EXPIRED');
});
test('P2-04 configured in-app notices only, dedupe and expiry; none sent externally',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({trialScope:'MERCHANT_ACCOUNT',noticeDays:[7]});await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin);f.advance(83*day);
 let r=await f.expect('/phase2/notices',{},f.sessions.admin);assert.equal(r.created.length,1);assert.equal(r.externalMessagesSent,0);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);
 f.advance(6*day);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);f.advance(day);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.foreign)).notices.length,0);
});
test('P2-07 authoritative Sandbox amount, signature, replay and concurrent grants; no verification/QR mutation',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);const v=f.villas[2],before=await f.db.prepare('SELECT * FROM villas WHERE id=?').get(v.id),o=(await f.buy(v)).order;
 const envelope=f.config.phase2SandboxGateway.create(o,'succeeded');const forged=structuredClone(envelope);forged.event.amount=1;
 await assert.rejects(settlePhase2Sandbox(f.db,f.users.admin,f.config,forged),e=>e.status===400);
 const wrong=f.config.phase2SandboxGateway.create({...o,totalSatang:1},'succeeded');await assert.rejects(settlePhase2Sandbox(f.db,f.users.admin,f.config,wrong),e=>e.status===400);
 const results=await Promise.all([settlePhase2Sandbox(f.db,f.users.admin,f.config,envelope),settlePhase2Sandbox(f.db,f.users.admin,f.config,envelope)]);assert.equal(results.filter(r=>r.duplicate).length,1);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,1);assert.deepEqual(await f.db.prepare('SELECT * FROM villas WHERE id=?').get(v.id),before);
 const reused=f.config.phase2SandboxGateway.create(o,'pending',envelope.event.eventId);await assert.rejects(settlePhase2Sandbox(f.db,f.users.admin,f.config,reused),e=>e.status===409);
});
test('P2-07 pending/cancel/failure/late and duplicate order behavior; Merchant cannot simulate or read foreign orders',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);const request={villaId:f.villas[0].id,packageId:'basic',requestKey:randomUUID()};const first=await f.expect('/phase2/orders',request,f.sessions.merchant);assert.equal((await f.expect('/phase2/orders',request,f.sessions.merchant)).created,false);
 await f.expect('/phase2/orders',{...request,packageId:'starter'},f.sessions.merchant,409);assert.equal((await f.expect('/phase2/orders',undefined,f.sessions.foreign)).orders.length,0);
 await f.expect('/phase2/sandbox',{orderId:first.order.id,status:'succeeded'},f.sessions.merchant,403);await f.settle(first.order,'pending');assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,0);
 await f.settle(first.order,'cancelled');await f.expect('/phase2/sandbox',{orderId:first.order.id,status:'succeeded'},f.sessions.admin,409);
 const failed=(await f.buy(f.villas[1])).order;await f.settle(failed,'failed');await f.expect('/phase2/sandbox',{orderId:failed.id,status:'succeeded'},f.sessions.admin,409);
 const late=(await f.buy(f.villas[2])).order;f.advance(day);await f.settle(late,'succeeded');assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.length,1);
});
test('P2-08 before/after trial purchase and renewal use approved test policy; fixed QR and identity retained',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);const v=f.villas[0],trial=(await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin)).trial,o=(await f.buy(v,'premium')).order;await f.settle(o);let grants=(await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants;const paid=grants.find(g=>g.orderId===o.id);assert.equal(Date.parse(paid.startsAt),f.now());assert.equal(paid.billingStartsAt,trial.endsAt);assert.equal((await f.expect('/phase2/public?villaId='+v.id)).selectedPackageId,'premium');assert.equal((await f.expect('/phase2/public?villaId='+v.id)).packageState,'ACTIVE','Future paid period must not hide currently active trial');assert.equal(Date.parse(paid.endsAt)-Date.parse(paid.billingStartsAt),30*day);
 f.advance(130*day);const renewal=(await f.buy(v,'premium')).order;await f.settle(renewal);grants=(await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants;assert.equal(Date.parse(grants.find(g=>g.orderId===renewal.id).startsAt),f.now());assert.equal((await f.db.prepare('SELECT qr FROM villas WHERE id=?').get(v.id)).qr,v.qr);
});
test('P2-05 team promotion distinct, package entitlement, stable selection, schedules and suspended ownership hide output',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,publicPromotions:true,homeSlots:2});const v=f.villas[2];await f.settle((await f.buy(v)).order);
 const data={villaId:v.id,placement:'detail',source:'PACKAGE',startsAt:new Date(f.now()-1000).toISOString(),endsAt:new Date(f.now()+day).toISOString(),approved:true};await f.expect('/phase2/promotions',data,f.sessions.admin);
 const team=await f.expect('/phase2/promotions',{...data,villaId:f.villas[0].id,source:'TEAM'},f.sessions.admin);assert.equal(team.promotion.source,'TEAM');const path='/phase2/public?placement=detail&seed=stable-browser';const one=await f.expect(path);assert.equal(one.promotions.length,1);const item=new URLSearchParams(new URL(one.promotions[0].href,'http://localhost').hash.slice(1)).get('item');assert(f.villas.some(v=>v.qr===item));assert.deepEqual(await f.expect(path),one);
 await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('account_status:'+f.users.merchant.id,JSON.stringify({status:'suspended'}));assert.equal((await f.expect(path)).promotions.length,0);
 await f.expect('/phase2/promotions',data,f.sessions.foreign,403);
});
test('P2-05 Social monthly quota is transactional, team work separate, duplicate post and unknown Premium channel denied',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);await f.settle((await f.buy(f.villas[2])).order);await f.settle((await f.buy(f.villas[3])).order);const month=new Date(f.now()+7*3600000).toISOString().slice(0,7),data={villaId:f.villas[2].id,source:'PACKAGE',kind:'image',channel:'facebook',month,status:'published',postUrl:'https://www.facebook.com/synthetic/posts/1',publishedAt:new Date(f.now()).toISOString()};
 await f.expect('/phase2/social',data,f.sessions.admin);await f.expect('/phase2/social',{...data,postUrl:'https://www.facebook.com/synthetic/posts/2'},f.sessions.admin,409);await f.expect('/phase2/social',{...data,source:'TEAM'},f.sessions.admin,409);
 await f.expect('/phase2/social',{...data,source:'TEAM',postUrl:'https://www.facebook.com/synthetic/posts/team'},f.sessions.admin);
 await f.expect('/phase2/social',{...data,villaId:f.villas[3].id,status:'scheduled'},f.sessions.admin,409);await f.setPolicy({premiumChannels:['facebook']});await f.expect('/phase2/social',{...data,villaId:f.villas[3].id,status:'scheduled'},f.sessions.admin);
 assert.equal((await f.expect('/phase2/social',undefined,f.sessions.foreign)).jobs.length,0);
});
test('P2-06 all4 packages accept verified reviews; pending and immediate modes; self/unverified/foreign reply/privacy defenses',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({reviewsEnabled:true,allowImmediateReviews:true,publicReviews:true});
 await f.expect('/phase2/reviews',{villaId:f.villas[0].id,rating:1,content:'Synthetic negative but permitted'},f.sessions.unverified,403);
 await f.db.prepare("INSERT INTO oauth_identities VALUES ('google',?,?)").run(randomUUID(),f.users.merchant.id);
 await f.expect('/phase2/reviews',{villaId:f.villas[0].id,rating:5,content:'Self'},f.sessions.merchant,403);
 const first=(await f.expect('/phase2/reviews',{villaId:f.villas[0].id,rating:1,content:'Synthetic permitted negative'},f.sessions.reviewer)).review;assert.equal(first.status,'pending');
 await f.expect('/phase2/review-mode',{villaId:f.villas[0].id,mode:'immediate',revision:0,reason:'Synthetic mode'},f.sessions.admin);assert.equal((await f.expect('/phase2/reviews',undefined,f.sessions.reviewer)).reviews[0].status,'pending');
 await f.expect('/phase2/moderate',{id:first.id,status:'rejected',reasonCode:'low_rating',reason:'Not allowed'},f.sessions.admin,400);await f.expect('/phase2/moderate',{id:first.id,status:'published',reason:'Content meets same rules'},f.sessions.admin);
 await f.expect('/phase2/reply',{id:first.id,content:'Foreign'},f.sessions.foreign,404);await f.expect('/phase2/reply',{id:first.id,content:'Synthetic merchant reply'},f.sessions.merchant);
 for(const v of f.villas.slice(1)){await f.expect('/phase2/review-mode',{villaId:v.id,mode:'immediate',revision:0,reason:'Synthetic mode'},f.sessions.admin);assert.equal((await f.expect('/phase2/reviews',{villaId:v.id,rating:1,content:'Synthetic review'},f.sessions.reviewer)).review.status,'published');}
 const pub=await f.expect('/phase2/public?villaId='+f.villas[0].id);assert.equal(pub.reviews[0].rating,1);assert(!JSON.stringify(pub).includes(f.users.reviewer.id));assert(!JSON.stringify(pub).includes(f.users.reviewer.email));await f.expect('/phase2/reviews',{villaId:f.villas[0].id,rating:5,content:'Duplicate'},f.sessions.reviewer,409);
 await f.expect('/phase2/moderate',{id:first.id,status:'rejected',reasonCode:'privacy',reason:'Synthetic privacy issue'},f.sessions.admin);assert.equal((await f.expect('/phase2/public?villaId='+f.villas[0].id)).reviews.length,0);
});
test('P2-06 media upload/capture/review dates distinct; change invalidates metadata review; cross-owner denied and unknown dates stay unknown',async t=>{
 const f=await fixture();t.after(f.close);const v=f.villas[0],m=(await f.expect('/phase2/media?villaId='+v.id,undefined,f.sessions.merchant)).media[0],before=await f.db.prepare('SELECT * FROM documents WHERE id=?').get(m.id);
 assert.equal(m.takenAt,null);await f.expect('/phase2/media',{villaId:v.id,mediaId:m.id,action:'capture',takenAt:'2026-01-01'},f.sessions.foreign,404);
 await f.expect('/phase2/media',{villaId:v.id,mediaId:m.id,action:'capture',takenAt:'2026-01-01'},f.sessions.merchant);let current=(await f.expect('/phase2/media?villaId='+v.id,undefined,f.sessions.admin)).media[0];assert.equal(current.verifiedAt,null);assert.equal(current.uploadedAt,m.uploadedAt);
 await f.expect('/phase2/media',{villaId:v.id,mediaId:m.id,action:'verify',confirmReviewed:true,reason:'Synthetic review'},f.sessions.merchant,403);await f.expect('/phase2/media',{villaId:v.id,mediaId:m.id,action:'verify',confirmReviewed:true,reason:'Synthetic review'},f.sessions.admin);
 await f.expect('/phase2/media',{villaId:v.id,mediaId:m.id,action:'capture',takenAt:null},f.sessions.merchant);current=(await f.expect('/phase2/media?villaId='+v.id,undefined,f.sessions.admin)).media[0];assert.equal(current.takenAt,null);assert.equal(current.verifiedAt,null);assert.deepEqual(await f.db.prepare('SELECT * FROM documents WHERE id=?').get(m.id),before);
});
test('CSRF, role revocation, wrong role, extra input, expired sessions and disabled runtime fail closed',async t=>{
 const f=await fixture();t.after(f.close);const path='/phase2/escalations',data={kind:'POLICY_CHANGE',reason:'Synthetic'};
 assert.equal((await f.request(path,data,{...f.sessions.admin,csrf:'wrong'})).status,403);await f.expect(path,{...data,role:'owner'},f.sessions.admin,400);
 await f.db.prepare("UPDATE users SET role='user' WHERE id=?").run(f.users.admin.id);await f.expect(path,data,f.sessions.admin,401);
 await f.db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(f.users.merchant.id);await f.expect('/phase2/workspace',undefined,f.sessions.merchant,401);
 f.config.phase2Enabled=false;await f.expect('/phase2/catalog',undefined,f.sessions.admin,503);
});
test('Trial concurrent activation and persistence failure rollback preserve all prior rows',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({trialScope:'MERCHANT_ACCOUNT'});const v=f.villas[0];
 const original=f.db.prepare;f.db.prepare=sql=>{const stmt=original(sql);if(sql.includes('INSERT INTO audits')){const run=stmt.run;stmt.run=(...args)=>{if(args[2]==='phase2.account_trial.started')throw Error('Synthetic rollback fault');return run(...args);};}return stmt;};
 await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin,500);f.db.prepare=original;
 assert.equal((await f.db.prepare("SELECT count(*)::int n FROM system_settings WHERE key LIKE 'phase2:v1:grant:%'").get()).n,0);
 const r=await Promise.all([f.request('/phase2/trial',{villaId:v.id},f.sessions.admin),f.request('/phase2/trial',{villaId:v.id},f.sessions.admin)]);assert(r.every(x=>x.status===200));assert.equal(r.filter(x=>x.body.created).length,1);
});
test('Renewed entitlement uses latest expiry for notices and old notice history stays preserved',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,noticeDays:[7]});await f.settle((await f.buy(f.villas[0],'basic')).order);f.advance(23*day);await f.expect('/phase2/notices',{},f.sessions.admin);
 const order=(await f.buy(f.villas[0])).order;await f.settle(order);f.advance(7*day);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).notices.length,0);
 assert.equal((await f.db.prepare("SELECT count(*)::int n FROM system_settings WHERE key LIKE 'phase2:v1:notice:%'").get()).n,2);
});
test('Configured VAT snapshots and billing period remain exact after later policy edits',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,vatMode:'INCLUSIVE',vatBasisPoints:700});const first=(await f.buy(f.villas[0])).order;assert.equal(first.totalSatang,99000);assert.equal(first.vatSatang,Math.round(99000*700/10700));
 await f.setPolicy({vatMode:'INCLUSIVE',vatBasisPoints:700,billingDays:31});const second=(await f.buy(f.villas[1])).order;assert.equal(second.totalSatang,199000);assert.equal(second.vatSatang,Math.round(199000*700/10700));assert.equal((await f.expect('/phase2/orders',undefined,f.sessions.admin)).orders.find(o=>o.id===first.id).billingDays,30);
});
test('Existing authenticated upload stores actual file bytes and automatic upload date; Phase2 metadata never rewrites file bytes',async t=>{
 const f=await fixture();t.after(f.close);const v=f.villas[1],bytes=fs.readFileSync('public/demo/villas/villa-1.jpg');
 const upload=await f.expect('/merchant/property-media',{villaId:v.id,file:{name:'LICENSED-SYNTHETIC.jpg',type:'image/jpeg',data:'data:image/jpeg;base64,'+bytes.toString('base64')},takenAt:'2026-01-01'},f.sessions.merchant);
 assert(upload);const ms=(await f.expect('/phase2/media?villaId='+v.id,undefined,f.sessions.merchant)).media;const m=ms.find(m=>m.kind==='image'&&m.takenAt==='2026-01-01');assert(m);assert(Number.isFinite(Date.parse(m.uploadedAt)));assert.equal(m.verifiedAt,null);const stored=await f.db.prepare('SELECT bytes FROM documents WHERE id=?').get(m.id);assert.deepEqual(Buffer.from(stored.bytes),bytes);
 await f.expect('/phase2/media',{villaId:v.id,mediaId:m.id,action:'verify',reason:'Synthetic image opened and reviewed',confirmReviewed:true},f.sessions.admin);assert.deepEqual(Buffer.from((await f.db.prepare('SELECT bytes FROM documents WHERE id=?').get(m.id)).bytes),bytes);
});
test('Unknown publication policy exposes no review or banner and guests cannot read workflow data',async t=>{
 const f=await fixture();t.after(f.close);assert.deepEqual((await f.expect('/phase2/public?villaId='+f.villas[0].id)).reviews,[]);assert.equal((await f.expect('/phase2/public')).promotions.length,0);
 for(const path of ['/phase2/workspace','/phase2/orders','/phase2/media?villaId='+f.villas[0].id,'/phase2/escalations','/phase2/reviews'])await f.expect(path,undefined,undefined,401);
 await f.expect('/phase2/reviews',{villaId:f.villas[0].id,content:'Disabled',rating:5},f.sessions.reviewer,503);
});
test('Unknown Phase2 API resources are404 before auth; Merchant User portal has no own review shortcut or Admin controls',async t=>{
 const f=await fixture();t.after(f.close);await f.expect('/phase2/does-not-exist',undefined,undefined,404);await f.expect('/phase2/does-not-exist',undefined,f.sessions.admin,404);
 const s={...f.sessions.merchant,role:'user'},r=await f.expect('/phase2/catalog',undefined,s);assert.equal(r.canReview,true);assert.equal(r.canMerchant,false);assert.equal(r.canAdmin,false);
 const w=await f.expect('/phase2/workspace',undefined,s);assert(w.villas.every(v=>v.isOwn===true));assert(w.villas.every(v=>!Object.hasOwn(v,'owner_id')));
 f.config.phase2Enabled=false;await f.expect('/phase2/does-not-exist',undefined,undefined,404);
});
test('P2-06 matrix: each of4 packages supports both pending and immediate mode without package-based censorship',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({reviewsEnabled:true,allowImmediateReviews:true,publicReviews:true});
 for(const v of f.villas){let revision=0;for(const mode of ['pending','immediate']){
  await f.expect('/phase2/review-mode',{villaId:v.id,mode,revision,reason:'SYNTHETIC matrix'},f.sessions.admin);revision++;
  const user=await createUser(f.db,randomUUID()+'@synthetic.invalid',syntheticPassword,'SYNTHETIC matrix','user');await f.db.prepare("INSERT INTO oauth_identities VALUES ('google',?,?)").run(randomUUID(),user.id);
  const login=await f.request('/auth/login',{email:user.email,password:syntheticPassword}),session={cookie:login.cookie,csrf:login.body.csrf,role:'user'};
  const r=(await f.expect('/phase2/reviews',{villaId:v.id,content:'SYNTHETIC '+mode,rating:1},session)).review;assert.equal(r.status,mode==='pending'?'pending':'published');
  const pub=await f.expect('/phase2/public?villaId='+v.id);assert.equal(pub.reviews.some(x=>x.id===r.id),mode==='immediate');
 }}
});
test('P2-05 concurrent Social submissions cannot exceed one approved monthly image quota',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);await f.settle((await f.buy(f.villas[2])).order);const d={villaId:f.villas[2].id,source:'PACKAGE',kind:'image',channel:'facebook',month:new Date(f.now()+7*3600000).toISOString().slice(0,7),status:'scheduled'};
 const r=await Promise.all([f.request('/phase2/social',d,f.sessions.admin),f.request('/phase2/social',d,f.sessions.admin)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);
});
test('P2-05 pending/future/exact-expiry banners stay hidden and suspended parent is rechecked',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({publicPromotions:true});const v=f.villas[0],path='/phase2/public?placement=detail&seed=constant';
 await f.expect('/phase2/promotions',{villaId:v.id,source:'TEAM',placement:'detail',startsAt:new Date(f.now()-day).toISOString(),endsAt:new Date(f.now()+3*day).toISOString(),approved:false},f.sessions.admin);
 await f.expect('/phase2/promotions',{villaId:v.id,source:'TEAM',placement:'detail',startsAt:new Date(f.now()+day).toISOString(),endsAt:new Date(f.now()+2*day).toISOString(),approved:true},f.sessions.admin);assert.equal((await f.expect(path)).promotions.length,0);
 f.advance(day);assert.equal((await f.expect(path)).promotions.length,1);await f.db.prepare("UPDATE villas SET status='changes' WHERE id=?").run(v.id);assert.equal((await f.expect(path)).promotions.length,0);await f.db.prepare("UPDATE villas SET status='approved' WHERE id=?").run(v.id);f.advance(day);assert.equal((await f.expect(path)).promotions.length,0);
});
test('Banner files must use actual public media storage binding; private documents cannot be substituted',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({publicPromotions:true});const v=f.villas[0],id=v.photo_url.split('/').at(-1),data={villaId:v.id,source:'TEAM',placement:'detail',startsAt:new Date(f.now()-1000).toISOString(),endsAt:new Date(f.now()+day).toISOString(),approved:true};
 await f.db.prepare("UPDATE documents SET name='private-ownership-proof' WHERE id=?").run(id);assert.equal((await fetch(f.base+v.photo_url)).status,404);await f.expect('/phase2/promotions',data,f.sessions.admin,409);
 await f.db.prepare("UPDATE documents SET name='property-media' WHERE id=?").run(id);const file=await fetch(f.base+v.photo_url);assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'image/jpeg');assert.deepEqual(Buffer.from(await file.arrayBuffer()),fs.readFileSync('public/demo/villas/villa-1.jpg'));await f.expect('/phase2/promotions',data,f.sessions.admin);
 await f.db.prepare("UPDATE documents SET name='private-ownership-proof' WHERE id=?").run(id);assert.equal((await f.expect('/phase2/public?placement=detail')).promotions.length,0);
});
test('P2-05 homepage waits for explicit slots/rotation; configured Premium shows and expires while Pro cannot claim it',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,publicPromotions:true});const pro=f.villas[2],premium=f.villas[3];await f.settle((await f.buy(pro)).order);await f.settle((await f.buy(premium)).order);
 for(const v of [pro,premium])await f.expect('/phase2/promotions',{villaId:v.id,source:'PACKAGE',placement:'home',startsAt:new Date(f.now()-1000).toISOString(),endsAt:new Date(f.now()+40*day).toISOString(),approved:true},f.sessions.admin);
 assert.equal((await f.expect('/phase2/public?placement=home')).promotions.length,0);await f.setPolicy({homeSlots:1,homeRotation:'STABLE_SESSION'});const shown=await f.expect('/phase2/public?placement=home&seed=fixed');assert.equal(shown.promotions.length,1);assert.equal(shown.promotions[0].villaId,premium.id);f.advance(30*day);assert.equal((await f.expect('/phase2/public?placement=home')).promotions.length,0);
});
test('P2-04 account trial begins at first Admin activation after complete approval; recorded eligibility remains distinct',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({trialScope:'MERCHANT_ACCOUNT'});const v=f.villas[0];f.advance(2*day);const result=await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin);assert.equal(Date.parse(result.trial.startsAt),f.now());assert.equal(result.trial.eligibilityAt,v.reviewed_at);assert.equal(Date.parse(result.trial.endsAt),f.now()+90*day);assert.equal(Date.parse(result.trial.activatedAt),f.now());
});

test('Read-only entitlement bridge preserves legacy catalog rights and media limits across Sandbox expiry',async t=>{
 const f=await fixture();t.after(f.close);const before=await f.db.prepare('SELECT * FROM package_catalog ORDER BY id').all();const v=f.villas[0];await f.setPolicy({trialScope:'MERCHANT_ACCOUNT'});await f.expect('/phase2/trial',{villaId:v.id},f.sessions.admin);
 const workspace=await f.expect('/phase2/workspace',undefined,f.sessions.merchant);const rights=workspace.packageRights.find(r=>r.villaId===v.id);assert.equal(rights.legacy.packageId,v.package_id);assert.equal(rights.phase2.active[0].packageId,'starter');assert.equal(rights.phase2.legacyPreserved,true);f.advance(91*day);const expired=(await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).packageRights.find(r=>r.villaId===v.id);assert.equal(expired.phase2.active.length,0);assert.deepEqual(expired.legacy,rights.legacy);assert.deepEqual(await f.db.prepare('SELECT * FROM package_catalog ORDER BY id').all(),before);
});
test('Actual-runtime environment guards reject cloud cross-targets, Production and provider credentials',async()=>{
 const {phase2Environment}=await import('../../server/phase2-environment.mjs');const target=(await import('../../server/phase2-preview-target.json',{with:{type:'json'}})).default;
 const env={APP_ENV:'phase2-preview',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:target.vercelProjectId,VERCEL_URL:'villacheck-qa-phase1-example-villa-check.vercel.app',DATABASE_URL:'postgresql://'+target.role+':synthetic@'+target.host+'/'+target.database+'?sslmode=verify-full',PHASE2_ENABLED:'true',PAYMENT_ACCESS_MODE:'DISABLED',SEED_DEMO_ACCOUNTS:'false',SEED_PUBLIC_DEMO_DATA:'false',OTP_SECRET:'SYNTHETIC_123456789012345678901234567890'};
 assert.match(phase2Environment(env).APP_URL,/^https:/);for(const change of [{VERCEL_ENV:'production'},{VERCEL_PROJECT_ID:'prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC'},{DATABASE_URL:env.DATABASE_URL.replace(target.database,'villacheck_qa_phase1')},{SMTP_HOST:'not-allowed'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'}])assert.throws(()=>phase2Environment({...env,...change}));
});

test('Phase2 legacy financial mutation paths fail closed without changing legacy grants/catalog',async t=>{
 const f=await fixture();t.after(f.close);const before=await f.db.prepare('SELECT * FROM package_catalog ORDER BY id').all(),grants=await f.db.prepare("SELECT * FROM system_settings WHERE key LIKE 'basic_grant:%'").all();for(const [path,actor]of [['/merchant/villa-package',f.sessions.merchant],['/subscription',f.sessions.merchant],['/subscription/upgrade',f.sessions.merchant],['/admin/packages',f.sessions.admin],['/admin/basic-promotion',f.sessions.admin]])await f.expect(path,{villaId:f.villas[2].id,packageId:'basic'},actor,503);assert.deepEqual(await f.db.prepare('SELECT * FROM package_catalog ORDER BY id').all(),before);assert.deepEqual(await f.db.prepare("SELECT * FROM system_settings WHERE key LIKE 'basic_grant:%'").all(),grants);await f.expect('/packages',undefined,f.sessions.merchant);await f.expect('/merchant/villa-package/not-a-route',{},f.sessions.merchant,404);await f.expect('/payments',{},null,404);
});
test('Phase2 same-ID enrollment creates capability without old3-month trial; existing legacy rights remain untouched',async t=>{
 const f=await fixture();t.after(f.close);f.config.unifiedAuthEnabled=true;const legacyBefore=await f.db.prepare('SELECT * FROM subscriptions ORDER BY owner_id').all();const result=await f.expect('/user/merchant-registration',{businessName:'SYNTHETIC',businessNameEn:'SYNTHETIC',contactName:'SYNTHETIC',phone:'0800000000',address:'SYNTHETIC',bankName:'SYNTHETIC',accountName:'SYNTHETIC',accountNumber:'1234567890',consent:true},f.sessions.reviewer);assert.equal(result.user.id,f.users.reviewer.id);assert.equal(result.user.role,'user');assert.equal(result.user.capabilities.merchant,true);assert.equal(await f.db.prepare('SELECT value FROM system_settings WHERE key=?').get('merchant_free_period:'+f.users.reviewer.id),undefined);assert.deepEqual(await f.db.prepare('SELECT * FROM subscriptions ORDER BY owner_id').all(),legacyBefore);
});

test('P2-08 reconciliation returns immutable terms, ordered outcomes and one linked grant only to Admin or purchaser',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,vatMode:'INCLUSIVE',vatBasisPoints:700});
 const order=(await f.buy(f.villas[0],'premium')).order,path='/phase2/orders?orderId='+order.id;
 await f.expect(path,undefined,undefined,401);await f.expect(path,undefined,f.sessions.foreign,404);await f.expect(path,undefined,f.sessions.reviewer,404);
 let detail=await f.expect(path,undefined,f.sessions.merchant);assert.equal(detail.grant,null);assert.deepEqual(detail.events,[]);
 await f.settle(order,'pending');const envelope=f.config.phase2SandboxGateway.create(order,'succeeded');
 await settlePhase2Sandbox(f.db,f.users.admin,f.config,envelope,new Date(f.now()).toISOString());
 await settlePhase2Sandbox(f.db,f.users.admin,f.config,envelope,new Date(f.now()+1000).toISOString());
 await f.setPolicy({vatMode:'INCLUSIVE',vatBasisPoints:0,billingDays:31});
 detail=await f.expect(path,undefined,f.sessions.admin);const own=await f.expect(path,undefined,f.sessions.merchant);assert.deepEqual(own,detail);
 assert.deepEqual(detail.events.map(e=>e.status),['pending','succeeded']);assert.deepEqual(detail.events.map(e=>e.sequence),[1,2]);assert(detail.events.every(e=>e.amountSatang===order.totalSatang&&e.currency==='THB'&&e.providerReference===order.providerReference&&!('fingerprint' in e)&&!('signature' in e)));
 assert.equal(detail.order.totalSatang,499000);assert.equal(detail.order.vatMode,'INCLUSIVE');assert.equal(detail.order.billingDays,30);
 assert.equal(detail.grant.orderId,order.id);assert.equal(detail.grant.id,detail.order.grantId);assert.equal(Date.parse(detail.grant.endsAt)-Date.parse(detail.grant.startsAt),30*day);
 assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.filter(g=>g.orderId===order.id).length,1);
 await f.expect('/phase2/orders?orderId='+randomUUID(),undefined,f.sessions.admin,404);
});

test('P2-04 approved single seven-day Email + in-app reminder retries safely; no day3/expiry/post-expiry reminder',async t=>{
 const f=await fixture();t.after(f.close);const sent=[];Object.assign(f.config,{phase2ReminderDeliveryAcceptanceReference:'SYNTHETIC_LOCAL_ONLY',phase2Scheduler:{enabled:true,approvalReference:'SYNTHETIC_LOCAL_ONLY'},phase2EmailEnabled:true,phase2NoticeTransport:{sendMail:async()=>{throw Error('SENSITIVE_FAKE_SMTP_ERROR');}},smtpFrom:'synthetic@synthetic.invalid',phase2EmailRecipientAllowlist:[f.users.merchant.email]});
 await f.setPolicy({noticeDays:[7],noticeChannels:['IN_APP','EMAIL']});await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin);
 f.advance(83*day);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,1);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);
 assert.equal((await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)).failed,1);f.advance(120001);f.config.phase2NoticeTransport={sendMail:async m=>sent.push(m)};
 const results=await Promise.all([f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin),f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)]);assert.equal(results.reduce((n,r)=>n+r.sent,0),1);assert.equal(sent.length,1);
 for(const delta of [4*day,3*day,2*day]){f.advance(delta);assert.equal((await f.expect('/phase2/notices',{},f.sessions.admin)).created.length,0);assert.equal((await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)).sent,0);}
 const stored=await f.db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:notice-email:%'").all();assert(!JSON.stringify(stored).includes('SENSITIVE_FAKE_SMTP_ERROR'));assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).notices.length,1);assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.foreign)).notices.length,0);
});
test('P2-04 renewal cancels stale Email; allowlist and unconfigured delivery fail closed',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,noticeDays:[7],noticeChannels:['EMAIL']});await f.settle((await f.buy(f.villas[0],'basic')).order);f.advance(23*day);await f.expect('/phase2/notices',{},f.sessions.admin);
 await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin,503);let count=0;Object.assign(f.config,{phase2ReminderDeliveryAcceptanceReference:"SYNTHETIC_LOCAL_ONLY",phase2Scheduler:{enabled:true,approvalReference:"SYNTHETIC_LOCAL_ONLY"},phase2EmailEnabled:true,phase2NoticeTransport:{sendMail:async()=>count++},smtpFrom:'qa@synthetic.invalid',phase2EmailRecipientAllowlist:['unrelated@synthetic.invalid']});
 assert.equal((await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)).blocked,1);assert.equal(count,0);f.config.phase2EmailRecipientAllowlist=[f.users.merchant.email];await f.settle((await f.buy(f.villas[0])).order);
 assert.equal((await f.expect('/phase2/notices',{action:'deliver'},f.sessions.admin)).sent,0);assert.equal(count,0);assert.deepEqual((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).notices,[]);
});

test('Scheduled Social job can be marked published once using its reserved quota, with immutable binding and publication audit',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);await f.settle((await f.buy(f.villas[2])).order);
 const data={villaId:f.villas[2].id,source:'PACKAGE',kind:'image',channel:'facebook',month:new Date(f.now()+7*3600000).toISOString().slice(0,7),status:'scheduled'};
 const scheduled=(await f.expect('/phase2/social',data,f.sessions.admin)).job;
 const publication={...data,jobId:scheduled.id,revision:scheduled.revision||1,status:'published',postUrl:'https://www.facebook.com/synthetic/posts/reserved?utm_source=test',publishedAt:new Date(f.now()).toISOString()};
 await f.expect('/phase2/social',publication,f.sessions.merchant,403);
 await f.expect('/phase2/social',{...publication,villaId:f.villas[1].id},f.sessions.admin,409);
 const result=await f.expect('/phase2/social',publication,f.sessions.admin);assert.equal(result.job.id,scheduled.id);assert.equal(result.job.status,'published');assert.equal(result.job.revision,2);assert.equal(result.job.publishedBy,f.users.admin.id);assert.equal(result.externalPostsCreated,0);
 assert((await f.expect('/phase2/social',publication,f.sessions.admin)).duplicate);
 await f.expect('/phase2/social',{...publication,postUrl:'https://facebook.com/synthetic/posts/changed'},f.sessions.admin,409);
 await f.expect('/phase2/social',{...data,postUrl:'',status:'scheduled'},f.sessions.admin,409);
 const jobs=(await f.expect('/phase2/social',undefined,f.sessions.merchant)).jobs;assert.equal(jobs.length,1);assert.equal(jobs[0].history.length,2);
 assert.equal((await f.db.prepare("SELECT count(*)::int n FROM audits WHERE action='phase2.social.published' AND target_id=?").get(scheduled.id)).n,1);
});
