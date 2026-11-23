import {verifyPasswordAsync} from './database.mjs';
import {assertWriteSession} from './write-session.mjs';
import {publicOtpPhone,roleOtpContactVerified,normalizeProfileOtpPhone} from './role-otp-contacts.mjs';
import {consumeCustomerOAuthProof} from './customer-oauth-security.mjs';
const fail=(status,message,code)=>{throw Object.assign(Error(message),{status,code});};
export async function phoneProfileStatus(db,actor){
 const user=await db.prepare('SELECT id,role,phone FROM users WHERE id=?').get(actor.id);
 if(!user||!['user','merchant'].includes(user.role)||actor.adminSession)fail(403,'เฉพาะบัญชีผู้ใช้หรือผู้ประกอบการ','PHONE_ACCOUNT_REQUIRED');
 const loginPhone=await publicOtpPhone(db,user),verified=Boolean(loginPhone)&&await roleOtpContactVerified(db,user,'sms',loginPhone),normalized=normalizeProfileOtpPhone(user.phone);
 return{profilePhone:user.role==='user'?user.phone||'':'',loginPhone:verified?loginPhone:'',status:user.role==='merchant'?(verified?'VERIFIED':'NOT_SET'):!user.phone?'NOT_SET':verified&&normalized===loginPhone?'VERIFIED':'PENDING',primaryRole:user.role};
}
// Password/provider proof is checked before queueing. No plaintext credential
// enters the challenge. The caller commits reserve() with OTP reservation.
export async function preparePhoneChange(db,actor,destination,data){
 if(!actor||! /^[a-f0-9]{64}$/.test(actor.token_hash||''))fail(403,'เข้าสู่ระบบบัญชีเดิมก่อนยืนยันเบอร์โทร','PHONE_ACCOUNT_REQUIRED');
 await assertWriteSession(db,actor);
 const user=await db.prepare('SELECT id,email,role,phone,password_hash FROM users WHERE id=?').get(actor.id);
 if(!user||user.role!==actor.role||!['user','merchant'].includes(user.role))fail(403,'เข้าสู่ระบบบัญชีเดิมก่อนยืนยันเบอร์โทร','PHONE_ACCOUNT_REQUIRED');
 const previousPhone=await publicOtpPhone(db,user),changing=Boolean(previousPhone)&&previousPhone!==destination;
 const password=typeof data.currentPassword==='string'?data.currentPassword:'';
 if(password.length>128)fail(400,'กรุณาระบุรหัสผ่านปัจจุบัน','PHONE_REAUTH_REQUIRED');
 if(changing&&password&&!await verifyPasswordAsync(password,user.password_hash))fail(403,'ยืนยันรหัสผ่านปัจจุบันไม่สำเร็จ','PHONE_REAUTH_REQUIRED');
 const snapshot={previousPhone,profilePhone:user.phone||'',sessionHash:actor.token_hash};
 return{snapshot,reserve:async()=>{
  await assertWriteSession(db,actor);
  const current=await db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
  if(!current||current.password_hash!==user.password_hash||!await phoneChangeStillValid(db,user.id,user.role,snapshot))fail(409,'ข้อมูลบัญชีเปลี่ยนแล้ว กรุณาเริ่มยืนยันเบอร์ใหม่','PHONE_CHANGED');
  if(changing&&!password){try{await consumeCustomerOAuthProof(db,actor,'phone-change');}catch{fail(403,'ยืนยันรหัสผ่านปัจจุบันหรือบัญชี Google/LINE ก่อนเปลี่ยนเบอร์','PHONE_REAUTH_REQUIRED');}}
 }};
}
export async function phoneChangeStillValid(db,id,role,snapshot){
 if(!snapshot||typeof snapshot.sessionHash!=='string')return false;
 const user=await db.prepare('SELECT id,role,phone FROM users WHERE id=?').get(id),session=await db.prepare('SELECT expires FROM sessions WHERE token_hash=? AND user_id=?').get(snapshot.sessionHash,id);
 return Boolean(user&&user.role===role&&session&&Number(session.expires)>Date.now()&&(user.phone||'')===snapshot.profilePhone&&(await publicOtpPhone(db,user))===snapshot.previousPhone);
}
