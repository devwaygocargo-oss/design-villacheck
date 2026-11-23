import {submitMerchantChange} from './merchant-change-approval.mjs';
import {audit} from './database.mjs';
import {assertWriteSession} from './write-session.mjs';
import {publicOtpEmail,publicOtpPhone,roleOtpContactVerified} from './role-otp-contacts.mjs';
import {enrollVerifiedNewMerchant,merchantSelfEnrollmentTrigger} from './merchant-free-period.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
import {merchantProfileKey,parseMerchantProfile} from './merchant-capability-record.mjs';
export {merchantProfileKey,parseMerchantProfile} from './merchant-capability-record.mjs';
export function accountCapabilities(user,value){const primary=user.primaryRole||user.role,profile=parseMerchantProfile(value??user.merchant_capability,user.id);return{user:['user','merchant'].includes(primary),merchant:primary==='merchant'||primary==='user'&&!!profile};}
export async function merchantProfile(db,user){if(user.role==='admin'||user.primaryRole==='admin')return null;return parseMerchantProfile((await db.prepare('SELECT value FROM system_settings WHERE key=?').get(merchantProfileKey(user.id)))?.value,user.id);}
export async function hasMerchantCapability(db,user){return (user.primaryRole||user.role)==='merchant'||(user.primaryRole||user.role)==='user'&&!!await merchantProfile(db,user);}
export function merchantCondition(alias='u'){if(!/^[a-z]+$/i.test(alias))throw Error('Invalid SQL alias');return `(${alias}.role='merchant' OR (${alias}.role='user' AND (EXISTS (SELECT 1 FROM system_settings mp WHERE mp.key='merchant_profile:'||${alias}.id))))`;}
export function actorForRequest(user,req,requiredRole){
 if(user.adminSession===true)return user;
 const primary=user.primaryRole||user.role,caps=user.capabilities||accountCapabilities(user),path=new URL(req.url||'/','http://localhost').pathname;
 const wanted=requiredRole||(path.startsWith('/api/merchant/')||path.startsWith('/api/villas')?'merchant':path.startsWith('/api/user/')?'user':!path.startsWith('/api/auth/')?req.headers?.['x-villacheck-portal']:null);
 const role=primary!=='admin'&&['user','merchant'].includes(wanted)&&caps[wanted]?wanted:primary;
 return{...user,primaryRole:primary,role,capabilities:caps,merchantProfileActive:!!parseMerchantProfile(user.merchant_capability,user.id)};
}

const clean=(value,label,max=200)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f\x7f]/.test(value))fail(400,'กรุณาระบุ'+label+'ให้ถูกต้อง');return value.trim()};
export function merchantFields(data){if(!data||data.consent!==true)fail(400,'กรุณายอมรับเงื่อนไขการสมัครผู้ประกอบการ');const fields={businessName:clean(data.businessName,'ชื่อธุรกิจภาษาไทย'),businessNameEn:clean(data.businessNameEn,'ชื่อธุรกิจภาษาอังกฤษ'),contactName:clean(data.contactName,'ชื่อผู้ติดต่อ'),phone:clean(data.phone,'เบอร์ติดต่อ',30),address:clean(data.address,'ที่อยู่',2000)};if(!/^[+0-9 ()-]{8,30}$/.test(fields.phone))fail(400,'เบอร์ติดต่อไม่ถูกต้อง');return fields;}
export async function registerMerchantCapability(db,actor,data,onRegistered,{deferInitialGrant=false}={}){
 const fields=merchantFields(data);
 return db.transaction(async()=>{
  await assertWriteSession(db,actor);
  const user=await db.prepare('SELECT * FROM users WHERE id=?').get(actor.id);if(!user||!['user','merchant'].includes(user.role))fail(403,'เข้าสู่ระบบบัญชีผู้ใช้ก่อนสมัครเป็นผู้ประกอบการ');
  const access=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+user.id);if(access&&JSON.parse(access.value).status==='suspended')fail(403,'บัญชีถูกระงับ');
  const previous=await merchantProfile(db,user);if(user.role==='merchant'||previous){const issued=onRegistered?await onRegistered(user):undefined;return{profile:previous,alreadyRegistered:true,user,issued};}
  const bankName=clean(data.bankName,'ชื่อธนาคาร',120),accountName=clean(data.accountName,'ชื่อบัญชี',120);
  const accountNumber=typeof data.accountNumber==='string'?data.accountNumber.replace(/[ -]/g,''):'';
  if(!/^\d{6,20}$/.test(accountNumber))fail(400,'กรุณาระบุเลขบัญชี 6–20 หลัก');
  const bankKey='merchant_receiving_bank:'+user.id;
  const existingBank=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(bankKey);
  if(existingBank)fail(409,'มีข้อมูลบัญชีธนาคารเดิม กรุณาตรวจสอบข้อมูลก่อนสมัคร');
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(bankKey,JSON.stringify({bankName,accountName,accountNumber,revision:1,updatedAt:new Date().toISOString(),updatedBy:user.id}));
  const email=await publicOtpEmail(db,user),phone=await publicOtpPhone(db,user);
  const contacts={email:email&&await roleOtpContactVerified(db,user,'email',email)?email:'',phone:phone&&await roleOtpContactVerified(db,user,'sms',phone)?phone:''};
  const oauth=await db.prepare("SELECT provider FROM oauth_identities WHERE user_id=? AND provider IN ('google','line')").all(user.id);
  if(!contacts.email&&!contacts.phone&&!oauth.length)fail(403,'Verify an account contact before Merchant enrollment');
  // Registration preserves identity; only verified enrollment grants capability.

  const at=new Date().toISOString(),profile={version:1,userId:user.id,status:'ACTIVE',fields,verifiedContacts:contacts,createdAt:at,updatedAt:at,consent:{version:1,acceptedAt:at},source:'AUTHENTICATED_SELF_REGISTRATION'};
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(merchantProfileKey(user.id),JSON.stringify(profile));
  // A new Merchant capability is the registration event. Never replace an
  // existing subscription/grant, change the principal role or create a Villa.
  const starter=await db.prepare("SELECT active FROM package_catalog WHERE id='starter'").get();
  if(!deferInitialGrant&&starter?.active)await enrollVerifiedNewMerchant(db,{...user,role:'merchant'},at,{createdNow:true,startTrigger:merchantSelfEnrollmentTrigger});
  await db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(user.id);
  await db.prepare('DELETE FROM system_settings WHERE key=?').run('merchant_enrollment_draft:'+user.id);
  await audit(db,user,'merchant.self_registered',user.id);
  const issued=onRegistered?await onRegistered(user):undefined;
  return{profile,user,issued,alreadyRegistered:false};
 });
}
export function merchantBusinessRecord(userId,fields,previous){const at=new Date().toISOString();return previous?{...previous,fields,updatedAt:at}:{version:2,userId,status:'ACTIVE',fields,createdAt:at,updatedAt:at,source:'AUTHENTICATED_MERCHANT_PROFILE'};}
export async function saveMerchantProfile(db,actor,data){const current=await merchantProfile(db,actor);if(!['user','merchant'].includes(actor.primaryRole||actor.role))return false;const fields=merchantFields({...data,consent:true});return submitMerchantChange(db,actor,merchantProfileKey(actor.id),merchantBusinessRecord(actor.id,fields,current));}

export async function merchantAccountRows(db,rows){const result=[];for(const row of rows){const profile=await merchantProfile(db,row);if(!['user','merchant'].includes(row.role)||row.role==='user'&&!profile)continue;result.push(profile?{...row,primaryRole:row.primaryRole||row.role,role:'merchant',name:profile.fields.contactName,business_name:profile.fields.businessName,business_name_en:profile.fields.businessNameEn,phone:profile.fields.phone,address:profile.fields.address}:row.role==='user'?{...row,primaryRole:'user',role:'merchant'}:row);}return result;}

export async function merchantEnrollmentDraft(db,actor,data){
 const key='merchant_enrollment_draft:'+actor.id;
 if((actor.primaryRole||actor.role)!=='user')fail(403,'User enrollment required');
 if(data===undefined){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);return row?JSON.parse(row.value):null;}
 const limits={businessName:200,businessNameEn:200,contactName:200,phone:30,address:2000,bankName:120,accountName:120,accountNumber:30};
 if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).some(k=>!Object.hasOwn(limits,k)))fail(400,'Invalid enrollment draft fields');
 const fields={};for(const [k,v]of Object.entries(data)){if(typeof v!=='string'||v.length>limits[k]||/[\x00-\x1f\x7f]/.test(v))fail(400,'Invalid enrollment draft value');fields[k]=v;}
 if(fields.accountNumber&&!/^[0-9 -]{1,30}$/.test(fields.accountNumber))fail(400,'Invalid bank account');
 return db.transaction(async()=>{await assertWriteSession(db,actor);if(await hasMerchantCapability(db,actor))fail(409,'Already registered');const value={fields,updatedAt:new Date().toISOString()};await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));await audit(db,actor,'merchant.enrollment_draft_saved',actor.id);return value;});
}
