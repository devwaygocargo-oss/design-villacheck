import {hasAdminAccess} from './admin-access.mjs';
import {createHash,randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
import {hashPassword,audit} from './database.mjs';
import {findRoleOtpContact} from './role-otp-contacts.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const digest=v=>createHash('sha256').update(v).digest('hex');
const key=id=>'unified_credentials:'+id;
const address=v=>{if(typeof v!=='string'||v.length>254||! /^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/.test(v.trim()))fail(400,'อีเมลไม่ถูกต้อง');return v.trim().toLowerCase();};
const password=v=>{if(typeof v!=='string'||v.length<10||v.length>128||!/[a-zA-Z]/.test(v)||!/[0-9]/.test(v))fail(400,'รหัสผ่านต้องมี 10–128 ตัวอักษร รวมตัวอักษรและตัวเลข');return v;};
async function identities(db,email){return(await Promise.all(['user','merchant'].map(role=>findRoleOtpContact(db,role,'email',email)))).filter(Boolean);}
export async function beginUnifiedCredentials(db,otp,kind,data){
 if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'คำขอไม่ถูกต้อง');
 const email=address(data.email),nonce=randomBytes(32).toString('hex'),accounts=await identities(db,email);
 let pending={kind,email,nonceHash:digest(nonce)};
 if(kind==='register'){
  // A registration response does not disclose an existing identity. OTP proof
  // is required before finish can distinguish an existing account from a new one.
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>200||/[\x00-\x1f\x7f]/.test(data.name))fail(400,'กรุณาระบุชื่อผู้สมัคร');
  pending={...pending,name:data.name.trim(),passwordHash:hashPassword(password(data.password))};
 }else if(kind==='recovery'){
  // A matching contact is a routing hint, never authority to merge principals.
  if(accounts.length!==1||await hasAdminAccess(db,accounts[0]))return{nonce,challengeId:randomUUID(),expiresAt:new Date(Date.now()+300000).toISOString(),resendAfter:60,message:'หากอีเมลนี้มีบัญชีที่ใช้งานได้ ระบบจะส่งรหัสยืนยัน โปรดตรวจสอบอีเมล'};
  const user=accounts[0];pending={...pending,userId:user.id,role:user.role,credentialHash:digest(user.password_hash)};
 }else fail(400,'คำขอไม่ถูกต้อง');
 const challenge=await db.transaction(async()=>{
  const challenge=await otp.request({channel:'email',destination:email,accountType:pending.role||'user',purpose:'login'},null,{existingAccountLogin:true,browserNonce:nonce});
 if(!challenge.challengeId)fail(401,'คำขอไม่ถูกต้อง');
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(key(challenge.challengeId),JSON.stringify({...pending,expiresAt:challenge.expiresAt}));
  return challenge;
 });
 return{...challenge,nonce,...(kind==='recovery'?{message:'หากอีเมลนี้มีบัญชีที่ใช้งานได้ ระบบจะส่งรหัสยืนยัน โปรดตรวจสอบอีเมล'}:{verificationRequired:true})};
}
export async function finishUnifiedCredentials(db,otp,kind,data,nonce,onVerified){
 if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'คำขอไม่ถูกต้อง');
 if(typeof data.challengeId!=='string'||!/^[-a-f0-9]{36}$/.test(data.challengeId)||typeof nonce!=='string'||!/^[a-f0-9]{64}$/.test(nonce))fail(401,'คำขอยืนยันไม่ถูกต้องหรือหมดอายุ');
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(data.challengeId));let pending;try{pending=JSON.parse(row?.value)}catch{fail(401,'คำขอยืนยันไม่ถูกต้องหรือหมดอายุ');}
 if(!/^[a-f0-9]{64}$/.test(pending?.nonceHash||'')||pending?.kind!==kind||!Number.isFinite(Date.parse(pending.expiresAt))||Date.parse(pending.expiresAt)<=Date.now()||!timingSafeEqual(Buffer.from(pending.nonceHash,'hex'),Buffer.from(digest(nonce),'hex')))fail(401,'คำขอยืนยันไม่ถูกต้องหรือหมดอายุ');
 const newHash=kind==='recovery'?hashPassword(password(data.newPassword)):pending.passwordHash;
 return otp.verify(data,null,{existingAccountLogin:true,browserNonce:nonce,onVerified:async user=>{
  const current=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(data.challengeId));
  if(current?.value!==row.value)fail(401,'คำขอยืนยันเปลี่ยนแปลง กรุณาเริ่มใหม่');
  const principal=await db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  if(kind==='register'&&(!user.createdDuringOtp||principal.role!=='user'||principal.email!==pending.email))fail(409,'บัญชีนี้มีอยู่แล้ว กรุณาเข้าสู่ระบบ');
  if(kind==='recovery'&&(await hasAdminAccess(db,principal)||principal.id!==pending.userId||principal.role!==pending.role||digest(principal.password_hash)!==pending.credentialHash))fail(401,'ข้อมูลบัญชีเปลี่ยนแล้ว กรุณาเริ่มใหม่');
  await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(newHash,user.id);
  if(kind==='register')await db.prepare('UPDATE users SET name=? WHERE id=?').run(pending.name,user.id);
  await db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(user.id);
  await db.prepare('DELETE FROM system_settings WHERE key=?').run(key(data.challengeId));
  await audit(db,principal,kind==='register'?'account.email_password_registered':'account.password_recovered',principal.id);
  const updated={...principal,password_hash:newHash,...(kind==='register'?{name:pending.name}:{})};
  Object.assign(user,updated);
  return onVerified?onVerified(updated):{ok:true};
 }});
}
