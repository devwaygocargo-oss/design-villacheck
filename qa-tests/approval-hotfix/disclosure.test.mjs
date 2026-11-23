import test from 'node:test';import assert from 'node:assert/strict';
import {registryPrecheckFixture,registeredAccount,privatePhone} from '../closure/helpers/registry-precheck-fixture.mjs';
test('Public QR never discloses bank/contact values across viewer roles or portal hints; private routes retain independent authorization',async t=>{
 const f=await registryPrecheckFixture({unifiedAuthEnabled:true});t.after(f.close);const user=await f.login(f.other),merchant=await f.login(f.legacy),admin=await f.login(f.admin),qr=f.villas.sea.qr;
 for(const session of [undefined,user,merchant,admin])for(const hint of ['user','merchant','admin']){
  const response=await fetch(f.base+'/api/public/qr/'+qr+'?unlocked=true',{headers:{Origin:f.config.appUrl,'X-VillaCheck-Portal':hint,...(session?{Cookie:session.cookie}:{})}});const view={status:response.status,body:await response.json()};assert.equal(view.status,200);assert.equal(view.body.locked,true);assert(!JSON.stringify(view.body).includes(registeredAccount));assert(!JSON.stringify(view.body).includes(privatePhone));for(const field of ['phone','accountNumber','bankName','accountName'])assert.equal(Object.hasOwn(view.body,field),false);
 }
 const full=(await f.expect('/user/precheck/registry?qr='+qr,undefined,user)).body;assert.equal(full.bank.accountNumber,registeredAccount);assert.equal(full.contact.phone,privatePhone);
 await f.expect('/admin/qr-verification/'+qr,undefined,user,403);await f.expect('/admin/qr-verification/'+qr,undefined,merchant,403);await f.expect('/admin/qr-verification/'+qr,undefined,undefined,401);
 const internal=(await f.expect('/admin/qr-verification/'+qr,undefined,admin)).body;assert.equal(internal.locked,false);assert.equal(internal.accountNumber,registeredAccount);assert.equal(internal.phone,privatePhone);
 assert.equal((await f.db.prepare("SELECT count(*)::int n FROM audits WHERE action='registry.authenticated_disclosure'").get()).n,0);
});
