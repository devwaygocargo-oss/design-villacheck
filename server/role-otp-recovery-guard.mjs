import {randomBytes,randomUUID} from 'node:crypto';
import {findRoleOtpContact} from './role-otp-contacts.mjs';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const roleOf=data=>{
 if(!['user','merchant'].includes(data?.accountType))fail(400,'คำขอกู้คืนบัญชีไม่ถูกต้อง กรุณาเข้าสู่ระบบด้วย OTP');
 return data.accountType;
};
const noDelivery=()=>({challengeId:randomUUID(),expiresAt:new Date(Date.now()+300000).toISOString(),resendAfter:60,nonce:randomBytes(32).toString('hex'),message:'หากบัญชีรองรับการกู้คืน ระบบจะส่งรหัสยืนยันไปยังอีเมลของคุณ'});

// Legacy password recovery resolves its target by users.email. A public role
// contact can instead point to an independent account with an internal address.
// Do not let a recovery request for that role reset the other role's password.
export async function beginRoleSafePasswordRecovery(db,otp,data,beginPasswordRecovery){
 const role=roleOf(data);
 if(typeof data.email!=='string'||data.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))fail(400,'กรุณาระบุอีเมลให้ถูกต้อง');
 const email=data.email.trim().toLowerCase();
 const target=await findRoleOtpContact(db,role,'email',email);
 if(!target||target.email!==email)return noDelivery();
 return beginPasswordRecovery(db,otp,email);
}

export async function assertRoleSafePasswordRecovery(db,data){
 const role=roleOf(data);
 if(typeof data.challengeId!=='string'||!/^[-a-f0-9]{36}$/.test(data.challengeId))fail(401,'คำขอกู้คืนไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มใหม่');
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('password_recovery:'+data.challengeId);
 const pending=row?JSON.parse(row.value):null;
 if(!pending||pending.role!==role)fail(401,'คำขอกู้คืนไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มใหม่');
 const target=await findRoleOtpContact(db,role,'email',pending.email);
 if(!target||target.id!==pending.userId||target.email!==pending.email)fail(401,'คำขอกู้คืนไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มใหม่');
}
