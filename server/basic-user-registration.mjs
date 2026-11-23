import {createUser,audit} from "./database.mjs";
import {findRoleOtpContact} from "./role-otp-contacts.mjs";
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const marker=id=>"basic_password_account:"+id;
export async function hasBasicPasswordAccount(db,user){
 if(user?.role!=="user")return false;
 const row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(marker(user.id));
 try{const value=JSON.parse(row?.value);return value.version===1&&value.userId===user.id&&value.email===user.email&&value.emailVerified===false;}catch{return false;}
}
export async function registerBasicUser(db,data,onCreated){
 if(!data||typeof data!=="object"||Array.isArray(data))fail(400,"คำขอไม่ถูกต้อง");
 if(typeof data.name!=="string"||!data.name.trim()||data.name.length>200||/[\x00-\x1f\x7f]/.test(data.name))fail(400,"กรุณาระบุชื่อผู้สมัคร");
 if(typeof data.email!=="string"||data.email.length>254||!/^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/.test(data.email.trim()))fail(400,"อีเมลไม่ถูกต้อง");
 if(typeof data.password!=="string"||data.password.length<10||data.password.length>128||!/[a-zA-Z]/.test(data.password)||!/[0-9]/.test(data.password))fail(400,"รหัสผ่านต้องมี 10–128 ตัวอักษร รวมตัวอักษรและตัวเลข");
 const email=data.email.trim().toLowerCase();
 try{return await db.transaction(async()=>{
  if(await db.prepare("SELECT id FROM users WHERE lower(email)=?").get(email)||(await Promise.all(["user","merchant"].map(role=>findRoleOtpContact(db,role,"email",email)))).some(Boolean))fail(409,"อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบหรือกู้คืนรหัสผ่าน");
  const user=await createUser(db,email,data.password,data.name.trim(),"user");
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run(marker(user.id),JSON.stringify({version:1,userId:user.id,email,emailVerified:false,createdAt:new Date().toISOString()}));
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run("unverified_registration_email:"+user.id,JSON.stringify({email,emailVerified:false,source:"BASIC_PASSWORD_SIGNUP"}));
  await audit(db,user,"account.password_registered",user.id);
  return onCreated?await onCreated(user):user;
 });}catch(error){if(error.code==="23505"||error.code==="SQLITE_CONSTRAINT_UNIQUE"||/UNIQUE constraint failed: users\.email/.test(error.message))fail(409,"อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบหรือกู้คืนรหัสผ่าน");throw error;}
}
