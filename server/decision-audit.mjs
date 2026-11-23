import {randomUUID} from 'node:crypto';
import {audit} from './database.mjs';
import {hasAdminAccess} from './admin-access.mjs';
import {permissionContext,requireBusinessPermission} from './business-permissions.mjs';
export async function decisionAudit(db,actor,{kind,targetId,outcome,reason='',resourceType=kind,previousStatus,newStatus,action,providerEvent=null}){
 if(!['PAYMENT','KYC'].includes(kind)||!['APPROVED','REJECTED','CHANGES'].includes(outcome))throw Error('Invalid decision audit');
 if(typeof previousStatus!=='string'||!previousStatus||typeof newStatus!=='string'||!newStatus||typeof action!=='string'||!action)throw Error('Explicit previous/new decision status and action required');
 const c=permissionContext(actor),permission=kind==='PAYMENT'?'payments.review':'kyc.review';
 const authority=actor?await requireBusinessPermission(db,actor,c?.config||{},permission):null;
 if(!actor&&(!providerEvent?.eventId||providerEvent.provider!=='OMISE_TEST'))throw Error('Verified provider attribution required');
 const record={version:2,id:randomUUID(),kind,resourceType,targetId,actorId:actor?.id||null,actorType:actor?'USER':'PROVIDER',effectiveRole:actor?(authority.owner?'BUSINESS_OWNER':'ADMIN'):'VERIFIED_PROVIDER',effectivePermission:actor?permission:'provider.payment.verify',primaryRole:actor?(actor.primaryRole||actor.role):null,action,previousStatus,newStatus,at:new Date().toISOString(),outcome,result:outcome,reason:String(reason).slice(0,2000),requestId:c?.requestId||providerEvent?.eventId||randomUUID(),...(providerEvent?{providerEvent}:{})};
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('decision_audit:'+record.id,JSON.stringify(record));
 if(actor)await audit(db,actor,kind.toLowerCase()+'.decision.'+outcome.toLowerCase(),targetId);return record;
}
// A completed authorized review stays attributable without converting its Owner reviewer to Admin.
export async function approvedReviewAuthority(db,reviewer,targetId,reviewedAt,resourceType){
 if(!reviewer)return false;if(await hasAdminAccess(db,reviewer))return true;
 const time=Date.parse(reviewedAt);if(!Number.isFinite(time))return false;
 const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'decision_audit:%' AND value::jsonb->>'actorId'=? AND value::jsonb->>'targetId'=? AND value::jsonb->>'resourceType'=? AND value::jsonb->>'outcome'='APPROVED'").all(reviewer.id,targetId,resourceType);
 return rows.some(r=>{const at=Date.parse(JSON.parse(r.value).at);return at>=time&&at-time<60000;});
}
