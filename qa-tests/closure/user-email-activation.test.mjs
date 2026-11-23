import test from 'node:test';import assert from 'node:assert/strict';
import {roleOtpContactVerified} from '../../server/role-otp-contacts.mjs';
import {merchantFixture} from './helpers/merchant-test-fixture.mjs';
const config={productionReleaseMode:'PHASE1_PUBLIC',unifiedAuthEnabled:true,otpLoginEnabled:true,phase1RequirementsRevision:'EMAIL_ACTIVATION',phase1ActivationMode:'BLOCKED',phase1EmailOtpDelivery:'SMTP',phase1EmailOtpApproval:'LOCAL_ONLY',otpLoginTestTiming:true,appEnvironment:'test'};
test('Email signup cannot login before activation; wrong proof/browser/replay denied; verified password works',async t=>{
const f=await merchantFixture(config);t.after(f.close);const email='local-activation@example.test',password='LocalActivation123';
const pending=await f.expect('/auth/register-user',{email,password,name:'LOCAL Activation'},undefined,202);
assert.equal(pending.body.verificationRequired,true);assert(!pending.body.user&&!pending.body.csrf);assert(!await f.db.prepare('SELECT id FROM users WHERE email=?').get(email));
await f.expect('/auth/login',{email,password},undefined,401);await f.expect('/auth/me',undefined,{cookie:pending.cookie},401);
await f.server.runOtpDeliveries();const code=f.sent.at(-1).text.match(/\b\d{6}\b/)[0];
await f.expect('/auth/registration/verify',{challengeId:pending.body.challengeId,code},{cookie:'vc_registration='+'f'.repeat(64)},401);
await f.expect('/auth/registration/verify',{challengeId:pending.body.challengeId,code:code==='000000'?'000001':'000000'},{cookie:pending.cookie},401);
assert(!await f.db.prepare('SELECT id FROM users WHERE email=?').get(email));
const verified=await f.expect('/auth/registration/verify',{challengeId:pending.body.challengeId,code},{cookie:pending.cookie});assert.equal(verified.body.user.role,'user');
await f.expect('/auth/registration/verify',{challengeId:pending.body.challengeId,code},{cookie:pending.cookie},401);
const login=await f.expect('/auth/login',{email,password});await f.expect('/auth/me',undefined,{cookie:login.cookie});
const user=await f.db.prepare('SELECT * FROM users WHERE email=?').get(email);assert(await roleOtpContactVerified(f.db,user,'email',email));
});
test('Legacy unverified user password denied without session; email OTP activates same account; merchant/admin regressions',async t=>{
const f=await merchantFixture(config);t.after(f.close);
await f.db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('unverified_registration_email:'+f.other.id,JSON.stringify({email:f.other.email,emailVerified:false}));
const before=(await f.db.prepare('SELECT count(*)::int n FROM sessions WHERE user_id=?').get(f.other.id)).n;
const denied=await f.expect('/auth/login',{email:f.other.email,password:'LocalPassword123'},undefined,403);assert.equal(denied.body.code,'EMAIL_VERIFICATION_REQUIRED');assert(!denied.cookie);
assert.equal((await f.db.prepare('SELECT count(*)::int n FROM sessions WHERE user_id=?').get(f.other.id)).n,before);
const request=await f.expect('/auth/otp/request',{channel:'email',destination:f.other.email,accountType:'user'},undefined,202);await f.server.runOtpDeliveries();const code=f.sent.at(-1).text.match(/\b\d{6}\b/)[0];
const verified=await f.expect('/auth/otp/verify',{challengeId:request.body.challengeId,code},{cookie:request.cookie});assert.equal(verified.body.user.id,f.other.id);
await f.expect('/auth/login',{email:f.other.email,password:'LocalPassword123'});await f.login(f.legacy);await f.login(f.admin);
});
