import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhase2ReviewControls,reviewPaidQrBatch} from '../../server/phase2-release-review.mjs';
import {assessProductionPaidQr} from '../../server/phase2-production-qr-proposal.mjs';
import {vector} from './production-qr-vector.mjs';
function setup(){const {snapshot,context}=vector(),controls=createPhase2ReviewControls();controls.shadow({approvalReference:'SYNTHETIC_REVIEW_NOT_APPROVAL'});return {snapshot,context:{...context,controls,receiptInventoryComplete:true,priorSettlements:[]}};}
function second(s){const copy=structuredClone(s);for(const obj of new Set([copy.villa,copy.selection,copy.grant,copy.order,...copy.grants]))for(const k of Object.keys(obj))if(typeof obj[k]==='string'&&obj[k].startsWith('SYNTHETIC_'))obj[k]+='_SECOND';return copy;}
test('Missing receipt or grant inventory entries cannot be treated as complete evidence',async()=>{
 for(const missing of ['hole',undefined,null]){
  const {snapshot,context}=setup();let calls=0;
  const verifyStoredSettlement=async req=>{calls++;return context.verifyStoredSettlement(req);};
  const priorSettlements=new Array(1);if(missing!=='hole')priorSettlements[0]=missing;
  const prior=await reviewPaidQrBatch([snapshot],{...context,priorSettlements,verifyStoredSettlement});
  assert.deepEqual(prior.rows,[]);assert.equal(prior.counts.INVALID_RECEIPT_INVENTORY,1);assert.equal(calls,0);
  snapshot.grants.length=2;if(missing!=='hole')snapshot.grants[1]=missing;
  const grants=await reviewPaidQrBatch([snapshot],{...context,verifyStoredSettlement});
  assert.equal(grants.rows[0].eligible,false);assert.equal(grants.rows[0].reason,'INCOMPLETE_ENTITLEMENT_INVENTORY');assert.equal(calls,0);
 }
});
test('Review controls default OFF, are isolated, and never offer enforcement',async()=>{const controls=createPhase2ReviewControls();assert(Object.isFrozen(controls));const trap=new Proxy([],{get(){throw Error('OFF must not read')}});assert.deepEqual(await reviewPaidQrBatch(trap,{controls}),{mode:'OFF',enforcement:false,rows:[],counts:{}});assert.throws(()=>controls.shadow());controls.shadow({approvalReference:'SYNTHETIC_INTERNAL_APPROVAL'});assert.equal(controls.read().enforcement,false);assert.equal(createPhase2ReviewControls().read().mode,'OFF');controls.rollback();assert.equal(controls.read().mode,'OFF');await assert.rejects(()=>reviewPaidQrBatch([],{controls:{read:()=>({mode:'ACTIVE'})}}));});
test('Batch review requires complete valid internal receipt inventory',async()=>{const {snapshot,context}=setup();for(const patch of [{receiptInventoryComplete:false},{priorSettlements:null},{verifyStoredSettlement:null},{priorSettlements:[{}]}]){const r=await reviewPaidQrBatch([snapshot],{...context,...patch});assert.deepEqual(r.rows,[]);assert.equal(r.enforcement,false);}});
test('Distinct synthetic settlements yield only non-enforcing ordinal summaries',async()=>{const {snapshot,context}=setup(),snapshots=[snapshot,second(snapshot)],before=JSON.stringify(snapshots);const verifyStoredSettlement=async r=>({...await context.verifyStoredSettlement(r),receiptId:'PRIVATE_RECEIPT_'+r.orderId,providerEventId:'PRIVATE_EVENT_'+r.orderId});const result=await reviewPaidQrBatch(snapshots,{...context,verifyStoredSettlement});assert(result.rows.every(r=>r.eligible&&r.enforcement===false));assert.deepEqual(result.rows.map(r=>r.reference),[1,2]);assert.equal(JSON.stringify(snapshots),before);for(const value of ['SYNTHETIC_','PRIVATE_','receiptId','providerEventId','evidenceDigest','userId'])assert(!JSON.stringify(result).includes(value));});
test('Duplicate receipt or event excludes every conflicting candidate without deleting inputs',async()=>{for(const field of ['receiptId','providerEventId']){const {snapshot,context}=setup();const snapshots=[snapshot,second(snapshot)],before=JSON.stringify(snapshots);const verifyStoredSettlement=async r=>({...await context.verifyStoredSettlement(r),receiptId:r.orderId+'receipt',providerEventId:r.orderId+'event',[field]:'REPLAYED_PRIVATE_IDENTIFIER'});const r=await reviewPaidQrBatch(snapshots,{...context,verifyStoredSettlement});assert.equal(r.counts.DUPLICATE_OR_REPLAYED_SETTLEMENT,2);assert(r.rows.every(r=>!r.eligible));assert.equal(JSON.stringify(snapshots),before);}});
test('Previously claimed receipt/event and identical repeated grant are replay exclusions',async()=>{const {snapshot,context}=setup();const proof=await context.verifyStoredSettlement({orderId:'PREVIOUS_ORDER',grantId:'PREVIOUS_GRANT',villaId:'PREVIOUS_VILLA',userId:'PREVIOUS_OWNER'});for(const field of ['receiptId','providerEventId']){const prior={...proof,receiptId:'OTHER_RECEIPT',providerEventId:'OTHER_EVENT',[field]:proof[field]};const r=await reviewPaidQrBatch([snapshot],{...context,priorSettlements:[prior]});assert.equal(r.rows[0].reason,'DUPLICATE_OR_REPLAYED_SETTLEMENT');}const r=await reviewPaidQrBatch([snapshot,snapshot],context);assert.equal(r.counts.DUPLICATE_OR_REPLAYED_SETTLEMENT,2);});
test('Replay checks also prevent shared order/grant with distinct receipt identifiers',async()=>{const {snapshot,context}=setup();let call=0;const verifyStoredSettlement=async r=>({...await context.verifyStoredSettlement(r),receiptId:'RECEIPT_'+(++call),providerEventId:'EVENT_'+call});const r=await reviewPaidQrBatch([snapshot,snapshot],{...context,verifyStoredSettlement});assert.equal(r.counts.DUPLICATE_OR_REPLAYED_SETTLEMENT,2);});
test('Malformed identifiers, changed selected grants and duplicate inventory grants fail closed',async()=>{const {snapshot,context}=setup();const r=await reviewPaidQrBatch([snapshot],{...context,verifyStoredSettlement:async q=>({...await context.verifyStoredSettlement(q),receiptId:' PADDED '})});assert.equal(r.rows[0].reason,'INVALID_SETTLEMENT_IDENTIFIERS');for(const mutate of [s=>s.grants.push(structuredClone(s.grant)),s=>s.grants[0]={...s.grant,userId:'OTHER_OWNER'}]){const f=vector();mutate(f.snapshot);assert.equal((await assessProductionPaidQr(f.snapshot,f.context)).reason,'INCONSISTENT_GRANT_INVENTORY');}});
test('Legacy/trial/mixed and cross-owner inputs remain excluded in batch',async()=>{for(const mutate of [s=>s.markers.legacySubscription=true,s=>s.markers.villaTrial=true,s=>s.markers.basicGrant=true,s=>s.selection.userId='OTHER_OWNER']){const {snapshot,context}=setup();mutate(snapshot);const r=await reviewPaidQrBatch([snapshot],context);assert.equal(r.rows[0].eligible,false);assert.equal(r.enforcement,false);}});
test('Mid-review rollback invalidates all computed results and leaves records untouched',async()=>{const {snapshot,context}=setup(),before=JSON.stringify(snapshot);const r=await reviewPaidQrBatch([snapshot],{...context,verifyStoredSettlement:async req=>{context.controls.rollback();return context.verifyStoredSettlement(req);}});assert.equal(r.mode,'OFF');assert.deepEqual(r.rows,[]);assert.equal(r.counts.REVIEW_INVALIDATED,1);assert.equal(JSON.stringify(snapshot),before);});
test('Changed source or prior inventory invalidates the entire batch',async()=>{for(const target of ['snapshot','prior']){const {snapshot,context}=setup();const r=await reviewPaidQrBatch([snapshot],{...context,verifyStoredSettlement:async req=>{const p=await context.verifyStoredSettlement(req);if(target==='snapshot')snapshot.markers.basicGrant=true;else context.priorSettlements.push({receiptId:'NEW_PRIVATE_RECORD'});return p;}});assert.deepEqual(r.rows,[]);assert.equal(r.counts.STALE_REVIEW_INPUT,1);}});

test('Previously claimed order/grant cannot gain a fresh receipt to bypass replay exclusion',async()=>{for(const field of ['orderId','grantId']){const {snapshot,context}=setup();const prior={receiptId:'OLDER_RECEIPT',providerEventId:'OLDER_EVENT',orderId:'OLDER_ORDER',grantId:'OLDER_GRANT',villaId:'OLDER_VILLA',userId:'OLDER_OWNER',[field]:field==='orderId'?snapshot.order.id:snapshot.grant.id};const r=await reviewPaidQrBatch([snapshot],{...context,priorSettlements:[prior]});assert.equal(r.rows[0].reason,'DUPLICATE_OR_REPLAYED_SETTLEMENT');}});

test('Foreign owner or Villa grants invalidate an allegedly complete per-Villa inventory',async()=>{for(const field of ['villaId','userId']){const {snapshot,context}=setup();snapshot.grants.push({...snapshot.grant,id:'FOREIGN_GRANT',[field]:'FOREIGN_SCOPE'});const r=await reviewPaidQrBatch([snapshot],context);assert.equal(r.rows[0].reason,'INCONSISTENT_GRANT_INVENTORY');assert.equal(r.rows[0].eligible,false);}});

test('OFF stops further settlement verification in the same batch, even after SHADOW resumes',async()=>{
 for(const resume of [false,true]){
  const {snapshot,context}=setup();let calls=0;
  const r=await reviewPaidQrBatch([snapshot,second(snapshot)],{...context,verifyStoredSettlement:async req=>{
   calls++;const proof=await context.verifyStoredSettlement(req);context.controls.rollback();
   if(resume)context.controls.shadow({approvalReference:'SYNTHETIC_NEW_REVIEW'});
   return proof;
  }});
  assert.equal(calls,1,'No further verifier may start after the original review was stopped');
  assert.equal(r.counts.REVIEW_INVALIDATED,1);assert.deepEqual(r.rows,[]);assert.equal(r.enforcement,false);
 }
});
