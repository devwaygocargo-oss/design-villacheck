import {hasAdminAccess,adminAccess} from './admin-access.mjs';
import stagingOnboarding from './staging-admin-onboarding-scope.json' with {type:'json'};
import {adminPasswordSetupLifetimeMs,adminPasswordSetupLifetimeMinutes,adminPasswordSetupLifetimeText} from './admin-password-terms.mjs';
import {adminPasswordSetupConfigurationEnabled} from './admin-password-policy.mjs';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {hashPassword,audit} from './database.mjs';
import {assertWriteSession} from './write-session.mjs';
export const pilotAdmin={id:'ccb67164-36e7-45f9-913f-6acd7e5710b1',email:'dew.msit06@gmail.com',role:'admin'};
const digest=v=>createHash('sha256').update(v).digest('hex');
const fail=(status,message,code)=>{throw Object.assign(Error(message),{status,...(code?{code}:{})})};
const invalid=()=>fail(400,'This password setup link is invalid or expired. Request a new link. / ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่','ADMIN_SETUP_TOKEN_INVALID');
const generic={ok:true,message:'If this address is eligible, a password setup email will arrive. / หากอีเมลนี้ได้รับอนุญาต ระบบจะส่งลิงก์ตั้งรหัสผ่าน'};
export function adminSetupEnabled(config){return adminPasswordSetupConfigurationEnabled(config);}
export function pilotAdminAllowed(user,config){return config.appEnvironment==='staging'&&adminSetupEnabled(config)&&user?.id===pilotAdmin.id&&user.email===pilotAdmin.email&&(user.primaryRole||user.role)==='admin';}
// Build-owned, explicitly authorized Staging identities; never a Production fallback.
export const stagingSetupAdmins=Object.freeze([pilotAdmin,...stagingOnboarding.admins]);
export function stagingSetupAdminAllowed(user,config){return config.appEnvironment==='staging'&&adminSetupEnabled(config)&&(user?.primaryRole||user?.role)==='admin'&&stagingSetupAdmins.some(a=>a.id===user.id&&a.email===user.email);}
const approvedAdmins=config=>config.adminPasswordSetupScope||(config.appEnvironment==='staging'?stagingSetupAdmins:[]);
const eligibleAdmin=async(db,user,config)=>user&&await hasAdminAccess(db,user)&&approvedAdmins(config).some(a=>a.id===user.id&&a.email===user.email);
function enabled(config){if(!adminSetupEnabled(config))fail(503,'Admin password setup is not enabled for this environment/scope');}
const key=id=>'admin_password_setup:'+id;
async function active(db,user){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+user.id);return !row||JSON.parse(row.value).status!=='suspended';}
async function quota(db,email,now){const k='admin_setup_quota:'+digest(email),r=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(k),v=r?JSON.parse(r.value):null;const next=!v||v.until<=now?{count:1,until:now+15*60000}:{...v,count:v.count+1};if(next.count>3)fail(429,'Too many requests. Wait 15 minutes. / กรุณารอ 15 นาที');await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,JSON.stringify(next));}
export function validateAdminPassword(value){if(typeof value!=='string'||value.length<12||value.length>128||!/[a-z]/.test(value)||!/[A-Z]/.test(value)||!/[0-9]/.test(value)||! /[^a-zA-Z0-9\s]/.test(value)||/[\x00-\x1f\x7f]/.test(value))fail(400,'Use 12–128 characters with uppercase, lowercase, number and symbol. / ใช้ 12–128 ตัวอักษร มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และสัญลักษณ์','ADMIN_PASSWORD_WEAK');}
// Only pre-authorized existing Admin identities are eligible. This never provisions roles/users.
export async function requestAdminSetup(db,config,transport,email,{actor=null,purpose='recovery',now=Date.now()}={}){
 enabled(config);if(typeof email!=='string'||email.length>254)fail(400,'Invalid email');email=email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Invalid email');
 if(!['setup','recovery'].includes(purpose))fail(400,'Invalid purpose');
 if(purpose==='setup'&&!actor)fail(403,'Admin authorization required');
 let token,record,user;
 await db.transaction(async()=>{if(actor){await assertWriteSession(db,actor);if(actor.role!=='admin')fail(403,'Admin authorization required');}await quota(db,email,now);user=await db.prepare('SELECT id,email,role,password_hash FROM users WHERE lower(email)=?').get(email);
 if(!await eligibleAdmin(db,user,config)||!await active(db,user))return;
 if(!transport?.sendMail||!(config.adminPasswordSetupFrom||config.otpLoginProviderConfig?.smtpFrom||config.smtpFrom)){if(actor)fail(503,'Password setup email is not configured');return;}
 token=randomBytes(32).toString('base64url');record={version:2,issuedAt:now,lifetimeMinutes:adminPasswordSetupLifetimeMinutes,userId:user.id,email:user.email,role:'admin',purpose,tokenHash:digest(token),credentialFingerprint:digest(user.password_hash),authorizationFingerprint:(await adminAccess(db,user)).fingerprint,expiresAt:now+adminPasswordSetupLifetimeMs,state:'pending'};
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(user.id),JSON.stringify(record));await audit(db,actor||user,'admin.password_setup_requested',user.id);});
 if(!record)return generic;
 const url=config.appUrl+'/admin/password/setup#token='+token;
 try{const receipt=await transport.sendMail({from:config.adminPasswordSetupFrom||config.otpLoginProviderConfig?.smtpFrom||config.smtpFrom,to:user.email,subject:'VillaCheck'+(config.appEnvironment==='staging'?' Staging':'')+' — Set your Admin password / ตั้งรหัสผ่าน Admin',text:'You requested Admin password setup on VillaCheck'+(config.appEnvironment==='staging'?' Staging':' Production')+'. Open this link yourself within '+adminPasswordSetupLifetimeText+'. It works once. Your current password remains unchanged until completion. Do not share this link.\n\n'+url+'\n\nลิงก์นี้ใช้ได้ครั้งเดียว ภายใน 4 ชั่วโมง (240 นาที) หากไม่ได้ร้องขอให้ละเว้นอีเมลนี้'});
 if(receipt?.rejected?.length||receipt?.accepted&&!receipt.accepted.some(a=>String(a).toLowerCase()===user.email))throw Error('Delivery rejected');
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('admin_password_delivery:'+user.id,JSON.stringify({accepted:true,acceptedAt:new Date().toISOString(),messageIdHash:receipt?.messageId?digest(receipt.messageId):null,tokenHash:record.tokenHash,recipient:user.email}));
 await audit(db,user,'admin.password_setup_email_accepted',user.id);
 }catch{await db.transaction(async()=>{const current=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(user.id));if(current&&JSON.parse(current.value).tokenHash===record.tokenHash)await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...record,state:'revoked'}),key(user.id));await audit(db,user,'admin.password_setup_delivery_failed',user.id);});if(actor)fail(503,'Password setup email delivery failed');}
 token=null;return generic;
}
export async function revokeAdminSetup(db,config,actor,email){enabled(config);return db.transaction(async()=>{await assertWriteSession(db,actor);if(actor.role!=='admin')fail(403,'Admin required');const target=approvedAdmins(config).find(a=>a.email===email);if(!target)fail(403,'Approved recipient only');const r=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(target.id));if(r)await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...JSON.parse(r.value),state:'revoked'}),key(target.id));await audit(db,actor,'admin.password_setup_revoked',target.id);return {ok:true};});}
export async function completeAdminSetup(db,config,{token,newPassword},now=Date.now()){
 enabled(config);if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))invalid();validateAdminPassword(newPassword);const passwordHash=hashPassword(newPassword);
 return db.transaction(async()=>{let pending;for(const target of approvedAdmins(config)){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(target.id));if(row){const value=JSON.parse(row.value);if(timingSafeEqual(Buffer.from(value.tokenHash,'hex'),Buffer.from(digest(token),'hex')))pending=value;}}if(!pending)invalid();if(!Number.isFinite(pending.expiresAt)||pending.version===2&&(!Number.isFinite(pending.issuedAt)||pending.expiresAt!==pending.issuedAt+adminPasswordSetupLifetimeMs||pending.lifetimeMinutes!==adminPasswordSetupLifetimeMinutes))invalid();if(pending.state!=='pending'||pending.expiresAt<=now||!timingSafeEqual(Buffer.from(pending.tokenHash,'hex'),Buffer.from(digest(token),'hex')))invalid();const user=await db.prepare('SELECT id,email,role,password_hash FROM users WHERE id=?').get(pending.userId);if(!await eligibleAdmin(db,user,config)||!await active(db,user)||pending.credentialFingerprint!==digest(user.password_hash))invalid();const access=await adminAccess(db,user);if(pending.authorizationFingerprint?pending.authorizationFingerprint!==access.fingerprint:access.user.role!=='admin')invalid();
 await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash,user.id);await db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(user.id);await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...pending,state:'used',usedAt:now}),key(user.id));await audit(db,user,'admin.password_setup_completed',user.id);return {ok:true,requiresLogin:true};});
}
