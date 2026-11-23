import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,approvedTestBilling} from './fixture.mjs';
import {exclusiveSatang,inclusiveSatang} from '../../server/phase2-finance.mjs';
import {gameResponsesEnabled,gameResponsePolicy,simulateCompanyApprovalPeriod} from '../../server/phase2-game-responses.mjs';
import {phase2Capabilities} from '../../server/phase2-policy.mjs';
import {settlePhase2Sandbox} from '../../server/phase2.mjs';
import {createPhase2Omise,OmisePhase2Proof} from '../../server/phase2-omise.mjs';

test('VAT-exclusive arithmetic requires explicit Finance inputs; all four bases and ties reconcile safely',()=>{
 for(const net of [99000,199000,299000,499000]){const q=exclusiveSatang(net,700,'HALF_UP');assert.equal(q.netSatang,net);assert.equal(q.vatSatang,net*7/100);assert.equal(q.totalSatang,q.netSatang+q.vatSatang);}
 assert.equal(exclusiveSatang(1,5000,'HALF_UP').vatSatang,1);assert.equal(exclusiveSatang(1,5000,'HALF_EVEN').vatSatang,0);assert.equal(exclusiveSatang(3,5000,'HALF_EVEN').vatSatang,2);assert.equal(exclusiveSatang(3,5000,'DOWN').vatSatang,1);
 for(const args of [[99000,null,'HALF_UP'],[99000,700,null],[-1,700,'DOWN'],[Number.MAX_SAFE_INTEGER,10000,'HALF_UP']])assert.throws(()=>exclusiveSatang(...args));
 assert.deepEqual(inclusiveSatang(10700,700,'HALF_UP'),{totalSatang:10700,vatSatang:700,netSatang:10000});
});
test('Company approval period simulation is exactly 30 elapsed days and never a grant or trial mutation',()=>{
 for(const [start,end]of [['2028-01-31T03:00:00.000Z','2028-03-01T03:00:00.000Z'],['2026-12-15T03:00:00.000Z','2027-01-14T03:00:00.000Z']])assert.deepEqual(simulateCompanyApprovalPeriod(start),{startsAt:start,endsAt:end,days:30,simulationOnly:true,enforcement:false});
 for(const x of [null,'','2026-11-18','not a date'])assert.throws(()=>simulateCompanyApprovalPeriod(x));
});
test('Response projection keeps existing image/video capabilities and does not mutate stored policy',()=>{
 const stored={...approvedTestBilling,premiumChannels:['instagram'],higherTierMedia:false,publicPromotions:true,homeSlots:3},before=structuredClone(stored),p=gameResponsePolicy(stored);
 assert.deepEqual(stored,before);assert.equal(p.vatMode,'EXCLUSIVE');assert.equal(p.billingDays,30);assert.deepEqual(p.premiumChannels,['facebook']);assert.equal(p.publicPromotions,false);assert.equal(p.financeApprovalReference,null);assert.equal(p.vatBasisPoints,null);
 for(const plan of ['basic','starter','pro','premium'])assert.deepEqual(phase2Capabilities(plan,p),phase2Capabilities(plan,stored));
});
test('Local response acceptance preserves historical orders, trial, QR, media and denies financial/Banner activation',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);const trial=await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin);const {order}=await f.buy(f.villas[3],'premium');await f.settle(order);
 const state=async()=>({settings:await f.db.prepare('SELECT key,value FROM system_settings ORDER BY key').all(),villas:await f.db.prepare('SELECT * FROM villas ORDER BY id').all(),documents:await f.db.prepare('SELECT * FROM documents ORDER BY id').all()});
 const before=await state();f.config.phase2GameResponses=true;
 const c=await f.expect('/phase2/catalog',undefined,f.sessions.merchant);assert(c.packages.every(p=>p.vatMode==='EXCLUSIVE'&&p.billingDays===30));assert.equal(c.businessResponses.prinApproval,false);assert.equal(c.businessResponses.financeSignOff,false);assert.equal(c.financialActionsEnabled,false);assert.equal(c.businessResponses.renewal,'MANUAL');
 for(const [path,data,session]of [['orders',{villaId:f.villas[3].id,packageId:'premium',requestKey:randomUUID()},f.sessions.merchant],['payment',{orderId:order.id,action:'checkout'},f.sessions.merchant],['sandbox',{orderId:order.id,status:'succeeded'},f.sessions.admin],['policy',{policy:approvedTestBilling,reason:'SYNTHETIC'},f.sessions.admin],['promotions',{},f.sessions.admin],['notices',{action:'deliver'},f.sessions.admin]])await f.expect('/phase2/'+path,data,session,503);
 await assert.rejects(settlePhase2Sandbox(f.db,null,f.config,{}),e=>e.status===503);
 const publicData=await f.expect('/phase2/public?villaId='+f.villas[3].id);assert.deepEqual(publicData.promotions,[]);
 const detail=await f.expect('/phase2/orders?orderId='+order.id,undefined,f.sessions.merchant);assert.equal(detail.order.vatMode,'INCLUSIVE');assert.equal(detail.grant.endsAt,JSON.parse(before.settings.find(r=>r.key==='phase2:v1:grant:'+detail.grant.id).value).endsAt);
 assert.equal((await f.expect('/phase2/workspace',undefined,f.sessions.merchant)).grants.find(g=>g.id===trial.trial.id).endsAt,trial.trial.endsAt);
 assert.deepEqual(await state(),before);
});
test('Premium package Social permits Facebook only and retains one image and one video quota',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy({...approvedTestBilling,premiumChannels:['instagram','tiktok']});const {order}=await f.buy(f.villas[3],'premium');await f.settle(order);f.config.phase2GameResponses=true;
 const base={villaId:f.villas[3].id,source:'PACKAGE',month:new Date(f.now()).toISOString().slice(0,7),status:'scheduled'};
 for(const channel of ['instagram','tiktok'])await f.expect('/phase2/social',{...base,kind:'image',channel},f.sessions.admin,409);
 for(const kind of ['image','video']){assert.equal((await f.expect('/phase2/social',{...base,kind,channel:'facebook'},f.sessions.admin)).externalPostsCreated,0);await f.expect('/phase2/social',{...base,kind,channel:'facebook'},f.sessions.admin,409);}
 await f.expect('/phase2/social',{...base,kind:'image',channel:'facebook'},f.sessions.merchant,403);
});
test('Response candidate rejects nonlocal/Production/missing synthetic markers and provider calls',async t=>{
 const f=await fixture({phase2GameResponses:true});t.after(f.close);
 for(const patch of [{productionRuntime:true},{phase2ProductionCoreOnly:true},{appEnvironment:'phase2-preview'}])await assert.rejects(gameResponsesEnabled(f.db,{...f.config,...patch}),e=>e.status===503);
 const db={connectionIdentity:{host:'remote.invalid'}};await assert.rejects(gameResponsesEnabled(db,f.config),e=>e.status===503);
 await f.db.prepare("DELETE FROM system_settings WHERE key='phase2:synthetic-runtime'").run();await assert.rejects(gameResponsesEnabled(f.db,f.config),e=>e.status===503);
 let calls=0;const provider=createPhase2Omise(f.db,{...f.config,phase2SandboxGateway:new OmisePhase2Proof()},{retrieveCharge:async()=>{calls++;throw Error('No provider request allowed');}});
 await assert.rejects(provider.webhook({}),e=>e.status===503);assert.equal(calls,0);
});
