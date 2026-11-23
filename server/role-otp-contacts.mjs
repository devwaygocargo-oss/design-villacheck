import {normalizeProfileOtpPhone} from './phone-number.mjs';
export {normalizeProfileOtpPhone} from './phone-number.mjs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createUser,audit} from './database.mjs';
import {enrollVerifiedNewMerchant} from './merchant-free-period.mjs';

// The existing settings primary key is the uniqueness constraint for each
// (role, channel, normalized contact). Keep legacy users/email/OAuth keys intact.
const key=(role,channel,destination)=>'role_otp_contact:'+role+':'+channel+':'+createHash('sha256').update(destination).digest('hex');
const read=async(db,k)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(k);return row?JSON.parse(row.value):null;};
async function profilePhoneAccounts(db,role,destination){
 const national=destination.startsWith('+66')?'0'+destination.slice(3):destination;
 const matches=await db.prepare("SELECT * FROM users WHERE role=? AND replace(replace(replace(replace(phone,' ',''),'(',''),')',''),'-','') IN (?,?) ORDER BY id LIMIT 101").all(role,destination,national);
 if(matches.length>100)throw Object.assign(Error('ไม่สามารถยืนยันข้อมูลเบอร์โทรได้ กรุณาใช้ช่องทางเดิม'),{status:409});
 const result=[];for(const account of matches){const pending=await read(db,'profile_phone_pending:'+account.id),verified=await read(db,'public_otp_account:'+account.id);if(pending||verified?.phone&&verified.phone!==destination)continue;result.push(account);}return result;
}
export async function profileOtpPhoneMatches(db,user,destination){
 if(normalizeProfileOtpPhone(user.phone)!==destination)return false;
 const matches=await profilePhoneAccounts(db,user.role,destination);
 return matches.length===1&&matches[0].id===user.id;
}
export async function assertProfileOtpPhoneAvailable(db,user,value){
 const destination=normalizeProfileOtpPhone(value);if(!destination)return;
 const existing=await findRoleOtpContact(db,user.role,'sms',destination);
 if(existing&&existing.id!==user.id)throw Object.assign(Error('เบอร์โทรนี้ใช้กับบัญชีอื่นแล้ว กรุณาใช้เบอร์ของคุณ'),{status:409});
 const matches=await profilePhoneAccounts(db,user.role,destination);
 if(matches.some(account=>account.id!==user.id))throw Object.assign(Error('เบอร์โทรนี้ใช้กับบัญชีอื่นแล้ว กรุณาใช้เบอร์ของคุณ'),{status:409});
}
const conflict=()=>{throw Object.assign(Error('ช่องทางนี้มีบัญชี Merchant แล้ว กรุณาเข้าสู่ระบบ'),{status:409});};
export async function findRoleOtpContact(db,role,channel,destination){
 const mapped=await read(db,key(role,channel,destination));
 if(mapped){
  if(mapped.role!==role||mapped.channel!==channel||mapped.destination!==destination)throw Error('Invalid contact mapping');
  return await db.prepare('SELECT * FROM users WHERE id=? AND role=?').get(mapped.userId,role)||null;
 }
 if(channel==='email')return await db.prepare('SELECT * FROM users WHERE email=? AND role=?').get(destination,role)||null;
 const identity=await db.prepare("SELECT u.* FROM oauth_identities o JOIN users u ON u.id=o.user_id WHERE o.provider='phone_otp' AND o.subject=? AND u.role=?").get(destination,role);
 if(identity)return identity;
 const matches=await profilePhoneAccounts(db,role,destination);
 if(matches.length>1)throw Object.assign(Error('เบอร์โทรนี้ตรงกับหลายบัญชี กรุณาเข้าสู่ระบบด้วยอีเมลและยืนยันเบอร์โทรในข้อมูลบัญชี'),{status:409});
 return matches[0]||null;
}
export async function roleOtpContactVerified(db,principal,channel,destination){
 const user={...principal,role:principal.primaryRole||principal.role};
 const mapped=await read(db,key(user.role,channel,destination));
 if(mapped)return mapped.userId===user.id;
 if(channel==='email')return user.email===destination&&!await read(db,'unverified_registration_email:'+user.id);
 const identity=await db.prepare("SELECT user_id FROM oauth_identities WHERE provider='phone_otp' AND subject=?").get(destination);
 return identity?.user_id===user.id;
}
export async function hasPublicOtpAccount(db,user){
 if(!['user','merchant'].includes(user?.role))return false;
 const marker=await read(db,'public_otp_account:'+user.id);
 return marker?.userId===user.id&&marker.role===user.role;
}
export async function publicOtpEmail(db,principal){
 const user={...principal,role:principal.primaryRole||principal.role};
 const contact=await read(db,'public_otp_account:'+user.id);
 return contact?.userId===user.id&&contact.role===user.role&&contact.email?contact.email:user.email.endsWith('.villacheck.invalid')?'':user.email;
}
export async function publicOtpPhone(db,principal){
 const user={...principal,role:principal.primaryRole||principal.role};
 const contact=await read(db,'public_otp_account:'+user.id);
 if(contact?.userId===user.id&&contact.role===user.role&&contact.phone)return contact.phone;
 return (await db.prepare("SELECT subject FROM oauth_identities WHERE provider='phone_otp' AND user_id=?").get(user.id))?.subject||'';
}
export async function completeRoleOtpContact(db,row,marker){
 const current=await findRoleOtpContact(db,row.account_type,row.channel,row.destination);
 let user=current,created=false;
 if(marker.purpose==='register'&&current)conflict();
 if(marker.purpose==='link_identity'){
  user=await db.prepare('SELECT * FROM users WHERE id=? AND role=?').get(marker.userId,row.account_type);
  if(!user||current&&current.id!==user.id)conflict();
 }else if(marker.userId&&current?.id!==marker.userId)throw Object.assign(Error('OTP ไม่ถูกต้องหรือหมดอายุ'),{status:401});
 if(!user){
  if(row.account_type==='merchant'&&marker.purpose!=='register')throw Object.assign(Error('OTP ไม่ถูกต้องหรือหมดอายุ'),{status:401});
  const id=randomUUID();
  // A unique internal address prevents a cross-role collision without changing
  // the existing User, its password, sessions, or globally unique legacy email.
  const email=row.channel==='email'&&!await db.prepare('SELECT id FROM users WHERE email=?').get(row.destination)?row.destination:id+'@'+(row.channel==='sms'?'phone':'contact')+'.villacheck.invalid';
  user=await createUser(db,email,randomBytes(48).toString('hex'),marker.registration?.name||(row.account_type==='merchant'?'Merchant':'User'),row.account_type,{id});created=true;
  if(user.role==='merchant')await db.prepare('UPDATE users SET business_name=?,business_name_en=? WHERE id=?').run(marker.registration.name,marker.registration.businessNameEn,user.id);
 }
 let phoneChangedDuringOtp=false;
 if(row.channel==='sms'&&marker.purpose==='link_identity'){
  const previous=await publicOtpPhone(db,user);phoneChangedDuringOtp=previous!==row.destination;
  if(phoneChangedDuringOtp){
   const rows=await db.prepare("SELECT key,value FROM system_settings WHERE key LIKE ? ESCAPE '!'").all('role!_otp!_contact:'+user.role+':sms:%');
   for(const old of rows){const value=JSON.parse(old.value);if(value.userId===user.id&&value.role===user.role&&value.channel==='sms'&&value.destination!==row.destination)await db.prepare('DELETE FROM system_settings WHERE key=? AND value=?').run(old.key,old.value);}
   await db.prepare("DELETE FROM oauth_identities WHERE provider='phone_otp' AND user_id=? AND subject<>?").run(user.id,row.destination);
   await audit(db,user,previous?'account.phone_changed':'account.phone_verified',user.id);
  }
 }
 const contactKey=key(user.role,row.channel,row.destination),existing=await read(db,contactKey);
 if(existing&&existing.userId!==user.id)conflict();
 if(!existing)await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(contactKey,JSON.stringify({userId:user.id,role:user.role,channel:row.channel,destination:row.destination,verifiedAt:new Date().toISOString()}));
 const old=await read(db,'public_otp_account:'+user.id);
 const profile={...old,userId:user.id,role:user.role,[row.channel==='email'?'email':'phone']:row.destination};
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('public_otp_account:'+user.id,JSON.stringify(profile));
 if(row.channel==='sms'&&(created||marker.purpose==='link_identity'&&user.role==='user')){await db.prepare('UPDATE users SET phone=? WHERE id=?').run(row.destination,user.id);user={...user,phone:row.destination};await db.prepare('DELETE FROM system_settings WHERE key=?').run('profile_phone_pending:'+user.id);}
 if(created){
  await db.prepare('UPDATE leads SET email=?,phone=?,updated=? WHERE user_id=?').run(row.channel==='email'?row.destination:'',row.channel==='sms'?row.destination:'',new Date().toISOString(),user.id);
  const verifiedAt=new Date().toISOString();
  if(user.role==='merchant'){
   const plan=await db.prepare("SELECT id,active FROM package_catalog WHERE id='starter'").get();
   if(plan?.active)await enrollVerifiedNewMerchant(db,user,verifiedAt,{createdNow:true});
   else await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('merchant_registration_review:'+user.id,JSON.stringify({userId:user.id,status:'PENDING_ACTIVATION',reason:'CATALOG_UNAVAILABLE',verifiedAt}));
  }
 }
 return {...user,publicOtpAccount:true,createdDuringOtp:created,phoneChangedDuringOtp};
}
