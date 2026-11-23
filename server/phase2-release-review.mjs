// Internal design/test utility only. No runtime wiring, persistence, network or enforcement.
import {assessProductionPaidQr} from './phase2-production-qr-proposal.mjs';
const denied=reason=>({eligible:false,enforcement:false,reason});
const identifier=v=>typeof v==='string'&&v.length>0&&v.length<=256&&v.trim()===v;
const linkage=['orderId','grantId','villaId','userId'];
const proofKeys=['receiptId','providerEventId',...linkage];

export function createPhase2ReviewControls(){
 let generation=0,mode='OFF';
 return Object.freeze({
  read:()=>Object.freeze({mode,generation,enforcement:false}),
  shadow:({approvalReference}={})=>{
   if(!identifier(approvalReference))throw new Error('Recorded internal review approval required');
   mode='SHADOW';generation++;return Object.freeze({mode,generation,enforcement:false});
  },
  rollback:()=>{mode='OFF';generation++;return Object.freeze({mode,generation,enforcement:false});},
 });
}

export async function reviewPaidQrBatch(snapshots,context={}){
 const control=context.controls?.read()??{mode:'OFF',generation:0};
 if(control.mode==='OFF')return {mode:'OFF',enforcement:false,rows:[],counts:{}};
 if(control.mode!=='SHADOW')throw new Error('Enforcement is not implemented');
 if(context.receiptInventoryComplete!==true||!Array.isArray(context.priorSettlements)||typeof context.verifyStoredSettlement!=='function')return {mode:'SHADOW',enforcement:false,rows:[],counts:{INCOMPLETE_RECEIPT_INVENTORY:1}};
 let frozen,prior,before;
 try{before=JSON.stringify(snapshots);frozen=structuredClone(snapshots);prior=structuredClone(context.priorSettlements)}catch{return {mode:'SHADOW',enforcement:false,rows:[],counts:{INVALID_REVIEW_INPUT:1}};}
 if(!Array.isArray(frozen)||Array.from(prior).some(p=>!p||proofKeys.some(k=>!identifier(p[k]))))return {mode:'SHADOW',enforcement:false,rows:[],counts:{INVALID_RECEIPT_INVENTORY:1}};
 const claims=[],rows=[],now=context.now??Date.now();
 const invalidated=()=>{const current=context.controls.read();return current.generation!==control.generation||current.mode!=='SHADOW';};
 const stopped=()=>({mode:'OFF',enforcement:false,rows:[],counts:{REVIEW_INVALIDATED:1}});
 for(const [index,snapshot] of frozen.entries()){
  if(invalidated())return stopped();
  let proof;
  const assessment=await assessProductionPaidQr(snapshot,{...context,now,mode:'SHADOW',verifyStoredSettlement:async request=>{proof=structuredClone(await context.verifyStoredSettlement(Object.freeze({...request})));return proof;}});
  if(invalidated())return stopped();
  rows.push({reference:index+1,eligible:assessment.eligible,enforcement:false,reason:assessment.reason,...(assessment.eligible?{wouldHidePublicInformation:assessment.wouldHidePublicInformation}: {})});
  if(assessment.eligible){if(proofKeys.some(k=>!identifier(proof?.[k])))rows[index]= {reference:index+1,...denied('INVALID_SETTLEMENT_IDENTIFIERS')};else claims.push({index,proof});}
 }
 // Every colliding claim is excluded; no first-writer wins and no automatic allocation.
 for(const {index,proof} of claims){
  const collision=prior.some(p=>p.receiptId===proof.receiptId||p.providerEventId===proof.providerEventId||p.orderId===proof.orderId||p.grantId===proof.grantId)||claims.some(c=>c.index!==index&&(c.proof.receiptId===proof.receiptId||c.proof.providerEventId===proof.providerEventId||c.proof.orderId===proof.orderId||c.proof.grantId===proof.grantId));
  if(collision)rows[index]={reference:index+1,...denied('DUPLICATE_OR_REPLAYED_SETTLEMENT')};
 }
 if(invalidated())return stopped();
 let stable=false;try{stable=JSON.stringify(snapshots)===before&&JSON.stringify(context.priorSettlements)===JSON.stringify(prior)}catch{}
 if(!stable)return {mode:'SHADOW',enforcement:false,rows:[],counts:{STALE_REVIEW_INPUT:1}};
 return {mode:'SHADOW',enforcement:false,rows,counts:rows.reduce((counts,r)=>(counts[r.reason]=(counts[r.reason]||0)+1,counts),{})};
}
