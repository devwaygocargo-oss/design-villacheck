import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {registryPrecheckFixture} from './helpers/registry-precheck-fixture.mjs';
import {merchantQrScanCounts} from '../../server/merchant-qr-scans.mjs';
import {publicPhase1RequestAllowed} from '../../server/public-phase1-release.mjs';
const config={productionReleaseMode:'PHASE1_PUBLIC',unifiedAuthEnabled:true,otpLoginEnabled:true,phase1RequirementsRevision:'QR_SCANS',phase1ActivationMode:'BLOCKED',phase1EmailOtpDelivery:'SMTP',phase1EmailOtpApproval:'LOCAL',internalAdminSetup:false,publicPublicationDisabled:false,appEnvironment:'test'};
test('Phase1 permits only the narrow public telemetry route; Admin-only remains private',()=>{assert(publicPhase1RequestAllowed('POST','/api/public/events',{}));assert(!publicPhase1RequestAllowed('POST','/api/public/events',{adminOnly:true}));assert(!publicPhase1RequestAllowed('GET','/api/public/events',{}));});
test('Valid QR scan events persist once under retry/concurrency, while distinct opens count separately',async t=>{
 const f=await registryPrecheckFixture(config);t.after(f.close);const qr=f.villas.sea.qr,eventId=randomUUID();const results=await Promise.all(Array.from({length:8},()=>f.request('/public/events',{qr,kind:'QR_SCAN',eventId})));assert(results.every(r=>r.status===200));assert.equal((await f.db.prepare("SELECT count(*)::int n FROM villa_events WHERE villa_id=? AND kind='QR_SCAN'").get(f.villas.sea.id)).n,1);
 await f.expect('/public/events',{qr,kind:'QR_SCAN',eventId:randomUUID()});assert.equal((await merchantQrScanCounts(f.db,f.legacy.id)).get(f.villas.sea.id).total,2);
 await f.expect('/public/events',{qr:f.villas.garden.qr,kind:'QR_SCAN',eventId},undefined,409);assert.equal((await merchantQrScanCounts(f.db,f.legacy.id)).has(f.villas.garden.id),false);
 const alias='VC-LEGACY-'+randomUUID();await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('qr_alias:'+alias,JSON.stringify({villaId:f.villas.sea.id}));const aliasEvent=randomUUID();await f.expect('/public/events',{qr:alias,kind:'QR_SCAN',eventId:aliasEvent});await f.expect('/public/events',{qr,kind:'QR_SCAN',eventId:aliasEvent});assert.equal((await merchantQrScanCounts(f.db,f.legacy.id)).get(f.villas.sea.id).total,3);
});
test('Invalid/locked QR, unrelated events and cross-origin requests do not inflate counts; previews excluded',async t=>{
 const f=await registryPrecheckFixture(config);t.after(f.close);const data={kind:'QR_SCAN',eventId:randomUUID()};for(const qr of ['VC-UNKNOWN-0000',f.villas.pending.qr,f.villas.suspended.qr])await f.expect('/public/events',{...data,qr},undefined,404);
 for(const kind of ['PROFILE_VIEW','CONTACT_VIEW','invalid'])await f.expect('/public/events',{qr:f.villas.sea.qr,kind,eventId:randomUUID()},undefined,400);
 await f.expect('/public/events',{qr:f.villas.sea.qr,kind:'QR_SCAN',eventId:'not-an-id'},undefined,400);
 const r=await fetch(f.base+'/api/public/events',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify({...data,qr:f.villas.sea.qr})});assert.equal(r.status,403);
 for(const actor of [f.legacy,f.admin]){const s=await f.login(actor);const r=await f.expect('/public/events',{...data,qr:f.villas.sea.qr},s);assert.equal(r.body.counted,false);}
 assert.equal((await f.db.prepare('SELECT count(*)::int n FROM villa_events').get()).n,0);
});
test('Owner-scoped state shows lifetime/30-day scan counts, zero properties, and excludes foreign/contact/profile events',async t=>{
 const f=await registryPrecheckFixture(config);t.after(f.close);const now=Date.now(),add=(villa,kind,days)=>f.db.prepare('INSERT INTO villa_events VALUES (?,?,?,?)').run(randomUUID(),villa,kind,new Date(now-days*86400000).toISOString());
 await add(f.villas.sea.id,'QR_SCAN',1);await add(f.villas.sea.id,'QR_SCAN',40);await add(f.villas.sea.id,'PROFILE_VIEW',1);await add(f.villas.sea.id,'CONTACT_VIEW',1);await add(f.villas.missing.id,'QR_SCAN',1);
 const counts=await merchantQrScanCounts(f.db,f.legacy.id,now);assert.deepEqual(counts.get(f.villas.sea.id),{total:2,last30Days:1});assert(!counts.has(f.villas.missing.id));
 const owner=await f.login(f.legacy),state=(await f.expect('/state',undefined,owner)).body;assert.deepEqual(state.villas.find(v=>v.id===f.villas.sea.id).qrScans,{total:2,last30Days:1});assert.deepEqual(state.villas.find(v=>v.id===f.villas.garden.id).qrScans,{total:0,last30Days:0});assert(!state.villas.some(v=>v.id===f.villas.missing.id));
 const second=await f.login(f.secondOwner),foreign=(await f.expect('/state',undefined,second)).body;assert(foreign.villas.every(v=>v.id===f.villas.missing.id));assert.deepEqual(foreign.villas[0].qrScans,{total:1,last30Days:1});
 const admin=await f.login(f.admin);assert((await f.expect('/state',undefined,admin)).body.villas.every(v=>v.qrScans===undefined));
});
test('Rolling 30-day boundary is inclusive and uses persisted events, not visitors',async t=>{
 const f=await registryPrecheckFixture(config);t.after(f.close);const now=Date.now();for(const ms of [now-30*86400000,now-30*86400000-1,now])await f.db.prepare('INSERT INTO villa_events VALUES (?,?,?,?)').run(randomUUID(),f.villas.sea.id,'QR_SCAN',new Date(ms).toISOString());assert.deepEqual((await merchantQrScanCounts(f.db,f.legacy.id,now)).get(f.villas.sea.id),{total:3,last30Days:2});
});
