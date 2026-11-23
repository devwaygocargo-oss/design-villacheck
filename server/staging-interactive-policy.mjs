import {stagingSetupAdminAllowed,stagingSetupAdmins} from './admin-password-setup.mjs';
import {hasBasicPasswordAccount} from "./basic-user-registration.mjs";
import {hasPublicOtpAccount} from "./role-otp-contacts.mjs";
import {publicOAuthUser} from "./public-oauth-user.mjs";
import {merchantProfile} from "./merchant-capabilities.mjs";
import {menuReadAllowed,socialMenuWriteAllowed,stagingSettingsWriteAllowed} from './menu-read-policy.mjs';
import {registryPrecheckRoute,assertRegistryPrecheckRole,registryBankDocumentAllowed} from "./registry-precheck.mjs";
import {stagingPropertyWorkflow,stagingAdminCheckScope} from './staging-property-workflow.mjs';
import {reviewRequestAllowed,assertReviewRole} from "./review-request-policy.mjs";
import {otpDestination} from './login-otp.mjs';
import {otpLoginStagingUser} from './otp-login-runtime.mjs';
// Build-owned guard; no client-supplied scope and no signup verification bypass.
import {replayedVillaCreate} from './villa-create-request.mjs';
import scope from './staging-merchant-scope.json' with {type:'json'};
const deny=(status,message)=>{throw Object.assign(Error(message),{status})};
export {scope};
const actors=[scope.admin,...(scope.additionalAdmins||[]),...scope.merchants,...scope.users];
const builtActor=user=>actors.some(a=>user?.id===a.id&&(user.primaryRole||user.role)===a.role&&user.email===a.email);
async function registeredPublicAccount(db,target,config){
 if(!target||!['user','merchant'].includes(target.role))return false;
 return await hasBasicPasswordAccount(db,target)||await hasPublicOtpAccount(db,target)||!!await merchantProfile(db,target)||await publicOAuthUser(db,target,config);
}
export function actorAllowed(user,config={}){if(!(config.unifiedAuthEnabled===true&&user?.token_hash&&(user.primaryRole||user.role)==='user'&&['user','merchant'].includes(user.role))&&!(config.unifiedAuthEnabled===true&&user?.basicPasswordAccount===true&&["user","merchant"].includes(user.role))&&!(config.otpLoginEnabled===true&&user?.publicOtpAccount===true&&['user','merchant'].includes(user.role))&&!stagingSetupAdminAllowed(user,config)&&!builtActor(user)&&!otpLoginStagingUser(user,config)&&!(config.oauthExistingAccountsOnly===true&&['user','merchant'].includes(user?.role)&&user.oauthPublicUser===true))deny(403,'Staging test actor required')}
export function requestAllowed(method,path,config={}){
 if(method==='GET'&&path==='/api/admin/audit-log')return true;
 if(['GET','POST'].includes(method)&&path==='/api/admin/access-roles')return true;
 if(['GET','POST'].includes(method)&&['/api/auth/admin-password/request','/api/auth/admin-password/complete','/api/admin/password-invitation'].includes(path))return true;
 if(reviewRequestAllowed(method,path))return true;
 if(path==='/api/admin/privacy-requests'&&method==='POST')return true;
 if(method==='GET'&&path==='/api/admin/merchant-changes'||method==='POST'&&/^\/api\/admin\/merchant-changes\/[a-f0-9-]{36}$/.test(path))return true;
 if(['POST','PATCH'].includes(method)&&/^\/api\/admin\/qr\/[a-f0-9-]{36}$/.test(path))return true;
 if(method==='POST'&&/^\/api\/admin\/accounts\/[a-f0-9-]{36}$/.test(path))return true;
 if(config.unifiedAuthEnabled&&(method==='GET'&&['/api/auth/otp/status','/api/user/merchant-registration'].includes(path)||method==='POST'&&['/api/auth/register-user','/api/auth/registration/verify','/api/user/merchant-registration'].includes(path)))return true;
 if(menuReadAllowed(method,path)||socialMenuWriteAllowed(method,path)||stagingSettingsWriteAllowed(method,path))return true;
 if(registryPrecheckRoute(method,path))return true;
 if(method==='GET'&&path==='/api/admin/advertisements')return true;
 if(method==='POST'&&['/api/merchant/media-upload','/api/admin/media-upload'].includes(path))return true;
 if(reviewRequestAllowed(method,path))return true;
 if(config.otpLoginEnabled===true&&(path==='/api/merchant/registration'&&['GET','POST'].includes(method)||path==='/api/admin/merchant-registrations'&&method==='GET'||/^\/api\/admin\/merchant-registrations\/[a-f0-9-]{36}$/.test(path)&&method==='POST'||/^\/api\/(merchant|admin)\/registration-documents\/[a-f0-9-]{36}$/.test(path)&&method==='GET'))return true;
 if(method==="POST"&&["/api/admin/cms/media","/api/admin/cms/media/delete","/api/admin/cms/save","/api/admin/cms/publish","/api/admin/cms/restore"].includes(path))return true;
 if(['GET','POST'].includes(method)&&path==='/api/admin/cms/carousel')return true;
 if(['GET','POST'].includes(method)&&path==='/api/merchant/receiving-bank')return true;
 if(config.otpLoginEnabled===true&&method==='POST'&&['/api/auth/otp/request','/api/auth/otp/verify'].includes(path))return true;
 if(['GET','POST'].includes(method)&&path==='/api/merchant/villa-draft')return true;
 if(method==='GET'&&(path==='/api/auth/oauth/status'||/^\/api\/auth\/oauth\/(google|line)\/(start|callback)$/.test(path))||method==='POST'&&/^\/api\/auth\/oauth\/(google|line)\/(link|reauth)$/.test(path))return true;
 if(method==='POST'&&['/api/auth/recovery/request','/api/auth/recovery/verify'].includes(path))return true;
 if(method==='GET'&&['/api/admin/change-approvals','/api/admin/villa-pages','/api/merchant/analytics','/api/admin/checks','/api/merchant/owner-verification','/api/admin/owner-verification'].includes(path))return true;
 if(config.phoneRegistrationEnabled===true&&method==='POST'&&['/api/auth/register-phone','/api/auth/register-user-phone','/api/auth/registration/verify','/api/auth/otp/request','/api/auth/otp/verify'].includes(path))return true;
 if(method==='POST'&&['/api/auth/password','/api/auth/logout-all'].includes(path))return true;
 if(method==='GET'&&['/api/public/privacy-notice','/api/account/privacy-requests','/api/admin/privacy-requests'].includes(path))return true;
 if(method==='POST'&&path==='/api/account/privacy-requests')return true;
 if(method==='GET')return ['/api/admin/cms','/api/admin/cms/media','/api/admin/cms/history','/api/admin/accounts','/api/admin/qr','/api/admin/leads','/api/admin/settings','/api/admin/settings/demo-villas','/api/admin/readiness','/api/admin/acceptance','/api/admin/receiving-bank','/api/admin/reports','/api/admin/reviews','/api/merchant/reports','/api/user/profile','/api/user/summary','/api/user/checks','/api/reports','/api/reviews','/api/config','/api/health','/api/state','/api/packages','/api/admin/packages','/api/auth/me','/api/auth/admin-me','/api/ops/target-attestation','/api/merchant/profile','/api/merchant/property-media','/api/admin/property-media','/api/merchant/ownership-documents','/api/admin/ownership-documents'].includes(path)||/^\/api\/(public\/(cms|villas|advertisements|reviews|reports\/RPT-[a-zA-Z0-9-]+|qr\/[^/]+|villa-photo\/[a-f0-9-]+|property-media(?:-file\/[a-f0-9-]+)?|cms-media\/[a-f0-9-]+)|(?:admin\/)?documents\/[a-f0-9-]+)$/.test(path);
 if(method==='POST'&&['/api/merchant/profile','/api/user/profile','/api/user/checks','/api/reviews','/api/public/reports','/api/leads'].includes(path))return true;
 if(method==='POST'&&/^\/api\/reviews\/[a-f0-9-]+\/appeal$/.test(path))return true;
 if(method==='POST'&&(/^\/api\/admin\/reports\/[a-f0-9-]+$/.test(path)||/^\/api\/admin\/reviews\/[a-f0-9-]+\/moderate$/.test(path)))return true;
 if(method==='POST'&&['/api/auth/login','/api/auth/admin-login','/api/auth/logout','/api/auth/admin-logout','/api/villas'].includes(path))return true;
 return method==='POST'&&['/api/merchant/property-media','/api/admin/property-media','/api/merchant/ownership-documents','/api/admin/ownership-documents'].includes(path)||['POST','PATCH'].includes(method)&&/^\/api\/merchant\/villas\/[a-f0-9-]+$/.test(path)||method==='POST'&&/^\/api\/villas\/[a-f0-9-]+\/(review|resubmit)$/.test(path);
}
export async function beforeRequest(req,path,readBody,config={},db){
 if(config.otpLoginEnabled===true&&req.method==='POST'&&['/api/auth/otp/request','/api/auth/otp/verify'].includes(path)){
  const data=await readBody(req);req.body=data;
  if(path.endsWith('/request')){
   const role=data.accountType||'user',channel=data.channel,destination=otpDestination(channel,data.destination)
   if(!['login','register','link_identity'].includes(data.purpose||'login')||!['user','merchant',...(config.unifiedAuthEnabled?['auto']:[])].includes(role)||!['sms','email'].includes(channel))deny(400,'คำขอ OTP ไม่ถูกต้อง')
   // Public contacts are normalized and protected by OTP destination/IP quotas.
   void destination;
  }else{
   const marker=db&&typeof data.challengeId==='string'?await db.prepare('SELECT value FROM system_settings WHERE key=?').get('otp_login_identity:'+data.challengeId):null
   if(!marker)deny(401,'OTP ไม่ถูกต้องหรือหมดอายุ')
  }
  return
 }

 if(config.unifiedAuthEnabled&&req.method==='POST'&&['/api/auth/register-user','/api/auth/registration/verify'].includes(path))return;
 if(config.phoneRegistrationEnabled===true&&req.method==='POST'&&['/api/auth/register-phone','/api/auth/register-user-phone','/api/auth/registration/verify','/api/auth/otp/request','/api/auth/otp/verify'].includes(path)){
  const data=await readBody(req);req.body=data;
  if(path.endsWith('register-phone')||path.endsWith('register-user-phone')){
   const role=path.includes('register-user')?'user':'merchant',actor=[...scope.users,...scope.merchants].find(a=>a.pendingRegistration&&a.role===role&&a.email===data.email?.trim().toLowerCase());
   if(!actor||otpDestination('sms',data.phone)!==config.stagingRegistrationPhones?.[role]||!/^DEMO\b/.test(data.name||'')||role==='merchant'&&!/^DEMO\b/.test(data.businessNameEn||''))deny(403,'Explicit scoped phone registration required');
  }else if(path.endsWith('/registration/verify')){
   const record=db&&typeof data.challengeId==='string'?await db.prepare('SELECT value FROM system_settings WHERE key=?').get('password_registration:'+data.challengeId):null,pending=record?JSON.parse(record.value):null;
   if(!pending||![...scope.users,...scope.merchants].some(a=>a.pendingRegistration&&a.id===pending.allocatedUserId&&a.role===pending.role&&a.email===pending.email)||pending.phone!==config.stagingRegistrationPhones?.[pending.role])deny(403,'Scoped registration challenge required');
  }else if(path.endsWith('/otp/request')){
   const role=data.accountType||'user',phone=otpDestination('sms',data.destination),actor=[...scope.users,...scope.merchants].find(a=>a.pendingRegistration&&a.role===role);
   if(!db||data.channel!=='sms'||!['user','merchant'].includes(role)||(data.purpose||'login')!=='login'||!actor||phone!==config.stagingRegistrationPhones?.[role])deny(403,'Scoped phone login required');
   const identity=await db.prepare("SELECT user_id FROM oauth_identities WHERE provider='phone_otp' AND subject=?").get(phone);if(identity?.user_id!==actor.id)deny(409,'Complete scoped phone registration first');
  }else if(path.endsWith('/otp/verify')){
   const row=db&&typeof data.challengeId==='string'?await db.prepare('SELECT destination,account_type,purpose FROM login_otps WHERE id=?').get(data.challengeId):null;
   if(!row||row.purpose!=='login'||row.destination!==config.stagingRegistrationPhones?.[row.account_type])deny(403,'Scoped phone challenge required');
  }
 }
 if(!requestAllowed(req.method,path,config))deny(503,'Staging action not approved');
 if(req.method==='POST'&&path==='/api/leads'){const data=await readBody(req);req.body=data;if(data.type!=='USER'||!scope.users.some(a=>a.email===data.email)||!/^DEMO\b/.test(data.name||''))deny(403,'ใช้ข้อมูลติดต่อ E2E ที่กำหนดเท่านั้น');}
 if(req.method==='POST'&&['/api/auth/login','/api/auth/admin-login'].includes(path)){
  const data=await readBody(req);req.body=data;const role=path.includes('admin-login')?'admin':'merchant';
  if(!(config.unifiedAuthEnabled&&role!=='admin')&&!(role==='admin'&&stagingSetupAdmins.some(a=>a.email===data.email?.trim().toLowerCase()))&&!actors.some(a=>(role==='admin'?a.role==='admin':a.role!=='admin')&&a.email===data.email?.trim().toLowerCase()))deny(403,'Staging test actor required');
 }
}
export async function authorizeRequest(db,user,req,path,url,readBody,config={}){
 actorAllowed(user,config);
 if(path==='/api/admin/password-invitation'){if(user.role!=='admin')deny(403,'Admin required');return;}
 if(path.startsWith('/api/admin/merchant-changes')){if(user.role!=='admin')deny(403,'Admin required');return;}
 if(config.unifiedAuthEnabled&&user.role==='user'&&user.capabilities?.user===true&&req.method==='POST'&&path==='/api/user/checks')return;
 if(config.unifiedAuthEnabled&&user.role==='user'&&user.capabilities?.user===true&&user.primaryRole==='merchant'&&(req.method==='POST'&&path==='/api/user/scoped-report'||req.method==='GET'&&path==='/api/reports'))return;
 if(config.unifiedAuthEnabled&&user.role==='user'&&req.method==='POST'&&path==='/api/user/scoped-report'&&!builtActor(user)&&(user.basicPasswordAccount===true||user.publicOtpAccount===true||user.oauthPublicUser===true||user.primaryRole==='user'))return;
 const accountUpdate=path.match(/^\/api\/admin\/accounts\/([a-f0-9-]{36})$/);
 if(accountUpdate&&req.method==='POST'){
  if(user.role!=='admin')deny(403,'Admin required');
  const target=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(accountUpdate[1]);
  if(!target||!['user','merchant'].includes(target.role))deny(404,'User or Merchant account required');
  if(!builtActor(target)&&!await registeredPublicAccount(db,target,config))deny(403,'Protected Staging account');
  return;
 }
 const publicReportUpdate=path.match(/^\/api\/admin\/reports\/([a-f0-9-]{36})$/);
 if(config.unifiedAuthEnabled&&publicReportUpdate&&req.method==='POST'){
  if(user.role!=='admin')deny(403,'Admin required');
  const report=await db.prepare('SELECT user_id FROM support_reports WHERE id=?').get(publicReportUpdate[1]);
  const reporter=report?.user_id?await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(report.user_id):null;
  if(reporter&&['user','merchant'].includes(reporter.role)&&(builtActor(reporter)||await registeredPublicAccount(db,reporter,config)))return;
 }
 if(config.unifiedAuthEnabled&&['user','merchant'].includes(user.role)&&req.method==='POST'&&(['/api/auth/password','/api/auth/logout-all'].includes(path)||/^\/api\/auth\/oauth\/(google|line)\/(link|reauth)$/.test(path)))return;
 if(config.unifiedAuthEnabled&&path==='/api/user/merchant-registration'){if(user.role!=='user')deny(403,'User required');return;}
 if(user.role==='user'&&user.capabilities?.user&&(user.primaryRole==='merchant'||user.merchantProfileActive)&&['/api/user/profile','/api/user/summary','/api/user/checks'].includes(path))return;
 if(stagingSettingsWriteAllowed(req.method,path)){if(user.role!=='admin')deny(403,'Admin required');return;}
 if(registryPrecheckRoute(req.method,path)){assertRegistryPrecheckRole(user,path);return;}
 if(await registryBankDocumentAllowed(db,user,req.method,path))return;
 if(await stagingPropertyWorkflow(db,user,req,path,url,readBody,config))return;
 if(['/api/merchant/media-upload','/api/admin/media-upload'].includes(path)){if(user.role!==(path.includes('/admin/')?'admin':'merchant'))deny(403,'ไม่มีสิทธิ์อัปโหลดสื่อ');return;}
 if(reviewRequestAllowed(req.method,path)){if(!path.startsWith("/api/public/review-media/"))assertReviewRole(user,req.method,path);return;}
 if(config.otpLoginEnabled===true&&(path==='/api/merchant/registration'||/^\/api\/merchant\/registration-documents\/[a-f0-9-]{36}$/.test(path))){if(user.role!=='merchant')deny(403,'Merchant required');return;}
 if(config.otpLoginEnabled===true&&(path==='/api/admin/merchant-registrations'||/^\/api\/admin\/(merchant-registrations|registration-documents)\/[a-f0-9-]{36}$/.test(path))){if(user.role!=='admin')deny(403,'Admin required');return;}
 if(["/api/admin/cms/media","/api/admin/cms/media/delete","/api/admin/cms/save","/api/admin/cms/publish","/api/admin/cms/restore"].includes(path)){if(user.role!=="admin")deny(403,"Admin required");return;}
 if(config.otpLoginEnabled===true&&(user.publicOtpAccount===true||user.basicPasswordAccount===true||user.role==='merchant'&&user.oauthPublicUser===true)&&!builtActor(user)&&!(config.oauthExistingAccountsOnly===true&&user.role==='user'&&user.oauthPublicUser===true)){
  if(path.startsWith('/api/admin/')||path.startsWith('/api/auth/admin-'))deny(403,'Admin required');
  const shared=['/api/auth/me','/api/auth/logout','/api/auth/logout-all','/api/auth/password','/api/auth/oauth/status','/api/state','/api/packages','/api/account/privacy-requests'];
  const own=user.role==='merchant'?['/api/merchant/profile','/api/merchant/reports','/api/merchant/receiving-bank','/api/merchant/property-media','/api/merchant/ownership-documents','/api/merchant/owner-verification','/api/merchant/villa-draft']:['/api/user/profile','/api/user/summary','/api/user/checks','/api/reports','/api/reviews'];
  if(['user','merchant'].includes(user.role)&&req.method==='POST'&&['/api/auth/otp/request','/api/auth/otp/verify'].includes(path))return;
  if(req.method==='GET'&&[...shared,...own].includes(path)||req.method==='POST'&&['/api/auth/logout','/api/auth/logout-all','/api/account/privacy-requests',user.role==='merchant'?'/api/merchant/profile':'/api/user/profile',...(user.role==='merchant'?['/api/merchant/receiving-bank']:[])].includes(path))return;
  deny(403,'Account action is not enabled on Staging');
 }

 if(path==='/api/admin/cms/carousel'){if(user.role!=='admin')deny(403,'Admin required');return;}
 if(!builtActor(user)&&config.oauthExistingAccountsOnly===true&&user.role==='user'&&user.oauthPublicUser===true){
  const ownReads=['/api/auth/me','/api/auth/oauth/status','/api/user/profile','/api/user/summary','/api/user/checks','/api/reports','/api/reviews','/api/account/privacy-requests'];
  const ownWrites=['/api/auth/logout','/api/auth/logout-all','/api/auth/password','/api/user/profile','/api/account/privacy-requests'];
  if(req.method==='GET'&&ownReads.includes(path)||req.method==='POST'&&(ownWrites.includes(path)||/^\/api\/auth\/oauth\/(google|line)\/(link|reauth)$/.test(path)))return;
  deny(403,'Public OAuth User access is limited to own account on Staging');
 }
 if(!builtActor(user)&&otpLoginStagingUser(user,config)){
  const ownReads=['/api/auth/me','/api/user/profile','/api/user/summary','/api/user/checks','/api/reports','/api/reviews'];
  if(req.method==='GET'&&ownReads.includes(path)||req.method==='POST'&&path==='/api/auth/logout')return;
  deny(403,'OTP test User access is limited to own read-only account and logout');
 }
 if(path.includes('/auth/'))return;
 if(path==='/api/merchant/receiving-bank'){if(user.role!=='merchant'||!(scope.merchants.some(actor=>actor.id===user.id&&actor.email===user.email&&actor.role===user.role)||config.unifiedAuthEnabled===true&&user.primaryRole==='user'&&user.merchantProfileActive===true&&user.capabilities?.merchant===true))deny(403,'เฉพาะข้อมูลบัญชี Merchant ของตนเอง');return;}
 if(req.method==='GET'&&path==='/api/admin/checks'){if(user.role!=='admin')deny(403,'Admin required');req.stagingCheckScope=await stagingAdminCheckScope(db,config);return;}
 if(path==='/api/account/privacy-requests'||path==='/api/admin/privacy-requests')return;
 if(path==='/api/merchant/villa-draft'){if(user.role!=='merchant'||!(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(user.id))deny(403,'ฉบับร่างสำหรับ Merchant E2E ใหม่เท่านั้น');return;}
 if(path==='/api/merchant/profile'&&req.method==='POST'){if(user.role!=='merchant'||!(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(user.id))deny(403,'แก้ไขได้เฉพาะข้อมูล Merchant E2E ใหม่');return;}
 const appeal=path.match(/^\/api\/reviews\/([a-f0-9-]+)\/appeal$/);if(appeal){const row=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('customer_review:'+appeal[1]))?.value||'null');if(!scope.users.some(a=>a.id===user.id)||row?.userId!==user.id||!scope.merchants.filter(a=>(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(a.id)).flatMap(a=>a.villaIds).includes(row?.villaId))deny(403,'ทบทวนได้เฉพาะรีวิว E2E ของตนเอง');return;}
 const reportMatch=path.match(/^\/api\/admin\/reports\/([a-f0-9-]+)$/),reviewMatch=path.match(/^\/api\/admin\/reviews\/([a-f0-9-]+)\/moderate$/);
 if(path==='/api/admin/reports'||path==='/api/admin/reviews'||reportMatch||reviewMatch){
  if(user.role!=='admin')deny(403,'เฉพาะ Admin ที่ได้รับสิทธิ์');
  if(reportMatch||reviewMatch){const row=reportMatch?await db.prepare('SELECT user_id,villa_id FROM support_reports WHERE id=?').get(reportMatch[1]):JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('customer_review:'+reviewMatch[1]))?.value||'null');
   if(!row||!(scope.users.some(a=>a.id===(row.user_id||row.userId)))||!scope.merchants.filter(a=>(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(a.id)).flatMap(a=>a.villaIds).includes(row.villa_id||row.villaId))deny(403,'ข้อมูลเดิมอยู่นอกขอบเขต E2E');
  }return;
 }

 if(path.startsWith('/api/user/')||['/api/reports','/api/reviews'].includes(path)){
  if(!scope.users.some(a=>a.id===user.id))deny(403,'Allocated User required');
  if(req.method==='POST'&&['/api/user/checks','/api/reviews','/api/user/scoped-report'].includes(path)){
   const data=await readBody(req);req.body=data;
   let villa=await db.prepare('SELECT id,owner_id,qr FROM villas WHERE qr=?').get(data.qr||'');if(!villa&&path==='/api/user/scoped-report'&&typeof data.villa==='string'){const matches=await db.prepare('SELECT id,owner_id,qr FROM villas WHERE name=? AND owner_id IN ('+(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).map(()=>'?').join(',')+')').all(data.villa,...(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]));if(matches.length===1&&matches[0].qr){villa=matches[0];data.qr=villa.qr;}}
   if(!(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(villa?.owner_id)||!scope.merchants.filter(a=>(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(a.id)).flatMap(a=>a.villaIds).includes(villa?.id))deny(403,'Checks restricted to new test Villas');
  }
  return;
 }
 if(req.method==='GET'){
  const doc=path.match(/^\/api\/(?:admin\/)?documents\/([a-f0-9-]+)$/);
  if(doc){const row=await db.prepare('SELECT owner_id FROM documents WHERE id=?').get(doc[1]);if(!scope.merchants.some(a=>a.id===row?.owner_id))deny(404,'Document unavailable')}
  if(!path.includes('property-media')&&!path.includes('ownership-documents'))return;
 }
 const data=req.method==='GET'?{}:await readBody(req);if(req.method!=='GET')req.body=data;
 if(path==='/api/villas'){
  const merchant=scope.merchants.find(a=>a.id===user.id);
  if(!(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(user.id))deny(403,'Existing DEMO business records are read-only');
  if(!merchant||data.email!==merchant.email||!/^DEMO\b/.test(data.name||'')||!/^DEMO\b/.test(data.nameEn||'')||data.photoUrl)deny(403,'Explicit DEMO input required');
  const replayId=await replayedVillaCreate(db,user,data,merchant.villaIds);if(replayId){req.stagingVillaId=replayId;return;}
  const existing=await db.prepare('SELECT id FROM villas WHERE owner_id=?').all(user.id);
  if(existing.some(v=>!merchant.villaIds.includes(v.id)))deny(403,'Unexpected existing Villa');
  const id=merchant.villaIds.find(id=>!existing.some(v=>v.id===id));if(!id)deny(409,'Approved test Villa allocation exhausted');req.stagingVillaId=id;return;
 }
 const matched=path.match(/^\/api\/(?:merchant\/villas|villas|admin\/qr)\/([a-f0-9-]+)/),id=matched?.[1]||data.villaId||url.searchParams.get('villaId');
 const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(id||'');
 const owner=scope.merchants.find(a=>a.id===villa?.owner_id&&a.villaIds.includes(id));
 if(req.method!=='GET'&&!(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(villa?.owner_id))deny(403,'Existing DEMO business records are read-only');
 if(!owner||scope.protectedVillaIds.includes(id)||villa.email!==owner.email)deny(403,'Original and unallocated Villas are protected');
 if(user.role==='merchant'&&villa.owner_id!==user.id||path.includes('/merchant/')&&user.role!=='merchant'||path.includes('/admin/')&&user.role!=='admin'||path.endsWith('/review')&&user.role!=='admin')deny(403,'Role rejected');
 if(path.includes('/merchant/villas/')&&(!/^DEMO\b/.test(data.name||'')||!/^DEMO\b/.test(data.nameEn||'')))deny(400,'Keep DEMO disclosure');
}
export async function verifyRuntime(db,env){
 if(env.APP_ENV!=='staging'||env.VERCEL_PROJECT_ID!==scope.target.vercelProjectId)deny(503,'Staging target rejected');
 const actual=await db.prepare('SELECT current_database() AS database,current_schema() AS schema,current_user AS role').get();
 if(['database','schema','role'].some(k=>actual[k]!==scope.target[k]))deny(503,'Staging SQL identity rejected');
 const provisionedActors=actors.filter(a=>!a.pendingRegistration);
 const rows=await db.prepare('SELECT id,email,role FROM users WHERE id IN ('+provisionedActors.map(()=>'?').join(',')+')').all(...provisionedActors.map(a=>a.id));
 if(rows.length!==provisionedActors.length)deny(503,'Separately approved provisioning required');for(const row of rows)actorAllowed(row);
 const protectedRows=await db.prepare('SELECT id,owner_id FROM villas WHERE id IN ('+scope.protectedVillaIds.map(()=>'?').join(',')+')').all(...scope.protectedVillaIds);
 if(protectedRows.length!==57||protectedRows.some(v=>scope.merchants.some(a=>a.id===v.owner_id)))deny(503,'Protected baseline ownership mismatch');
}
