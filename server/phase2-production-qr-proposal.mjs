import {createHash} from 'node:crypto';
import {phase2ProductionTarget} from './phase2-production.mjs';
import {assertPhase2OrderTerms} from './phase2-finance.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const result=(reason,extra={})=>({eligible:false,enforcement:false,reason,...extra});
const instant=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
export const productionQrMappingVersion='PROPOSED_PHASE2_VERIFIED_PAID_V1';
// Inert proposal only: no caller in publicRevision, no env integration, no connection/writes.
// OFF reads no snapshot; SHADOW classifies immutable server-side evidence, never visibility.
export async function assessProductionPaidQr(snapshot,context={}){
 const mode=context.mode||'OFF';if(!['OFF','SHADOW'].includes(mode))throw Object.assign(Error('Production QR enforcement is not implemented or authorized'),{status:503});
 if(mode==='OFF')return result('OFF');
 const now=context.now??Date.now();if(!Number.isSafeInteger(now)||!Number.isFinite(new Date(now).getTime()))return result('INVALID_REVIEW_CLOCK');
 const originalSnapshot=snapshot;let originalDigest;try{originalDigest=hash(snapshot);snapshot=structuredClone(snapshot)}catch{return result('INVALID_REVIEW_INPUT')}
 const unchanged=()=>{try{return hash(originalSnapshot)===originalDigest}catch{return false}};
 const b=context.binding,t=phase2ProductionTarget;
 if(!b||b.projectId!==t.projectId||b.host?.replace('-pooler.','.')!==t.host||b.database!==t.database||b.schema!=='public'||b.role!==t.role||b.readOnly!==true||b.tlsVerified!==true)return result('UNVERIFIED_PRODUCTION_BINDING');
 if(context.mappingVersion!==productionQrMappingVersion||!context.mappingApprovalReference?.trim())return result('MAPPING_APPROVAL_REQUIRED');
 const {villa,selection,grant,order,markers,grants}=snapshot||{};
 if(!villa?.id||!villa.owner_id)return result('MISSING_VILLA');
 const requiredMarkers=['legacySubscription','merchantFreePeriod','villaTrial','membershipGrant','basicGrant','accountTrial','unknownEntitlement'];
 if(snapshot.inventoryComplete!==true||!markers||requiredMarkers.some(k=>typeof markers[k]!=='boolean')||!Array.isArray(grants)||Array.from(grants).some(g=>!g)||!grants.some(g=>g?.id===grant?.id))return result('INCOMPLETE_ENTITLEMENT_INVENTORY');
 if(markers.legacySubscription||markers.merchantFreePeriod||markers.villaTrial||markers.membershipGrant||markers.basicGrant||markers.accountTrial||markers.unknownEntitlement||grants.some(g=>!g||g.scope!=='VILLA'||g.source!=='VERIFIED_PROVIDER_PAID'||g.environment!=='PRODUCTION'))return result('LEGACY_TRIAL_MIXED_OR_UNKNOWN_PRESERVED');
 if(new Set(grants.map(g=>g.id)).size!==grants.length||grants.some(g=>typeof g.id!=='string'||!g.id||g.villaId!==villa.id||g.userId!==villa.owner_id)||hash(grants.find(g=>g.id===grant?.id))!==hash(grant))return result('INCONSISTENT_GRANT_INVENTORY');
 // VERIFIED_PROVIDER_PAID is a proposed contract. No writer/current Production record is inferred.
 if(!selection||!grant||!order||grant.source!=='VERIFIED_PROVIDER_PAID'||grant.scope!=='VILLA'||grant.environment!=='PRODUCTION'||order.environment!=='PRODUCTION'||order.provider!=='VERIFIED_PRODUCTION_PROVIDER'||order.status!=='succeeded'||!Number.isSafeInteger(order.totalSatang)||order.totalSatang<=0||order.currency!=='THB')return result('NO_VERIFIED_PRODUCTION_PAID_RECORD');
 if(selection.villaId!==villa.id||selection.userId!==villa.owner_id||selection.grantId!==grant.id||selection.orderId!==order.id||grant.orderId!==order.id||grant.villaId!==villa.id||grant.userId!==villa.owner_id||order.grantId!==grant.id||order.villaId!==villa.id||order.userId!==villa.owner_id||grant.packageId!==order.packageId)return result('SELECTION_OWNER_ORDER_GRANT_MISMATCH');
 if(![grant.startsAt,grant.billingStartsAt,grant.endsAt].every(instant)||Date.parse(grant.startsAt)>Date.parse(grant.billingStartsAt)||Date.parse(grant.billingStartsAt)>=Date.parse(grant.endsAt))return result('INVALID_EXPLICIT_PERIOD');
 try{assertPhase2OrderTerms(order)}catch{return result('FINANCE_TERMS_NOT_VERIFIED')}
 if(Date.parse(grant.endsAt)-Date.parse(grant.billingStartsAt)!==order.billingDays*86400000)return result('PERIOD_SNAPSHOT_MISMATCH');
 if(typeof context.verifyStoredSettlement!=='function')return result('TRUSTED_STORED_SETTLEMENT_VERIFIER_REQUIRED');
 const termsDigest=hash({packageId:order.packageId,currency:order.currency,totalSatang:order.totalSatang,financeApprovalReference:order.financeApprovalReference,startsAt:grant.startsAt,billingStartsAt:grant.billingStartsAt,endsAt:grant.endsAt});
 let proof;try{proof=await context.verifyStoredSettlement({orderId:order.id,grantId:grant.id,villaId:villa.id,userId:villa.owner_id,termsDigest})}catch{return result('SETTLEMENT_VERIFICATION_UNAVAILABLE')}
 if(!unchanged())return result('STALE_REVIEW_INPUT');
 if(!proof||proof.environment!=='PRODUCTION'||proof.status!=='succeeded'||typeof proof.receiptId!=='string'||!proof.receiptId.trim()||typeof proof.providerEventId!=='string'||!proof.providerEventId.trim()||!instant(proof.verifiedAt)||Date.parse(proof.verifiedAt)>now||! /^[a-f0-9]{64}$/.test(proof.evidenceDigest||'')||proof.orderId!==order.id||proof.grantId!==grant.id||proof.villaId!==villa.id||proof.userId!==villa.owner_id||proof.currency!=='THB'||proof.currency!==order.currency||proof.amountSatang!==order.totalSatang||proof.termsDigest!==termsDigest)return result('SETTLEMENT_PROVENANCE_MISMATCH');
 if(now<Date.parse(grant.startsAt))return result('SCHEDULED_NOT_ACTIVE');
 const expired=now>=Date.parse(grant.endsAt);
 return {eligible:true,enforcement:false,reason:'SHADOW_VERIFIED_CANDIDATE_ONLY',wouldHidePublicInformation:expired,qrIdentityPreserved:true,mappingVersion:productionQrMappingVersion,evidenceDigest:proof.evidenceDigest};
}
