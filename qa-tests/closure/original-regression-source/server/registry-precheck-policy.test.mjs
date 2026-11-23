import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {pathToFileURL} from 'node:url';import {registryPrecheckRoute,assertRegistryPrecheckRole} from './registry-precheck.mjs';
const manifest=process.env.VILLACHECK_SECURITY_SOURCE_MANIFEST?JSON.parse(fs.readFileSync(process.env.VILLACHECK_SECURITY_SOURCE_MANIFEST)):null;
test('registry routes are exact and role separated; other business operations and Phase 1 remain unchanged',async()=>{
 const runtime=await import(manifest?pathToFileURL(manifest.artifact+'/server/production-runtime.mjs'):new URL('./production-runtime.mjs',import.meta.url));
 const routes=[['GET','/api/user/precheck/search'],['GET','/api/user/precheck/registry'],['POST','/api/user/precheck/compare'],['GET','/api/admin/registry-bank-verification'],['POST','/api/admin/registry-bank-verification']];
 for(const [method,path]of routes){assert(registryPrecheckRoute(method,path));for(const mode of ['PRELAUNCH','MEMBER_PREVIEW'])assert(runtime.productionRequestAllowed(method,path,mode),path)}
 assert.equal(registryPrecheckRoute('POST','/api/user/precheck/registry'),false);assert.equal(registryPrecheckRoute('GET','/api/user/precheck/search/all'),false);assert.equal(registryPrecheckRoute('DELETE','/api/admin/registry-bank-verification'),false);assert.equal(runtime.productionRequestAllowed('POST','/api/admin/packages','MEMBER_PREVIEW'),false);assert.equal(runtime.productionRequestAllowed('POST','/api/user/precheck/compare','PHASE1'),false)
 assert.throws(()=>assertRegistryPrecheckRole({role:'merchant'},'/api/user/precheck/registry'),e=>e.status===403);assert.throws(()=>assertRegistryPrecheckRole({role:'user'},'/api/admin/registry-bank-verification'),e=>e.status===403)
 if((manifest?.environment==='staging'||manifest?.projectId==='prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC')){const policy=await import(pathToFileURL(manifest.artifact+'/server/staging-interactive-policy.mjs'));for(const [method,path]of routes)assert(policy.requestAllowed(method,path),path)}
})
test('Staging interactive guard permits only linked bank evidence with scoped Admin/User actors', {skip:!(manifest?.environment==='staging'||manifest?.projectId==='prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC')}, async()=>{
 const {registryPrecheckFixture}=await import('../scripts/registry-precheck-fixture.mjs'),{scope}=await import(pathToFileURL(manifest.artifact+'/server/staging-interactive-policy.mjs')),f=await registryPrecheckFixture({interactiveDemo:true,productionReleaseMode:null});
 try{
  for(const [local,actor]of [[f.admin,scope.admin],[f.other,scope.users[0]]]){await f.db.prepare('INSERT INTO users(id,email,name,password_hash,role) SELECT ?,?,name,password_hash,role FROM users WHERE id=?').run(actor.id,actor.email,local.id);local.id=actor.id;local.email=actor.email}
  const admin=await f.login(f.admin),user=await f.login(f.other),path='/admin/registry-bank-verification',file={name:'synthetic-scoped-bank.pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4 Synthetic scoped bank confirmation only').toString('base64')};
  let row=(await f.expect(path,{villaId:f.villas.sea.id,revision:0,action:'upload',evidenceType:'BANK_CONFIRMATION',file},admin)).body;
  assert([403,404].includes((await f.request(row.record.evidenceUrl.replace('/api',''),undefined,user)).status));await f.expect(row.record.evidenceUrl.replace('/api',''),undefined,admin);
  row=(await f.expect(path,{villaId:f.villas.sea.id,revision:row.revision,action:'accept',accountNumberMatched:true,accountHolderMatched:true,bankMatched:true},admin)).body;assert.equal(row.verification.status,'VERIFIED');assert.equal((await f.expect('/user/precheck/registry?qr='+f.villas.sea.qr,undefined,user)).body.verification.status,'VERIFIED')
 }finally{await f.close()}
})
