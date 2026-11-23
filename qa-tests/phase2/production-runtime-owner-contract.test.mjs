import test from 'node:test';
import assert from 'node:assert/strict';
import {productionRuntimePolicy,productionRequestAllowed} from '../../server/production-runtime.mjs';
import {phase2ProductionTarget as target,productionOwnerApproval,productionOperationsApproval,productionOwnerGrantsApproval} from '../../server/phase2-production.mjs';
import {requirePhase2} from '../../server/phase2-policy.mjs';
const env=()=>({NODE_ENV:'production',APP_ENV:'production',VERCEL_ENV:'production',VERCEL_PROJECT_ID:target.projectId,APP_URL:'https://www.villacheckth.com',DATABASE_URL:`postgresql://${target.role}:synthetic-not-real@${target.host}/${target.database}?sslmode=require`,PRODUCTION_RELEASE_MODE:'PRODUCTION',BUSINESS_INITIALIZATION_MODE:'EXISTING_CATALOG',PAYMENT_ACCESS_MODE:'DISABLED',OMISE_TEST_ENABLED:'false',DEMO_MODE:'false',SEED_DEMO_ACCOUNTS:'false',SEED_PUBLIC_DEMO_DATA:'false',COOKIE_SECURE:'true',OTP_SECRET:'synthetic-runtime-test-only-'.repeat(2),PHASE2_ENABLED:'true',PHASE2_SANDBOX_ENABLED:'false',PHASE2_EMAIL_ENABLED:'false',PHASE2_OWNER_QA_READ_ENABLED:'false',PHASE2_OWNER_CAPABILITY_CANDIDATE_ENABLED:'true',PHASE2_PRODUCTION_RELEASE_APPROVAL:productionOwnerApproval,PHASE2_PRODUCTION_OWNER_APPROVAL:productionOwnerApproval,PHASE2_OWNER_CAPABILITY_APPROVAL_REFERENCE:productionOwnerApproval,PHASE2_PRODUCTION_OPERATIONS_APPROVAL:productionOperationsApproval,PHASE2_PRODUCTION_OWNER_GRANTS_APPROVAL:productionOwnerGrantsApproval});
test('actual PRODUCTION mode carries target-bound Phase2 contract through outer API and inner authorization gates',()=>{
 const p=productionRuntimePolicy(env());assert.equal(p.releaseMode,'PRODUCTION');assert.equal(p.phase2ProductionCoreOnly,true);assert.equal(p.phase2ProductionOwnerMode,true);assert.equal(p.phase2ProductionOwnerGrantsApproved,true);assert.deepEqual(Object.keys(p.phase2ProductionOwnerAccounts).sort(),['dew','game','prin']);
 requirePhase2({...p,appEnvironment:'production',productionRuntime:true,phase2SandboxEnabled:false});
 for(const [m,path] of [['GET','/api/phase2/catalog'],['GET','/api/phase2/owner-workspace'],['POST','/api/phase2/owner-session'],['POST','/api/phase2/policy']])assert.equal(productionRequestAllowed(m,path,p.releaseMode,p),true);
 for(const path of ['/api/phase2/orders','/api/phase2/payment','/api/phase2/sandbox','/api/phase2/company-decisions'])assert.equal(productionRequestAllowed('POST',path,p.releaseMode,p),false);
});
test('PRODUCTION mode fails closed for wrong targets, missing approval and payment or sandbox activation',()=>{
 for(const delta of [{VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'wrong-project'},{DATABASE_URL:'postgresql://u:synthetic@localhost/wrong?sslmode=require'},{PHASE2_PRODUCTION_OWNER_APPROVAL:''},{PHASE2_OWNER_CAPABILITY_APPROVAL_REFERENCE:''},{PAYMENT_ACCESS_MODE:'MANUAL'},{PHASE2_SANDBOX_ENABLED:'true'},{PHASE2_EMAIL_ENABLED:'true'},{PHASE2_OWNER_QA_READ_ENABLED:'true'},{PHASE2_OMISE_TEST_SECRET_KEY:'skey_test_synthetic'}])assert.throws(()=>productionRuntimePolicy({...env(),...delta}));
});
test('disabling Phase2 keeps its routes closed; separate B approval and operations gates remain effective',()=>{
 const off=productionRuntimePolicy({...env(),PHASE2_ENABLED:'false'});assert.notEqual(off.phase2ProductionCoreOnly,true);assert.equal(productionRequestAllowed('GET','/api/phase2/catalog',off.releaseMode,off),false);
 const noB=productionRuntimePolicy({...env(),PHASE2_PRODUCTION_OWNER_GRANTS_APPROVAL:''});assert.equal(noB.phase2ProductionOwnerGrantsApproved,false);
 const noOps=productionRuntimePolicy({...env(),PHASE2_PRODUCTION_OPERATIONS_APPROVAL:''});assert.equal(noOps.phase2ProductionOperationalManagement,false);assert.equal(productionRequestAllowed('POST','/api/phase2/policy',noOps.releaseMode,noOps),false);
});
