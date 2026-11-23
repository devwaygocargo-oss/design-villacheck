import {createHash} from 'node:crypto';
import {audit} from './database.mjs';
import {assertWriteSession} from './write-session.mjs';
import {requireBusinessPermission} from './business-permissions.mjs';
import {requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
import {activeOwnerGrant,changeIndependentOwnerGrant} from './phase2-owner-capability.mjs';
import {adminAccess} from './admin-access.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
// Existing identities only. Candidate stays isolated; no Production flag/contract bypass.
export async function businessRoleManagement(db,actor,req,path,body,config){
 if(path!=='/api/admin/access-roles')return undefined;
 await requireBusinessPermission(db,actor,config,'roles.manage');requirePhase2(config);requirePhase2Database(db,config);
 const users=await db.prepare('SELECT id,email,name,role FROM users ORDER BY email').all();
 if(req.method==='GET')return {accounts:await Promise.all(users.map(async user=>({id:user.id,email:user.email,name:user.name,primaryRole:user.role,admin:Boolean(await adminAccess(db,user)),owner:Boolean(await activeOwnerGrant(db,user,config))}))),financialActivationEnabled:false};
 if(req.method!=='POST')fail(405,'POST required');
 const data=await body(req);
 if(!data||Object.keys(data).some(k=>!['accountId','capability','action','slot','reason'].includes(k))||!['ADMIN','BUSINESS_OWNER'].includes(data.capability)||!['grant','revoke'].includes(data.action)||typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>1000)fail(400,'Invalid role request');
 return db.transaction(async()=>{
  await assertWriteSession(db,actor);await requireBusinessPermission(db,actor,config,'roles.manage');
  const target=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(data.accountId||'');if(!target)fail(404,'Existing account required');
  const ref='OWNER_REQUEST:'+createHash('sha256').update(JSON.stringify({actor:actor.id,target:target.id,capability:data.capability,action:data.action,reason:data.reason,at:new Date().toISOString()})).digest('hex');
  if(data.capability==='BUSINESS_OWNER'){
   if(data.action==='revoke'){
    let count=0;for(const u of users)if(await activeOwnerGrant(db,u,config))count++;
    if(count<=1)fail(409,'Cannot revoke the last active Business Owner');
   }
   await changeIndependentOwnerGrant(db,actor,config,{accountId:target.id,slot:data.slot,grantReference:ref,action:data.action});
  }else{
   if(target.role==='admin'){if(data.action==='revoke')fail(409,'Native Admin removal requires separate recovery-reviewed procedure');return {ok:true,alreadyGranted:true};}
   if(target.role!=='user')fail(409,'Independent Admin currently requires existing User identity');
   const k='admin_access:'+target.id;
   if(data.action==='grant')await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,JSON.stringify({version:1,userId:target.id,email:target.email,role:'admin',state:'ACTIVE',authorizationSha256:ref.slice('OWNER_REQUEST:'.length),grantedBy:actor.id,grantedAt:new Date().toISOString()}));
   else {const r=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(k);if(!r)fail(404,'Additional Admin grant missing');await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...JSON.parse(r.value),state:'REVOKED',revokedBy:actor.id,revokedAt:new Date().toISOString()}),k);}
  }
  await audit(db,actor,'roles.'+data.capability.toLowerCase()+'.'+data.action,target.id);
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('role_request:'+ref.slice('OWNER_REQUEST:'.length),JSON.stringify({actorId:actor.id,targetId:target.id,capability:data.capability,action:data.action,reason:data.reason,at:new Date().toISOString(),reference:ref}));
  return {ok:true,accountId:target.id,capability:data.capability,action:data.action,requiresFreshSession:true,financialActivationEnabled:false};
 });
}
