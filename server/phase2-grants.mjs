import {phase2ProductionTarget} from './phase2-production.mjs';
export const grantEnvironment=db=>db.connectionIdentity?.host?.replace('-pooler.','.')===phase2ProductionTarget.host?'PRODUCTION':'SANDBOX';
export const grantApplies=(grant,villa)=>['SANDBOX','PRODUCTION'].includes(grant.environment)&&grant.userId===villa.owner_id&&(grant.scope==='MERCHANT_ACCOUNT'||grant.villaId===villa.id);
export const grantState=(g,now)=>!g?'NOT_STARTED':now<Date.parse(g.startsAt)?'SCHEDULED':now<Date.parse(g.endsAt)?'ACTIVE':'EXPIRED';
export async function phase2VillaGrants(db,villa){
 return (await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:grant:%'").all()).map(r=>JSON.parse(r.value)).filter(g=>g.environment===grantEnvironment(db)&&grantApplies(g,villa));
}
export async function selectedPhase2GrantRecord(db,villa,now){
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:selection:'+villa.id);
 const grants=await phase2VillaGrants(db,villa);
 if(row){const selection=JSON.parse(row.value);if(selection.userId!==villa.owner_id)return null;return grants.find(g=>g.id===selection.grantId)||null;}
 return grants.filter(g=>grantState(g,now)==='ACTIVE').sort((a,b)=>Date.parse(b.startsAt)-Date.parse(a.startsAt))[0]||grants.sort((a,b)=>Date.parse(b.startsAt)-Date.parse(a.startsAt))[0]||null;
}
export async function selectedPhase2Grant(db,villa,now){const g=await selectedPhase2GrantRecord(db,villa,now);return grantState(g,now)==='ACTIVE'?g:null;}

export async function currentReminderEntitlements(db,now,ownerId){
 const villas=ownerId?await db.prepare('SELECT id,owner_id FROM villas WHERE owner_id=?').all(ownerId):await db.prepare('SELECT id,owner_id FROM villas').all(),current=new Map();
 for(const v of villas){const g=await selectedPhase2GrantRecord(db,v,now);if(g&&g.environment===grantEnvironment(db)&&g.userId===v.owner_id)current.set(g.id,g);}
 return current;
}
