import {validAdminBinding} from './admin-access.mjs';
import {productionOwnerTarget} from './phase2-production.mjs';
// Independent capability; OFF by default. Production requires its explicit three-account target contract.
// Never creates an identity, rewrites a primary role or enables financial functions.
import {randomUUID,createHash} from 'node:crypto';
import {audit} from './database.mjs';
import {assertWriteSession} from './write-session.mjs';
import {requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
const fail=()=>{throw Object.assign(Error('Independent Business Owner authorization required'),{status:403});};
const key=id=>'phase2:proposed-owner:'+id;
const binding=actor=>'phase2:proposed-owner-session:'+actor.token_hash;
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const ownerSlots=['prin','game','dew'];
export function independentOwnerEnabled(config){return config.phase2OwnerCapabilityCandidateEnabled===true&&typeof config.phase2OwnerCapabilityApprovalReference==='string'&&Boolean(config.phase2OwnerCapabilityApprovalReference.trim());}
function ready(db,config){requirePhase2(config);requirePhase2Database(db,config);if(!independentOwnerEnabled(config))fail();}
async function read(db,k){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(k);try{return row?JSON.parse(row.value):null;}catch{return null;}}
async function put(db,k,v){await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,JSON.stringify(v));}
export async function activeOwnerGrant(db,user,config){
 if(!independentOwnerEnabled(config))return null;ready(db,config);
 const current=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(user?.id||'');if(!current||!['user','merchant','admin'].includes(current.role)||(user.primaryRole||user.role)!==current.role)return null;
 const statusRow=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+current.id);
 if(statusRow){let access;try{access=JSON.parse(statusRow.value);}catch{return null;}if(!access||typeof access!=='object'||Array.isArray(access)||access.status!=='active')return null;}
 const grant=await read(db,key(current.id));if(config.phase2ProductionOwnerMode&&!productionOwnerTarget(current,grant?.slot,config.phase2ProductionOwnerAccounts))return null;return grant?.version===1&&grant.state==='ACTIVE'&&grant.accountId===current.id&&ownerSlots.includes(grant.slot)&&grant.authorizationReference===config.phase2OwnerCapabilityApprovalReference&&grant.grantReference?.trim()?grant:null;
}
export async function independentOwnerAuthorized(db,user,config){
 const grant=await activeOwnerGrant(db,user,config);if(!grant||!user.token_hash)return false;
 const b=await read(db,binding(user));return Boolean(b&&b.accountId===user.id&&b.primaryRole===(user.primaryRole||user.role)&&b.grantDigest===digest(grant));
}
async function activeStatus(db,id){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+id);if(!row)return true;try{const v=JSON.parse(row.value);return Boolean(v&&typeof v==='object'&&!Array.isArray(v)&&v.status==='active');}catch{return false;}}
export async function canInitializeProductionOwner(db,actor,config){if(!config.phase2ProductionOwnerMode||config.phase2ProductionOwnerGrantsApproved!==true||!actor?.token_hash)return false;ready(db,config);const user=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(actor.id),session=await db.prepare('SELECT expires FROM sessions WHERE token_hash=? AND user_id=?').get(actor.token_hash,actor.id);return Boolean(user&&productionOwnerTarget(user,undefined,config.phase2ProductionOwnerAccounts)&&(user.role==='admin'||actor.adminSession===true&&actor.role==='admin'&&await validAdminBinding(db,actor,actor.token_hash))&&session&&Number(session.expires)>Date.now()&&await activeStatus(db,user.id)&&!await db.prepare('SELECT key FROM system_settings WHERE key=?').get(key(user.id)));}
export async function bindIndependentOwnerSession(db,actor,config){ready(db,config);return db.transaction(async()=>{if(!actor.token_hash)fail();await assertWriteSession(db,actor);let grant=await activeOwnerGrant(db,actor,config);if(!grant&&await canInitializeProductionOwner(db,actor,config)){const slot=['game','prin','dew'].find(k=>productionOwnerTarget(actor,k,config.phase2ProductionOwnerAccounts));grant=await changeIndependentOwnerGrant(db,actor,config,{accountId:actor.id,slot,grantReference:'SELF_CONFIRMATION:'+config.phase2OwnerCapabilityApprovalReference,action:'grant'});}if(!grant)fail();await put(db,binding(actor),{accountId:actor.id,primaryRole:actor.primaryRole||actor.role,grantDigest:digest(grant)});await audit(db,actor,'phase2.proposed_owner.session_bound',actor.id);return{bound:true,proposed:config.phase2ProductionOwnerMode!==true,financialActivationEnabled:false};});}
// Trusted operator API only. No HTTP grant/revoke endpoint, no changes to users.role.
export async function changeIndependentOwnerGrant(db,actor,config,{accountId,slot,grantReference,action}){
 ready(db,config);return db.transaction(async()=>{
  if(!actor.token_hash)fail();await assertWriteSession(db,actor);const issuer=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(actor.id);const approvedSelfGrant=config.phase2ProductionOwnerMode&&actor.id===accountId&&action==='grant'&&await canInitializeProductionOwner(db,actor,config);if(issuer?.role!=='admin'&&!await independentOwnerAuthorized(db,actor,config)&&!approvedSelfGrant)fail();
  if(config.phase2ProductionOwnerMode&&config.phase2ProductionOwnerGrantsApproved!==true)fail();
  const target=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(accountId);if(!target||!['grant','revoke'].includes(action))fail();
  if(config.phase2ProductionOwnerMode&&(!productionOwnerTarget(target,action==='grant'?slot:undefined,config.phase2ProductionOwnerAccounts)||!productionOwnerTarget(issuer,undefined,config.phase2ProductionOwnerAccounts)&&!await independentOwnerAuthorized(db,actor,config)))fail();
  if(config.phase2ProductionOwnerMode&&(!await activeStatus(db,actor.id)||action==='grant'&&!await activeStatus(db,accountId)))fail();
  const previous=await read(db,key(accountId));
  if(action==='revoke'){if(!previous)fail();const grant={...previous,state:'REVOKED',revokedBy:actor.id,revokedAt:new Date().toISOString()};await put(db,key(accountId),grant);await put(db,'phase2:proposed-owner-event:'+randomUUID(),{...grant,action,recordedAt:new Date().toISOString()});await audit(db,actor,'phase2.proposed_owner.revoked',accountId);return grant;}
  if(!ownerSlots.includes(slot)||typeof grantReference!=='string'||!grantReference.trim())fail();
  const grants=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:proposed-owner:%'").all();if(grants.some(r=>{const g=JSON.parse(r.value);return g.state==='ACTIVE'&&(g.slot===slot&&g.accountId!==accountId||g.accountId===accountId&&g.slot!==slot);}))fail();
  // A retry of the same authorized operation must preserve the grant digest
  // used by bound sessions. The transaction serializes concurrent retries.
  if(previous?.grantReference===grantReference&&previous.slot===slot&&await activeOwnerGrant(db,target,config))return previous;
  const grant={version:1,id:randomUUID(),state:'ACTIVE',accountId,slot,grantReference,authorizationReference:config.phase2OwnerCapabilityApprovalReference,grantedBy:actor.id,grantedAt:new Date().toISOString()};await put(db,key(accountId),grant);await put(db,'phase2:proposed-owner-event:'+randomUUID(),{...grant,action,recordedAt:new Date().toISOString()});await audit(db,actor,'phase2.proposed_owner.granted',accountId);return grant;
 });
}
