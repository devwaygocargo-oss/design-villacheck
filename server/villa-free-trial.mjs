import {audit} from './database.mjs';
const DAY=86400000;
export const villaTrialKey=id=>'villa_free_trial:'+id;
export const perVillaTrialEnabled=config=>config.phase2Enabled!==true&&(config.productionReleaseMode==='PHASE1_PUBLIC'||config.interactiveDemo===true);
export const pendingVillaTrial=villa=>({version:1,villaId:villa.id,ownerId:villa.owner_id,days:90,packageId:'starter',amount:0,startsAt:null,endsAt:null,startTrigger:'PROPERTY_AND_DOCUMENTS_APPROVED',state:'PENDING_APPROVAL'});
const fail=message=>{throw Object.assign(Error(message),{status:409})};
export async function villaFreeTrial(db,villa,now=Date.now(),context){
 const row=context?.settings?context.settings.get(villaTrialKey(villa.id)):await db.prepare('SELECT value FROM system_settings WHERE key=?').get(villaTrialKey(villa.id));
 if(!row)return null;
 const trial=JSON.parse(row.value);
 if(trial.version!==1||trial.villaId!==villa.id||trial.ownerId!==villa.owner_id||trial.days!==90||trial.packageId!=='starter'||trial.amount!==0)fail('ข้อมูลสิทธิ์ทดลองของที่พักไม่ถูกต้อง');
 if(trial.startsAt===null&&trial.endsAt===null)return {...trial,state:'PENDING_APPROVAL'};
 if(!Number.isFinite(Date.parse(trial.startsAt))||new Date(Date.parse(trial.startsAt)+90*DAY).toISOString()!==trial.endsAt)fail('วันสิทธิ์ทดลองของที่พักไม่ถูกต้อง');
 return {...trial,state:now<Date.parse(trial.startsAt)?'PENDING_APPROVAL':now<Date.parse(trial.endsAt)?'ACTIVE':'EXPIRED'};
}
export async function prepareVillaTrial(db,villa){
 const existing=await villaFreeTrial(db,villa);if(existing)return existing;
 if(villa.payments!==0||villa.expires||villa.qr)fail('ที่พักนี้มีสิทธิ์เดิมแล้ว');
 const trial={version:1,villaId:villa.id,ownerId:villa.owner_id,days:90,packageId:'starter',amount:0,startsAt:null,endsAt:null,startTrigger:'PROPERTY_AND_DOCUMENTS_APPROVED'};
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(villaTrialKey(villa.id),JSON.stringify(trial));
 return {...trial,state:'PENDING_APPROVAL'};
}
// Called only inside the existing authorized Admin review transaction, after
// current cover and KYC checks. A later validation failure rolls this back too.
export async function activateVillaTrial(db,villa,actor,at){
 const trial=await villaFreeTrial(db,villa);if(!trial)return null;
 const sub=await db.prepare('SELECT lifecycle FROM subscriptions WHERE owner_id=?').get(villa.owner_id);
 if(['SUSPENDED','CANCELLED'].includes(sub?.lifecycle))fail('สิทธิ์บัญชีถูกระงับ กรุณาติดต่อผู้ดูแล');
 const kycRow=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('merchant_registration_application:'+villa.owner_id);
 if(kycRow&&JSON.parse(kycRow.value).status!=='approved')fail('กรุณาตรวจเอกสาร KYC ของผู้ประกอบการให้ผ่านก่อนอนุมัติที่พัก');
 if(trial.startsAt)return trial; // Never restart after corrections, repeat approval or expiry.
 if(actor?.role!=='admin'||!Number.isFinite(Date.parse(at)))fail('ต้องได้รับการอนุมัติจากผู้ดูแล');
 const {state,...stored}=trial;void state;
 const active={...stored,startsAt:at,endsAt:new Date(Date.parse(at)+90*DAY).toISOString(),approvedBy:actor.id,approvedDocumentId:villa.document_id};
 await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(active),villaTrialKey(villa.id));
 await db.prepare("UPDATE villas SET package_id='starter',expires=? WHERE id=?").run(active.endsAt,villa.id);
 await audit(db,actor,'villa.free_trial_started',villa.id);
 return {...active,state:'ACTIVE'};
}
