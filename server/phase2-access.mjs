import {paidQrVisibility} from './phase2-paid-qr-visibility.mjs';
import {createHash} from 'node:crypto';
import {phase2VillaGrants,selectedPhase2GrantRecord,grantState} from './phase2-grants.mjs';
import {requirePhase2,requirePhase2Database,phase2Defaults} from './phase2-policy.mjs';
const DAY=86400000;
export async function phase2VillaAccess(db,villa,config,now=config?.phase2Clock?.()??Date.now()){
 if(!config?.phase2Enabled)return null;requirePhase2(config);requirePhase2Database(db,config);
 const grants=await phase2VillaGrants(db,villa),grant=await selectedPhase2GrantRecord(db,villa,now);
 if(!grants.length)return null;
 const state=grantState(grant,now),expiresAt=grant?.endsAt||null;
 let reminder=null;if(grant&&expiresAt){const policyRow=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:policy');const p={...phase2Defaults,...(policyRow?JSON.parse(policyRow.value):{})};if(p.remindersEnabled&&p.noticeChannels?.includes('IN_APP')){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:notice:'+grant.id+':'+createHash('sha256').update(JSON.stringify(expiresAt)).digest('hex')+':7');const n=row?JSON.parse(row.value):null;if(n?.offsetDays===7&&n.status!=='CANCELLED'&&Date.parse(n.createdAt)<=Date.parse(n.scheduledFor))reminder={id:n.id,scheduledFor:n.scheduledFor,expiresAt,available:state==='ACTIVE'&&Date.parse(n.scheduledFor)<=now};}}

 const qrVisibility=await paidQrVisibility(db,villa,config);
 return {...(qrVisibility.scoped?{paidQrExpiryScoped:true,publicQrVisible:qrVisibility.visible}:{}),reminder,managed:true,grantId:grant?.id||null,packageId:grant?.packageId||null,state,expiresAt,serverNow:new Date(now).toISOString(),remainingDays:expiresAt?Math.max(0,Math.ceil((Date.parse(expiresAt)-now)/DAY)):null,canEdit:state!=='EXPIRED',qrRetainedAfterExpiry:true};
}
export async function assertPhase2VillaEditing(db,actor,villa,config){
 if(!config?.phase2Enabled||actor?.role==='admin'||actor?.admin)return;
 if(!villa||villa.owner_id!==actor?.id)throw Object.assign(Error('ไม่พบที่พัก'),{status:404});
 const access=await phase2VillaAccess(db,villa,config);
 if(access?.state==='EXPIRED')throw Object.assign(Error('แพ็กเกจหมดอายุ ไม่สามารถแก้ไขที่พักได้ กรุณาต่ออายุ / Subscription expired; property editing disabled'),{status:403,code:'PHASE2_SUBSCRIPTION_EXPIRED'});
}
// Public continuity never changes internal entitlement/verification status.
export async function phase2PublicContinuity(db,villa,config){
 if(!config?.phase2Enabled||config.publicPublicationDisabled||villa.status!=='approved'||!villa.qr)return false;
 const access=await phase2VillaAccess(db,villa,config);if(!access||access.state!=='ACTIVE'||access.publicQrVisible===false)return false;
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+villa.id);let s;try{s=row&&JSON.parse(row.value)}catch{return false}
 return s?.villa?.id===villa.id&&s.villa.owner_id===villa.owner_id&&s.villa.status==='approved'&&Array.isArray(s.media);
}

export const isPublicQrActive=trust=>(trust.publicQrStatus||trust.qrStatus)==='ACTIVE';
