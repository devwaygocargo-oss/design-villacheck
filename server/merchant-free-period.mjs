// Enrolled only by verified NEW-account creation. No backfill or billing worker.
import {addMonths,audit} from './database.mjs';
export const merchantSelfEnrollmentTrigger='SELF_SERVICE_MERCHANT_ENROLLMENT';
export const freePeriodKey=id=>'merchant_free_period:'+id;
export const merchantFreeTerms=Object.freeze({version:3,days:90,packageId:'starter',packageName:'Online Verify',startTrigger:'PROPERTY_AND_DOCUMENTS_APPROVED',unlimitedVillas:true,automaticBilling:false,postPeriodDowngrade:false});
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
export async function enrollVerifiedNewMerchant(db,user,verifiedAt=new Date().toISOString(),{createdNow=false,startTrigger=merchantFreeTerms.startTrigger}={}){
 if(user.role!=='merchant')return null;
 if(!Number.isFinite(Date.parse(verifiedAt))||new Date(verifiedAt).toISOString()!==verifiedAt)fail(400,'วันเริ่มสิทธิ์ไม่ถูกต้อง');
 return db.transaction(async()=>{
  const existing=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(freePeriodKey(user.id));
  if(existing)return JSON.parse(existing.value);
  if(!createdNow)return null; // Existing accounts are never implicitly migrated.
  // Never convert an existing entitlement, including existing legacy subscribers.
  if(await db.prepare('SELECT owner_id FROM subscriptions WHERE owner_id=?').get(user.id))return null;
  const plan=await db.prepare("SELECT id,active FROM package_catalog WHERE id='starter'").get();
  if(!plan?.active)fail(409,"สิทธิ์ Online Verify สำหรับบัญชีใหม่ยังไม่พร้อมใช้งาน");
  if(![merchantFreeTerms.startTrigger,merchantSelfEnrollmentTrigger].includes(startTrigger))fail(400,'Invalid enrollment trigger');
  const period={...merchantFreeTerms,startTrigger,ownerId:user.id,registeredAt:verifiedAt,startsAt:null,endsAt:null};
  await db.prepare("INSERT INTO subscriptions(owner_id,package_id,expires,created,lifecycle) VALUES (?,?,?,?,'ACTIVE')").run(user.id,'starter',null,verifiedAt);
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(freePeriodKey(user.id),JSON.stringify(period));
  await audit(db,user,'merchant.free_trial_eligible',user.id);return period;
 });
}
export async function merchantFreePeriod(db,ownerId,now=Date.now(),context){
 const row=context?.settings?context.settings.get(freePeriodKey(ownerId)):await db.prepare('SELECT value FROM system_settings WHERE key=?').get(freePeriodKey(ownerId));
 if(!row)return null;const p=JSON.parse(row.value);
 if(p.version===3){if(p.ownerId!==ownerId||p.packageId!=='starter'||p.startsAt!==null||p.endsAt!==null)fail(409,'ข้อมูลสิทธิ์ใช้ฟรีไม่ถูกต้อง');return {...p,state:'PER_VILLA',packageSelection:'COMING_SOON'};}
 if(!Number.isFinite(Date.parse(p.startsAt)))fail(409,'ข้อมูลสิทธิ์ใช้ฟรีไม่ถูกต้อง');
 const expectedEnd=p.version===1?addMonths(p.startsAt,3):p.version===2&&p.days===90?new Date(Date.parse(p.startsAt)+90*86400000).toISOString():null;
 if(![1,2].includes(p.version)||p.ownerId!==ownerId||p.packageId!=='starter'||!['VERIFIED_MERCHANT_REGISTRATION',merchantSelfEnrollmentTrigger].includes(p.startTrigger)||!Number.isFinite(Date.parse(p.startsAt))||p.endsAt!==expectedEnd)fail(409,'ข้อมูลสิทธิ์ใช้ฟรีไม่ถูกต้อง');
 return {...p,state:now>=Date.parse(p.startsAt)&&now<Date.parse(p.endsAt)?'ACTIVE':'EXPIRED',packageSelection:'COMING_SOON'};
}
export async function assertVillaCreation(db,ownerId,{perVilla=false}={}){
 const period=await merchantFreePeriod(db,ownerId);
 if(perVilla){const sub=await db.prepare('SELECT lifecycle FROM subscriptions WHERE owner_id=?').get(ownerId);if(['SUSPENDED','CANCELLED'].includes(sub?.lifecycle))fail(403,'สิทธิ์บัญชีถูกระงับ กรุณาติดต่อผู้ดูแล');return period||{state:'PER_VILLA'};}
 if(period){const sub=await db.prepare('SELECT lifecycle FROM subscriptions WHERE owner_id=?').get(ownerId);if(['SUSPENDED','CANCELLED'].includes(sub?.lifecycle))fail(403,'สิทธิ์บัญชีถูกระงับ กรุณาติดต่อผู้ดูแล');if(!['ACTIVE','PER_VILLA'].includes(period.state))fail(409,'ช่วงใช้ฟรีสิ้นสุดแล้ว รอประกาศสิทธิ์การใช้งานต่อ');return period;}
 // Existing accounts retain their original entitlement and restrictions.
 if(await db.prepare('SELECT id FROM villas WHERE owner_id=? LIMIT 1').get(ownerId))fail(409,'สิทธิ์เดิมของบัญชีนี้รองรับที่พักหนึ่งแห่ง กรุณาแก้ไขที่พักเดิม');
 return null;
}
export async function blockFreePackageSelection(db,user){if(await merchantFreePeriod(db,user.id))fail(409,'Coming Soon — ยังไม่เปิดให้เลือกแพ็กเกจ');}
