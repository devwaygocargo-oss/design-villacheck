import {createHash,randomUUID} from 'node:crypto';
import {audit} from './database.mjs';
const fail=()=>{throw Object.assign(Error('Admin access denied'),{status:403})};
export const adminAccessKey=id=>'admin_access:'+id;
const hash=v=>createHash('sha256').update(v).digest('hex');
export async function adminAccess(db,identity){
 const user=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(identity?.id||'');
 if(!user||identity.email&&identity.email!==user.email)return null;
 if(user.role==='admin')return{user,fingerprint:'NATIVE_ADMIN'};
 if(user.role!=='user')return null;
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(adminAccessKey(user.id));
 let grant;try{grant=row&&JSON.parse(row.value)}catch{return null}
 if(!grant||grant.version!==1||grant.state!=='ACTIVE'||grant.role!=='admin'||grant.userId!==user.id||grant.email!==user.email||! /^[a-f0-9]{64}$/.test(grant.authorizationSha256||''))return null;
 return{user,grant,fingerprint:hash(row.value)};
}
export async function hasAdminAccess(db,identity){return Boolean(await adminAccess(db,identity));}
export const adminBindingKey=tokenHash=>'admin_session_binding:'+tokenHash;
export async function bindAdminSession(db,identity,tokenHash,expires){const access=await adminAccess(db,identity);if(!access)fail();await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(adminBindingKey(tokenHash),JSON.stringify({version:1,userId:identity.id,email:identity.email,primaryRole:access.user.role,fingerprint:access.fingerprint,expires}));}
export async function validAdminBinding(db,identity,tokenHash){
 const access=await adminAccess(db,identity);if(!access)return false;
 if(access.user.role==='admin')return true; // Preserve native Admin sessions.
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(adminBindingKey(tokenHash));let b;try{b=row&&JSON.parse(row.value)}catch{return false}
 return Boolean(b&&b.version===1&&b.userId===identity.id&&b.email===access.user.email&&b.primaryRole===access.user.role&&b.expires>Date.now()&&b.fingerprint===access.fingerprint);
}
// Trusted operator workflow only. No HTTP route accepts a role or authorization proof.
export async function grantAdditionalAdmin(db,actor,target,authorization){
 return db.transaction(async()=>{
  const issuer=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(actor?.id||'');
  if(issuer?.role!=='admin'||!actor.token_hash)fail();
  const session=await db.prepare('SELECT expires FROM sessions WHERE token_hash=? AND user_id=?').get(actor.token_hash,actor.id);
  const status=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+actor.id);
  if(!session||session.expires<=Date.now()||status&&JSON.parse(status.value).status==='suspended')fail();
  if(!authorization||! /^[a-f0-9]{64}$/.test(authorization.sha256||'')||!authorization.targets?.some(t=>t.id===target.id&&t.email===target.email))fail();
  const user=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(target.id);
  if(!user||user.email!==target.email||user.role!=='user')fail();
  const existing=await adminAccess(db,user);if(existing)return{userId:user.id,role:'admin',primaryRole:'user',alreadyGranted:true};
  const value={version:1,id:randomUUID(),userId:user.id,email:user.email,role:'admin',state:'ACTIVE',authorizationSha256:authorization.sha256,grantedBy:issuer.id,grantedAt:new Date().toISOString()};
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(adminAccessKey(user.id),JSON.stringify(value));
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('admin_access_event:'+randomUUID(),JSON.stringify({action:'GRANTED',...value}));
  await audit(db,issuer,'admin.additional_access_granted',user.id);
  return{userId:user.id,role:'admin',primaryRole:'user',alreadyGranted:false};
 });
}
export async function revokeAdditionalAdmin(db,actor,target,authorization){return db.transaction(async()=>{const issuer=await db.prepare('SELECT id,role FROM users WHERE id=?').get(actor?.id||'');const s=actor?.token_hash?await db.prepare('SELECT expires FROM sessions WHERE token_hash=? AND user_id=?').get(actor.token_hash,actor.id):null;if(issuer?.role!=='admin'||!s||s.expires<=Date.now()||!authorization?.targets?.some(t=>t.id===target.id&&t.email===target.email)||! /^[a-f0-9]{64}$/.test(authorization.sha256||''))fail();const status=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+actor.id);if(status&&JSON.parse(status.value).status==='suspended')fail();const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(adminAccessKey(target.id));if(!row)fail();const grant=JSON.parse(row.value);if(grant.userId!==target.id||grant.email!==target.email)fail();await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...grant,state:'REVOKED',revokedBy:issuer.id,revokedAt:new Date().toISOString()}),adminAccessKey(target.id));await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('admin_access_event:'+randomUUID(),JSON.stringify({action:'REVOKED',...grant,state:'REVOKED',revokedBy:issuer.id,revokedAt:new Date().toISOString()}));await audit(db,issuer,'admin.additional_access_revoked',target.id);return{ok:true};});}
