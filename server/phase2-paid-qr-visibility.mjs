import {assertPhase2OrderTerms} from './phase2-finance.mjs';
import {phase2VillaGrants,selectedPhase2GrantRecord,grantState} from './phase2-grants.mjs';
import {requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
// Read-only projection: never rotates QR or mutates history. Latest business rule supersedes old opt-in scope.
export async function paidQrVisibility(db,villa,config){
 if(!villa||config?.phase2Enabled!==true)return {scoped:false,visible:true,reason:'EXISTING_POLICY_RETAINED'};
 requirePhase2(config);requirePhase2Database(db,config);
 const grants=await phase2VillaGrants(db,villa),now=config.phase2Clock?.()??Date.now();
 if(grants.length){const selected=await selectedPhase2GrantRecord(db,villa,now);let valid=true;if(selected?.orderId){try{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:order:'+selected.orderId),o=row&&JSON.parse(row.value);assertPhase2OrderTerms(o);valid=o.status==='succeeded'&&o.grantId===selected.id&&o.userId===villa.owner_id&&o.villaId===villa.id&&o.packageId===selected.packageId&&o.environment===selected.environment;if(selected.source==='COMPANY_APPROVED_ORDER')valid=valid&&o.companyStatus==='APPROVED'&&o.companyDecidedAt===selected.startsAt&&o.companyDecidedBy===selected.approvedBy&&Date.parse(selected.endsAt)-Date.parse(selected.startsAt)===30*86400000;}catch{valid=false;}}const active=valid&&selected&&Number.isFinite(Date.parse(selected.startsAt))&&Number.isFinite(Date.parse(selected.endsAt))&&grantState(selected,now)==='ACTIVE';return {scoped:true,visible:Boolean(active),reason:active?'ENTITLEMENT_ACTIVE':'ENTITLEMENT_INACTIVE'};}
 // Existing real legacy expiry still gates public information; no legacy records are migrated.
 const sub=await db.prepare('SELECT expires,lifecycle FROM subscriptions WHERE owner_id=?').get(villa.owner_id);
 const expiry=sub?.expires||villa.expires;
 if(expiry){const active=Number.isFinite(Date.parse(expiry))&&now<Date.parse(expiry)&&!['SUSPENDED','CANCELLED'].includes(sub?.lifecycle);return {scoped:true,visible:active,reason:active?'LEGACY_ACTIVE':'LEGACY_EXPIRED'};}
 return {scoped:true,visible:false,reason:'NO_CONFIRMED_ENTITLEMENT'};
}
