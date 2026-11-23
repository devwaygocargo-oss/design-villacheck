import test from 'node:test';
import assert from 'node:assert/strict';
import {phase2OperationsConfig,phase2SmtpOptions,phase2OperationsPreflight} from '../../server/phase2-operations-config.mjs';
import {tickPhase2NoticeScheduler} from '../../server/phase2-notice-scheduler.mjs';
import {fixture} from './fixture.mjs';
test('Operations configuration is inert/disabled by default; approved cadence and encrypted SMTP settings are mandatory',()=>{
 const p=phase2OperationsPreflight({});assert.equal(p.networkCalls,0);assert.equal(p.smtp.enabled,false);assert.equal(p.scheduler.enabled,false);assert.equal(phase2SmtpOptions({}),null);
 for(const env of [{PHASE2_SCHEDULER_ENABLED:'true'},{PHASE2_SCHEDULER_ENABLED:'true',PHASE2_SCHEDULER_INTERVAL_MINUTES:'5'},{PHASE2_SCHEDULER_INTERVAL_MINUTES:'0'},{PHASE2_SMTP_ENABLED:'true'},{PHASE2_SMTP_ENABLED:'true',PHASE2_SMTP_PORT:'25'}])assert.throws(()=>phase2OperationsConfig(env));
 const env={PHASE2_SMTP_ENABLED:'true',PHASE2_SMTP_HOST:'smtp.synthetic.invalid',PHASE2_SMTP_PORT:'587',PHASE2_SMTP_USER:'synthetic-fixture-only',PHASE2_SMTP_PASSWORD:'SYNTHETIC_NOT_A_REAL_CREDENTIAL',PHASE2_SMTP_FROM:'qa@synthetic.invalid',PHASE2_EMAIL_RECIPIENT_ALLOWLIST:'qa@synthetic.invalid',PHASE2_SMTP_APPROVAL_REFERENCE:'SYNTHETIC_CONFIG_NOT_APPROVAL'};
 const options=phase2SmtpOptions(env);assert.equal(options.secure,false);assert.equal(options.requireTLS,true);assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.logger,false);assert.equal(options.debug,false);assert.equal(phase2SmtpOptions({...env,PHASE2_SMTP_PORT:'465'}).secure,true);
 const report=JSON.stringify(phase2OperationsPreflight(env));assert(!report.includes(env.PHASE2_SMTP_PASSWORD));assert(!report.includes(env.PHASE2_SMTP_USER));assert(!report.includes(env.PHASE2_SMTP_HOST));assert(!report.includes(env.PHASE2_SMTP_FROM));assert(report.includes('BLOCKED'));
});
test('Scheduler is explicitly invoked, gated by approval, concurrency-safe and uses mock clock cadence without delivery',async t=>{
 const f=await fixture();t.after(f.close);let calls=0;const generate=async()=>{calls++;};
 assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,generate)).status,'BLOCKED');assert.equal(calls,0);
 f.config.phase2Scheduler={enabled:true,intervalMinutes:5,approvalReference:'SYNTHETIC_CADENCE_ONLY'};
 const results=await Promise.all([tickPhase2NoticeScheduler(f.db,f.config,generate),tickPhase2NoticeScheduler(f.db,f.config,generate)]);assert.equal(calls,1);assert.equal(results.filter(r=>r.generated).length,1);assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,generate)).status,'SKIPPED');
 f.advance(300000);assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,generate)).status,'PASS');assert.equal(calls,2);
 f.advance(300000);assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,async()=>{throw Error('DO_NOT_LOG_SECRETS');})).status,'FAIL');assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,generate)).status,'PASS');
 const row=await f.db.prepare("SELECT value FROM system_settings WHERE key='phase2:v1:notice-scheduler'").get();assert(!row.value.includes('DO_NOT_LOG_SECRETS'));
 f.config.phase2Scheduler.enabled=false;f.advance(300000);assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,generate)).status,'BLOCKED');assert.equal(calls,3);
 f.config.productionRuntime=true;await assert.rejects(tickPhase2NoticeScheduler(f.db,f.config,generate),e=>e.status===503);
});
test('Scheduler lease recovery runs actual generation once per due notice and never restarts trial or sends Email',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({trialScope:'MERCHANT_ACCOUNT',noticeDays:[7],noticeChannels:['IN_APP']});const trial=(await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin)).trial;f.advance(83*86400000);
 f.config.phase2Scheduler={enabled:true,intervalMinutes:5,approvalReference:'SYNTHETIC_NOT_BUSINESS_APPROVAL'};
 await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('phase2:v1:notice-scheduler',JSON.stringify({status:'RUNNING',lease:'synthetic-crashed-worker',leaseUntil:f.now()+120000,nextRun:0}));
 const generate=async()=>f.expect('/phase2/notices',{},f.sessions.admin);
 assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,generate)).status,'SKIPPED');f.advance(120000);assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,generate)).generated,true);
 f.advance(300000);assert.equal((await tickPhase2NoticeScheduler(f.db,f.config,generate)).generated,true);const w=await f.expect('/phase2/workspace',undefined,f.sessions.merchant);assert.equal(w.notices.length,1);assert.equal(w.grants[0].startsAt,trial.startsAt);assert.equal(w.grants[0].endsAt,trial.endsAt);
 const mails=await f.db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:notice-email:%'").all();assert.deepEqual(mails,[]);
});
test('Dedicated SMTP binding creates no transport until both explicit flags and approval are present, and refuses Production',async()=>{
 const {preparePhase2NoticeTransport}=await import('../../server/phase2-operations-config.mjs');let factories=0;
 const factory=options=>{factories++;assert.equal(options.requireTLS,true);assert.equal(options.tls.rejectUnauthorized,true);return {kind:'LOCAL_FAKE_TRANSPORT_NO_DELIVERY'};};
 assert.equal(await preparePhase2NoticeTransport({},factory),undefined);assert.equal(factories,0);
 const env={APP_ENV:'phase2-local',PHASE2_SMTP_ENABLED:'true',PHASE2_SMTP_HOST:'smtp.synthetic.invalid',PHASE2_SMTP_PORT:'587',PHASE2_SMTP_USER:'synthetic-fixture-only',PHASE2_SMTP_PASSWORD:'SYNTHETIC_NOT_A_REAL_CREDENTIAL',PHASE2_SMTP_FROM:'qa@synthetic.invalid',PHASE2_EMAIL_RECIPIENT_ALLOWLIST:'qa@synthetic.invalid',PHASE2_SMTP_APPROVAL_REFERENCE:'SYNTHETIC_CONFIG_NOT_APPROVAL'};
 assert.equal(await preparePhase2NoticeTransport(env,factory),undefined);assert.equal(factories,0);
 const transport=await preparePhase2NoticeTransport({...env,PHASE2_EMAIL_ENABLED:'true'},factory);assert.equal(transport.kind,'LOCAL_FAKE_TRANSPORT_NO_DELIVERY');assert.equal(factories,1);
 await assert.rejects(preparePhase2NoticeTransport({...env,PHASE2_EMAIL_ENABLED:'true',APP_ENV:'production'},factory));assert.equal(factories,1);
});
