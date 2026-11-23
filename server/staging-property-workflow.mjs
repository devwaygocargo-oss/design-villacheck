import {merchantCondition,merchantProfile,parseMerchantProfile,accountCapabilities} from './merchant-capabilities.mjs';
import {randomUUID} from 'node:crypto';
import scope from './staging-merchant-scope.json' with {type:'json'};
import {hasPublicOtpAccount} from './role-otp-contacts.mjs';
const allocatedOwners=new Set(scope.merchants.map(a=>a.id)),protectedIds=new Set(scope.protectedVillaIds),reserved=email=>/^(?:demo|try)-[a-z0-9-]+@villacheck[.]example$/i.test(email||'');
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const registeredMerchant=user=>user?.role==='merchant'&&(user.publicOtpAccount===true||user.merchantProfileActive===true||user.primaryRole==='user'&&user.capabilities?.merchant===true)&&!allocatedOwners.has(user.id)&&!reserved(user.email);
export const selfRegisteredStagingMerchant=(user,config={})=>config.otpLoginEnabled===true&&registeredMerchant(user);

export async function stagingAdminVillas(db){
 const owners=new Set(allocatedOwners),users=await db.prepare(`SELECT u.id,u.email,u.role,s.value AS public_account,m.value AS merchant_capability FROM users u LEFT JOIN system_settings s ON s.key='public_otp_account:'||u.id LEFT JOIN system_settings m ON m.key='merchant_profile:'||u.id WHERE ${merchantCondition('u')}`).all();
 for(const user of users){let marker;try{marker=JSON.parse(user.public_account||'null')}catch{continue}if(registeredMerchant({...user,role:'merchant',primaryRole:user.role,capabilities:accountCapabilities(user),merchantProfileActive:!!parseMerchantProfile(user.merchant_capability,user.id),publicOtpAccount:user.role==='merchant'&&marker?.userId===user.id&&marker.role==='merchant'}))owners.add(user.id);}
 const villas=await db.prepare('SELECT * FROM villas WHERE owner_id IN ('+[...owners].map(()=>'?').join(',')+') ORDER BY created DESC').all(...owners);
 return villas.filter(villa=>allocatedOwners.has(villa.owner_id)||!protectedIds.has(villa.id)&&!reserved(villa.email));
}

// Keep Admin check history aligned with authenticated customer provenance.
// Bulk reads avoid a query for every User or Merchant; protected legacy data
// remains excluded and no request-supplied scope is accepted.
export async function stagingAdminCheckScope(db,config={}){
 const villas=await stagingAdminVillas(db),writers=new Set(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]);
 const rows=await db.prepare("SELECT u.id,u.email,u.role,u.created,b.value AS basic_account,p.value AS public_account,m.value AS merchant_capability,o.value AS public_oauth,EXISTS(SELECT 1 FROM oauth_identities oi WHERE oi.user_id=u.id AND oi.provider IN ('google','line')) AS oauth_linked FROM users u LEFT JOIN system_settings b ON b.key='basic_password_account:'||u.id LEFT JOIN system_settings p ON p.key='public_otp_account:'||u.id LEFT JOIN system_settings m ON m.key='merchant_profile:'||u.id LEFT JOIN system_settings o ON o.key='public_oauth_user:'||u.id WHERE u.role IN ('user','merchant')").all();
 const parse=value=>{try{return JSON.parse(value||'null')}catch{return null}},userIds=[];
 for(const user of rows){
  const basic=parse(user.basic_account),otp=parse(user.public_account),oauth=parse(user.public_oauth);
  const built=[...scope.users,...scope.merchants.filter(a=>writers.has(a.id))].some(a=>a.id===user.id&&a.email===user.email&&a.role===user.role);
  const password=user.role==='user'&&basic?.version===1&&basic.userId===user.id&&basic.email===user.email&&basic.emailVerified===false;
  const publicOtp=otp?.userId===user.id&&otp.role===user.role;
  const publicOauth=config.oauthExistingAccountsOnly===true&&(user.oauth_linked===true||user.oauth_linked===1)&&oauth?.userId===user.id&&oauth.role===user.role&&['google','line'].includes(oauth.provider)&&oauth.created===user.created;
  if(built||password||publicOtp||parseMerchantProfile(user.merchant_capability,user.id)||publicOauth)userIds.push(user.id);
 }
 return {userIds,villaIds:villas.filter(v=>!allocatedOwners.has(v.owner_id)||writers.has(v.owner_id)).map(v=>v.id)};
}

// Existing allocated DEMO policies remain in the caller. This branch handles
// authenticated real self-registered Merchants and explicit Admin reviews only.
export async function stagingPropertyWorkflow(db,user,req,path,url,readBody,config){
 const realMerchant=selfRegisteredStagingMerchant(user,config);
 const document=path.match(/^\/api\/(admin\/)?documents\/([a-f0-9-]{36})$/);
 if(req.method==='GET'&&document&&(realMerchant||user.role==='admin')){
  if(realMerchant&&document[1])fail(403,'เฉพาะ Admin');
  const file=await db.prepare('SELECT d.owner_id,u.role AS owner_role FROM documents d JOIN users u ON u.id=d.owner_id WHERE d.id=?').get(document[2]);
  if(realMerchant){if(file?.owner_id!==user.id)fail(404,'ไม่พบเอกสาร');return true;}
  if(file&&!allocatedOwners.has(file.owner_id)&&(file.owner_role==='user'||file.owner_role==='merchant'&&await hasPublicOtpAccount(db,{id:file.owner_id,role:'merchant'})||!!await merchantProfile(db,{id:file.owner_id,role:file.owner_role})))return true;
 }
 if(realMerchant&&path==='/api/merchant/villa-draft'&&['GET','POST'].includes(req.method))return true;
 if(realMerchant&&path==='/api/villas'&&req.method==='POST'){const data=await readBody(req);req.body=data;if(reserved(data.email))fail(400,'กรุณาใช้อีเมลติดต่อที่พักจริง');req.stagingVillaId=randomUUID();return true;}
 const match=path.match(/^\/api\/(?:merchant\/villas|villas)\/([a-f0-9-]{36})(?:\/(review|resubmit))?$/),adminQr=path.match(/^\/api\/admin\/qr\/([a-f0-9-]{36})$/),merchantMedia=['/api/merchant/property-media','/api/merchant/ownership-documents'].includes(path),adminMedia=['/api/admin/property-media','/api/admin/ownership-documents'].includes(path),review=match?.[2]==='review';
 if(!((realMerchant&&(merchantMedia||match&&!review))||(user.role==='admin'&&(adminMedia||review||adminQr))))return false;
 if(!['GET','POST',...(adminQr?['PATCH']:[])].includes(req.method))return false;const data=req.method==='GET'?{}:await readBody(req);if(req.method!=='GET')req.body=data;const id=match?.[1]||adminQr?.[1]||data.villaId||url.searchParams.get('villaId');
 const villa=await db.prepare('SELECT v.id,v.owner_id,v.email,u.email AS owner_email,u.role AS owner_role FROM villas v JOIN users u ON u.id=v.owner_id WHERE v.id=?').get(id||'');
 if(!villa||protectedIds.has(villa.id)||allocatedOwners.has(villa.owner_id)||reserved(villa.email)||reserved(villa.owner_email)||!['user','merchant'].includes(villa.owner_role)){if(user.role==='admin')return false;fail(404,'ไม่พบที่พัก');}
 if(realMerchant){if(villa.owner_id!==user.id)fail(404,'ไม่พบที่พัก');return true;}
 if(villa.owner_role!=='user'&&!await hasPublicOtpAccount(db,{id:villa.owner_id,role:villa.owner_role})&&!await merchantProfile(db,{id:villa.owner_id,role:villa.owner_role}))return false;return true;
}
