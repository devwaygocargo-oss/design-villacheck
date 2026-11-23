import {preparePhoneChange,phoneChangeStillValid} from './phone-profile.mjs';
// Public role-separated OTP signup/login. Legacy OAuth/MFA/recovery stay separate.
import {findRoleOtpContact,roleOtpContactVerified,completeRoleOtpContact,profileOtpPhoneMatches} from './role-otp-contacts.mjs';
import {randomBytes,randomInt,randomUUID,createHash,createHmac,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {cmsBusiness,cmsLoginConfig,otpTemplate} from './cms-business.mjs';
const invalid=()=>Object.assign(Error('OTP ไม่ถูกต้องหรือหมดอายุ'),{status:401,code:'OTP_INVALID'});
const fail=(status,message,extra={})=>{throw Object.assign(Error(message),{status,...extra});};
const markerKey=id=>'otp_login_identity:'+id;
const validNonce=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const createOtpLoginNonce=()=>randomBytes(32).toString('hex');
const digest=(config,value)=>createHmac('sha256',config.otpSecret).update(value).digest('hex');
const browserHash=(config,nonce)=>validNonce(nonce)?digest(config,'primary-otp-browser:'+nonce):null;
const sameHash=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const codeHash=(config,id,code)=>'hmac:'+digest(config,'primary-otp-code:'+id+':'+code);
const windowOpen=config=>!config.otpLoginAllowedUntil||(Number.isFinite(Date.parse(config.otpLoginAllowedUntil))&&Date.parse(config.otpLoginAllowedUntil)>Date.now());
export function primaryOtpTiming(config){const testing=config.appEnvironment==='test'&&config.otpLoginTestTiming===true;const provider=testing&&Number.isInteger(config.otpLoginProviderTimeoutMs)?Math.max(1,Math.min(1000,config.otpLoginProviderTimeoutMs)):15000;return{providerTimeoutMs:provider,invalidDelayMs:testing&&Number.isInteger(config.otpLoginInvalidDelayMs)?Math.max(provider+20,Math.min(2000,config.otpLoginInvalidDelayMs)):16000};}
async function deadline(work,ms,code='OTP_PROVIDER_TIMEOUT'){let timer;const abort=new AbortController();try{return await Promise.race([Promise.resolve().then(()=>work(abort.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Object.assign(Error('OTP delivery timeout'),{code}));},ms);})]);}finally{clearTimeout(timer);}}
async function invalidAfter(start,delay){const remaining=delay-(performance.now()-start);if(remaining>0)await new Promise(r=>setTimeout(r,remaining));throw invalid();}
function encrypt(config,token){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update(config.otpSecret).digest(),iv),bytes=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);return'tbs:'+Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');}
function decrypt(config,value){const bytes=Buffer.from(value.slice(4),'base64');if(bytes.length<29)throw invalid();const cipher=createDecipheriv('aes-256-gcm',createHash('sha256').update(config.otpSecret).digest(),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');}
const readMarker=async(db,id)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(markerKey(id));try{return row?JSON.parse(row.value):null;}catch{return null;}};
const providerCodes=Object.freeze({'108':'ERROR_USER_TRIAL','116':'ERROR_INSUFFICIENT_CREDIT','110':'ERROR_SENDER','111':'ERROR_SENDER_NOT_FOUND',ERROR_USER_TRIAL:'ERROR_USER_TRIAL',ERROR_INSUFFICIENT_CREDIT:'ERROR_INSUFFICIENT_CREDIT',ERROR_SENDER:'ERROR_SENDER',ERROR_SENDER_NOT_FOUND:'ERROR_SENDER_NOT_FOUND'});
const smtpCodes=new Set(['EAUTH','ECONNECTION','ETIMEDOUT','ESOCKET','ECONNREFUSED','ECONNRESET','ENOTFOUND','EAI_AGAIN','EDNS','ETLS','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','EENVELOPE','EMESSAGE']);
const networkCodes=new Set(['ECONNREFUSED','ECONNRESET','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID']);
// This is an allowlist projection, never a scrubbed copy of provider text. A
// provider can echo a PIN/token/recipient in any field, including its error code.
export function safeOtpDeliveryDiagnostic(error,{phase='PROVIDER'}={}){
 const safePhase=['LOOKUP','ELIGIBILITY','PROVIDER','PERSISTENCE','RECOVERY','WORKER'].includes(phase)?phase:'WORKER';
 const result={phase:safePhase,category:safePhase==='PROVIDER'?'PROVIDER_FAILURE':'DELIVERY_STATE_FAILURE'};
 if(error?.code==='OTP_PROVIDER_TIMEOUT')result.category='PROVIDER_TIMEOUT';
 else if(['OTP_DELIVERY_LOOKUP_TIMEOUT','OTP_DELIVERY_STATE_TIMEOUT'].includes(error?.code))result.category='DELIVERY_STATE_TIMEOUT';
 else if(safePhase==='PROVIDER'&&smtpCodes.has(error?.code)){result.smtpErrorCode=error.code;result.category=error.code==='EAUTH'?'SMTP_AUTHENTICATION':error.code==='ETIMEDOUT'?'SMTP_TIMEOUT':['ETLS','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID'].includes(error.code)?'SMTP_TLS':error.code==='EENVELOPE'?'SMTP_RECIPIENT_OR_SENDER_REJECTED':'SMTP_CONNECTION_OR_DELIVERY';}
 const status=error?.otpProviderHttpStatus;
 if(Number.isInteger(status)&&status>=200&&status<=599){result.providerHttpStatus=status;result.category=status===401||status===403?'PROVIDER_AUTHENTICATION':status===429?'PROVIDER_RATE_LIMIT':status>=500?'PROVIDER_SERVICE_UNAVAILABLE':'PROVIDER_REJECTED';}
 if(Object.hasOwn(providerCodes,error?.otpProviderDeclaredCode))result.providerErrorCode=providerCodes[error.otpProviderDeclaredCode];
 if(safePhase==='PROVIDER'&&Number.isInteger(error?.responseCode)&&error.responseCode>=400&&error.responseCode<=599)result.smtpResponseCode=error.responseCode;
 if(safePhase==='PROVIDER'&&networkCodes.has(error?.cause?.code)){result.networkErrorCode=error.cause.code;result.category=['CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID'].includes(error.cause.code)?'PROVIDER_TLS':['ENOTFOUND','EAI_AGAIN'].includes(error.cause.code)?'PROVIDER_DNS':'PROVIDER_NETWORK';}
 return result;
}
function providerRejected(response){return Object.assign(Error('OTP provider rejected delivery'),{otpProviderHttpStatus:response.status,otpProviderDeclaredCode:response.value?.code??response.value?.error?.code??response.value?.error_code});}
export function createPrimaryOtpLogin(db,config,{otpChannels,otpDestination,transport,fetchProvider}){
 const jobs=new Map(),timing=primaryOtpTiming(config),effective=()=>({...config,...config.otpLoginProviderConfig,otpSecret:config.otpSecret,otpLoginOnly:true}),smtp=()=>config.otpLoginTransport||transport;
 // Optional recipient scope is a delivery restriction, never proof of identity.
 // Empty/default scope preserves approved public signup after separate activation.
 const smsAllowed=destination=>{const scope=Object.hasOwn(config,'otpLoginPhoneAllowlist')?config.otpLoginPhoneAllowlist:config.otpLoginProviderConfig?.otpLoginPhoneAllowlist;return scope===undefined||Array.isArray(scope)&&scope.length<=100&&scope.every(phone=>typeof phone==='string'&&/^\+66[689]\d{8}$/.test(phone))&&(!scope.length||scope.includes(destination));};
 const assertSmsAllowed=(channel,destination)=>{if(channel==='sms'&&!smsAllowed(destination))fail(403,'OTP ยังไม่พร้อมใช้งาน',{code:'OTP_SMS_SCOPE_UNAVAILABLE'});};
 const deliverySettings=async()=>{const settings=await cmsLoginConfig(db,effective());if(config.otpLoginProviderConfig&&Object.hasOwn(config.otpLoginProviderConfig,'thaiBulkSmsEmailOtpTemplateId')&&!config.otpLoginProviderConfig.thaiBulkSmsEmailOtpTemplateId)settings.thaiBulkSmsEmailOtpTemplateId=undefined;return settings;};
 const diagnostic=async(channel,ok,reason,details={})=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('otp_login_'+(ok?'delivery_':'failure_')+channel,JSON.stringify({ok,reason,...details,at:new Date().toISOString()}));
 async function eligible(row,marker){
  if(!windowOpen(config)||marker?.policy!=='EXISTING_ACCOUNT_LOGIN'||!['user','merchant'].includes(row.account_type)||marker.role!==row.account_type||marker.channel!==row.channel||marker.purpose!==row.purpose)return null;
  if(row.channel==='sms'&&!smsAllowed(row.destination))return null;
  const contact=await findRoleOtpContact(db,row.account_type,row.channel,row.destination);
  if(marker.purpose==='link_identity'){
   const user=await db.prepare('SELECT * FROM users WHERE id=? AND role=?').get(marker.userId,row.account_type);
   const access=user&&await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+user.id);
   return user&&(!access||JSON.parse(access.value).status!=='suspended')&&(!contact||contact.id===user.id)&&(!marker.phoneChange||await phoneChangeStillValid(db,user.id,user.role,marker.phoneChange))?user:null;
  }
  if(marker.unified&&!marker.userId&&row.purpose==='login'){const other=await findRoleOtpContact(db,row.account_type==='user'?'merchant':'user',row.channel,row.destination);if(other||row.channel==='email'&&await db.prepare('SELECT id FROM users WHERE email=?').get(row.destination))return null;}
  if(!marker.userId)return !contact&&(row.account_type==='user'&&marker.purpose==='login'||row.account_type==='merchant'&&marker.purpose==='register')?{pendingRegistration:true}:null;
  if(!contact||contact.id!==marker.userId||contact.role!==row.account_type)return null;
  const status=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+contact.id);
  if(status&&JSON.parse(status.value).status==='suspended')return null;
  // Sending to the exact stored email grants nothing; successful OTP proof
  // verifies the contact on the same identity, including legacy password users.
  return marker.unified&&row.purpose==='login'&&row.channel==='email'&&contact.email===row.destination||await roleOtpContactVerified(db,contact,row.channel,row.destination)||row.channel==='sms'&&await profileOtpPhoneMatches(db,contact,row.destination)?contact:null;
 }
 async function providerCall(settings,url,payload,signal,form=false){const response=await fetchProvider(url,{method:'POST',headers:form?{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'}:{Accept:'application/json','Content-Type':'application/json',Authorization:'Basic '+Buffer.from(settings.thaiBulkSmsApiKey+':'+settings.thaiBulkSmsApiSecret).toString('base64')},body:form?new URLSearchParams({key:settings.thaiBulkSmsOtpKey,secret:settings.thaiBulkSmsOtpSecret,...payload}).toString():JSON.stringify(payload),signal,redirect:'error'});let value;try{value=await response.json();}catch{throw Object.assign(Error('OTP provider invalid response'),{otpProviderHttpStatus:response.status});}return{ok:response.ok,status:response.status,value};}
 async function unavailable(id,details){
  // Recovery never retries a provider send. It may only close this exact queued
  // existing-login challenge; transaction rollback preserves other security data.
  return db.transaction(async()=>{
   const row=await db.prepare('SELECT * FROM login_otps WHERE id=?').get(id),marker=await readMarker(db,id);
   if(!row||row.consumed||marker?.policy!=='EXISTING_ACCOUNT_LOGIN'||marker.deliveryState!=='PENDING')return false;
   await db.prepare('UPDATE login_otps SET code_hash=?,consumed=1 WHERE id=?').run('otp-unavailable',id);
   await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...marker,deliveryState:'UNAVAILABLE'}),markerKey(id));
   await diagnostic(row.channel,false,'DELIVERY_STATE_FAILED',details);
   return true;
  },{timeout:8000});
 }
 async function deliver(id,code,business,settings,channel){
  let phase='LOOKUP',row,marker,hash=null,reason='IDENTITY_NOT_ELIGIBLE',details={phase:'ELIGIBILITY',category:'IDENTITY_NOT_ELIGIBLE'};
  try{
   const found=await deadline(async()=>{const entry=await db.prepare('SELECT * FROM login_otps WHERE id=?').get(id),identity=await readMarker(db,id);return{row:entry,marker:identity};},8000,'OTP_DELIVERY_LOOKUP_TIMEOUT');
   row=found.row;marker=found.marker;
   if(!row||row.consumed||Number(row.expires)<=Date.now()||marker?.deliveryState!=='PENDING')return{status:'SKIPPED'};
   phase='ELIGIBILITY';
   const user=await deadline(()=>eligible(row,marker),8000,'OTP_DELIVERY_LOOKUP_TIMEOUT');
   if(user){
    phase='PROVIDER';
    try{
     hash=await deadline(async signal=>{
      if(row.channel==='email'&&settings.thaiBulkSmsEmailOtpTemplateId){
       const r=await providerCall(settings,'https://email-api.thaibulksms.com/email/v1/otp/send',{template_uuid:settings.thaiBulkSmsEmailOtpTemplateId,recipient_email:row.destination,payload:{}},signal);
       if(!r.ok||!['success','waiting'].includes(r.value?.status)||typeof r.value.token!=='string'||!r.value.token||r.value.token.length>4096)throw providerRejected(r);
       return encrypt(config,r.value.token);
      }
      if(row.channel==='email'){
       const receipt=await smtp().sendMail({from:settings.smtpFrom,to:row.destination,subject:business.emailOtpSubject,text:otpTemplate(business.emailOtpBody,code)});
       if(config.unifiedAuthEnabled&&(!Array.isArray(receipt?.accepted)||!receipt.accepted.some(value=>String(value).toLowerCase()===row.destination.toLowerCase())))throw Object.assign(Error('OTP email not accepted'),{code:'EENVELOPE'});
       return codeHash(config,id,code);
      }
      if(settings.thaiBulkSmsOtpKey&&settings.thaiBulkSmsOtpSecret){
       const r=await providerCall(settings,'https://otp.thaibulksms.com/v2/otp/request',{msisdn:row.destination.slice(1)},signal,true);
       if(!r.ok||r.value?.status!=='success'||typeof r.value.token!=='string'||!r.value.token||r.value.token.length>4096)throw providerRejected(r);
       return encrypt(config,r.value.token);
      }
      const r=await fetchProvider('https://api-v2.thaibulksms.com/sms',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(settings.thaiBulkSmsApiKey+':'+settings.thaiBulkSmsApiSecret).toString('base64'),Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({msisdn:row.destination.slice(1),message:otpTemplate(business.smsOtpBody,code),sender:settings.thaiBulkSmsSender}).toString(),signal,redirect:'error'}),v=await r.json();
      if(!r.ok||!v.phone_number_list?.some(p=>typeof p.number==='string'&&p.number.replace(/^\+/,'')===row.destination.slice(1)&&typeof p.message_id==='string'&&p.message_id))throw providerRejected({status:r.status,value:v});
      return codeHash(config,id,code);
     },timing.providerTimeoutMs);
     details={phase:'PROVIDER',category:'PROVIDER_ACCEPTED'};
    }catch(error){reason='PROVIDER_DELIVERY_FAILED';details=safeOtpDeliveryDiagnostic(error,{phase});}
   }
   phase='PERSISTENCE';
   return await db.transaction(async()=>{
    const current=await db.prepare('SELECT consumed,expires FROM login_otps WHERE id=?').get(id),latest=await readMarker(db,id);
    if(!current||current.consumed||latest?.deliveryState!=='PENDING')return{status:'SKIPPED'};
    if(!windowOpen(config)||Number(current.expires)<=Date.now()){hash=null;reason='DELIVERY_WINDOW_CLOSED';details={phase:'PERSISTENCE',category:'DELIVERY_WINDOW_CLOSED'};}
    await db.prepare('UPDATE login_otps SET code_hash=?,consumed=? WHERE id=?').run(hash||'otp-unavailable',hash?0:1,id);
    await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...latest,deliveryState:hash?'READY':'UNAVAILABLE'}),markerKey(id));
    await diagnostic(row.channel,Boolean(hash),hash?'PROVIDER_ACCEPTED':reason,details);
    return{status:hash?'READY':'UNAVAILABLE'};
   },{timeout:8000});
  }catch(error){
   const failure=safeOtpDeliveryDiagnostic(error,{phase});
   try{await unavailable(id,failure);return{status:'UNAVAILABLE',stateFailure:true};}
   catch{
    // DB unavailable cannot be repaired in memory. Leave verification failclosed
    // and surface fixed private diagnostics rather than silently dropping it.
    console.error(JSON.stringify({event:'OTP_LOGIN_DELIVERY_STATE_FAILED',channel:['email','sms'].includes(channel)?channel:'unknown',...failure}));
    throw Object.assign(Error('OTP delivery state persistence failed'),{code:'OTP_DELIVERY_STATE_FAILED'});
   }
  }finally{code=undefined;hash=null;}
 }
 return{
  async request(data,options={}){
   if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'คำขอ OTP ไม่ถูกต้อง');
   let role=data.accountType||'user';const purpose=data.purpose||'login';
   if(config.unifiedAuthEnabled&&purpose==='register')fail(400,'เข้าสู่ระบบบัญชี User ก่อนสมัคร Merchant');
   if(config.unifiedAuthEnabled&&purpose==='login'){
    const destination=otpDestination(data.channel,data.destination);assertSmsAllowed(data.channel,destination);const accounts=(await Promise.all(['user','merchant'].map(r=>findRoleOtpContact(db,r,data.channel,destination)))).filter(Boolean);
    if(accounts.length>1&&role==='auto')fail(409,'ช่องทางนี้ตรงกับบัญชีเดิมหลายบัญชี กรุณาเลือกประเภทบัญชีเดิม',{code:'ACCOUNT_CHOICE_REQUIRED'});
    if(accounts.length<2)role=accounts[0]?.role||'user';
   }
   if(!['user','merchant'].includes(role)||!['login','register','link_identity'].includes(purpose)||purpose==='register'&&role!=='merchant')fail(400,'คำขอ OTP ไม่ถูกต้อง');
   if(purpose==='link_identity'&&options.bindingUser?.role!==role)fail(403,'เข้าสู่ระบบบัญชีเดิมก่อนเชื่อมช่องทางเข้าสู่ระบบ');
   let registration;
   if(purpose==='register'){
    if(config.merchantRegistrationDocumentsEnabled===false)fail(503,'ยังไม่เปิดรับสมัคร Merchant ด้วยเอกสาร');
    if(typeof data.registration?.name!=='string'||!data.registration.name.trim()||data.registration.name.length>200||typeof data.registration.businessNameEn!=='string'||!data.registration.businessNameEn.trim()||data.registration.businessNameEn.length>200)fail(400,'กรอกชื่อ Merchant ภาษาไทยและภาษาอังกฤษ');
    registration={name:data.registration.name.trim(),businessNameEn:data.registration.businessNameEn.trim()};
   }
   if(typeof config.otpSecret!=='string'||config.otpSecret.length<32)fail(503,'OTP ยังไม่พร้อมใช้งาน');const channel=data.channel,destination=otpDestination(channel,data.destination);if(channel==='sms'&&!config.unifiedAuthEnabled&&!/^\+66[689]\d{8}$/.test(destination))fail(400,'กรอกหมายเลขมือถือไทยให้ถูกต้อง');const browser=browserHash(config,options.browserNonce);if(!browser)throw invalid();
   if(/[\x00-\x1f\x7f]/.test(destination))fail(400,'อีเมลหรือเบอร์โทรไม่ถูกต้อง');
   assertSmsAllowed(channel,destination);
   const identity=await findRoleOtpContact(db,role,channel,destination);
   // Current business flow explicitly sends unknown Merchant contacts straight
   // to registration. Never create an undeliverable login challenge for them.
   if(role==='merchant'&&purpose==='login'&&!identity)return{registrationRequired:true,nextAction:'register'};
   const settings=await deliverySettings(),business=await cmsBusiness(db);if(!windowOpen(config)||!otpChannels(settings,smtp())[channel])fail(503,channel==='email'?'ยังไม่ได้ตั้งค่าการส่ง OTP ทางอีเมล':'ยังไม่ได้ตั้งค่าการส่ง OTP ทาง SMS');
   if(purpose==='register'&&identity)fail(409,'ช่องทางนี้มีบัญชี Merchant แล้ว กรุณาเข้าสู่ระบบ');
   if(purpose==='link_identity'&&identity&&identity.id!==options.bindingUser.id)fail(409,'ช่องทางนี้ผูกกับบัญชีอื่นแล้ว กรุณาใช้ช่องทางอื่น');
   const phoneChange=purpose==='link_identity'&&channel==='sms'?await preparePhoneChange(db,options.bindingUser,destination,data):null;
   const id=randomUUID(),now=Date.now(),row={id,channel,destination,account_type:role,purpose};
   const marker={policy:'EXISTING_ACCOUNT_LOGIN',unified:config.unifiedAuthEnabled===true,userId:purpose==='link_identity'?options.bindingUser.id:identity?.id||null,role,channel,purpose,registration,...(phoneChange?{phoneChange:phoneChange.snapshot}:{}),browserHash:browser,deliveryState:'PENDING'};
   await db.transaction(async()=>{
    if(phoneChange)await phoneChange.reserve();
    const stale=await db.prepare("SELECT l.id FROM login_otps l JOIN system_settings s ON s.key='otp_login_identity:'||l.id WHERE l.created<? AND l.expires<? ORDER BY l.created LIMIT 100").all(now-86400000,now);
    for(const old of stale){await db.prepare('DELETE FROM system_settings WHERE key=?').run(markerKey(old.id));await db.prepare('DELETE FROM login_otps WHERE id=?').run(old.id);}
    const previous=await db.prepare("SELECT l.* FROM login_otps l JOIN system_settings s ON s.key='otp_login_identity:'||l.id WHERE l.channel=? AND l.destination=? ORDER BY l.created DESC").all(channel,destination);const last=previous[0];if(last&&now-Number(last.created)<60000)fail(429,'กรุณารอ 60 วินาทีก่อนขอ OTP ใหม่',{code:'OTP_RATE_LIMITED',retryAfter:Math.max(1,Math.ceil((60000-now+Number(last.created))/1000))});const recent=previous.filter(p=>Number(p.created)>now-3600000);if(recent.length>=5)fail(429,'ขอ OTP ครบจำนวนที่อนุญาต กรุณาลองอีกครั้งภายหลัง',{code:'OTP_RATE_LIMITED',retryAfter:Math.max(1,Math.ceil((Math.min(...recent.map(p=>Number(p.created)))+3600000-now)/1000))});for(const old of previous.filter(p=>!p.consumed))await db.prepare('UPDATE login_otps SET consumed=1 WHERE id=?').run(old.id);await db.prepare('INSERT INTO login_otps(id,channel,destination,code_hash,expires,created,account_type,binding_user_id,purpose) VALUES (?,?,?,?,?,?,?,?,?)').run(id,channel,destination,'otp-pending',now+300000,now,role,purpose==='link_identity'?options.bindingUser.id:null,purpose);await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(markerKey(id),JSON.stringify(marker));});
   const code=String(randomInt(0,1000000)).padStart(6,'0');jobs.set(id,()=>deliver(id,code,business,settings,channel));return{challengeId:id,expiresAt:new Date(now+300000).toISOString(),resendAfter:60};
  },
  async status(id,nonce){
   if(typeof id!=='string'||!/^[-a-f0-9]{36}$/.test(id))throw invalid();
   const row=await db.prepare('SELECT expires,consumed FROM login_otps WHERE id=?').get(id),marker=await readMarker(db,id);
   if(!row||marker?.policy!=='EXISTING_ACCOUNT_LOGIN'||!sameHash(marker.browserHash,browserHash(config,nonce)))throw invalid();
   return{state:Number(row.expires)<=Date.now()?'EXPIRED':row.consumed&&marker.deliveryState!=='UNAVAILABLE'?'CONSUMED':marker.deliveryState,expiresAt:new Date(Number(row.expires)).toISOString()};
  },
  async runDeliveries(){const pending=[...jobs.values()];jobs.clear();const results=await Promise.allSettled(pending.map(work=>work()));if(results.some(result=>result.status==='rejected'))throw Object.assign(Error('OTP delivery state persistence failed'),{code:'OTP_DELIVERY_STATE_FAILED'});return{queued:pending.length,ready:results.filter(result=>result.value?.status==='READY').length,unavailable:results.filter(result=>result.value?.status==='UNAVAILABLE').length};},
  async verify(data,options={}){
   const start=performance.now();if(typeof data?.challengeId!=='string'||!/^[-a-f0-9]{36}$/.test(data.challengeId)||typeof data?.code!=='string'||!/^\d{6}$/.test(data.code)||!windowOpen(config)||typeof config.otpSecret!=='string'||config.otpSecret.length<32)return invalidAfter(start,timing.invalidDelayMs);
   const browser=browserHash(config,options.browserNonce);const reservation=await db.transaction(async()=>{const row=await db.prepare('SELECT * FROM login_otps WHERE id=?').get(data.challengeId),marker=await readMarker(db,data.challengeId);if(!row||row.consumed||Number(row.expires)<=Date.now()||row.attempts>=5||!['login','register','link_identity'].includes(row.purpose)||marker?.purpose!==row.purpose||row.purpose==='link_identity'&&(!options.bindingUser||row.binding_user_id!==options.bindingUser.id||marker.userId!==options.bindingUser.id||options.bindingUser.role!==row.account_type)||marker?.policy!=='EXISTING_ACCOUNT_LOGIN'||!sameHash(marker.browserHash,browser)||marker.deliveryState==='PENDING')return null;await db.prepare('UPDATE login_otps SET attempts=attempts+1 WHERE id=?').run(row.id);if(marker.deliveryState!=='READY'||!await eligible(row,marker))return null;return{row,marker};});
   if(!reservation)return invalidAfter(start,timing.invalidDelayMs);const {row,marker}=reservation;let valid=false;
   try{if(row.code_hash.startsWith('hmac:'))valid=sameHash(row.code_hash.slice(5),codeHash(config,row.id,data.code).slice(5));else if(row.code_hash.startsWith('tbs:')){const settings=await deliverySettings(),token=decrypt(config,row.code_hash);valid=await deadline(async signal=>{const r=row.channel==='email'?await providerCall(settings,'https://email-api.thaibulksms.com/email/v1/otp/verify',{token,otp_code:data.code},signal):await providerCall(settings,'https://otp.thaibulksms.com/v2/otp/verify',{token,pin:data.code},signal,true);return r.ok&&(row.channel==='email'?['success','verified'].includes(r.value.status):r.value.status==='success');},timing.providerTimeoutMs);}}catch{valid=false;await diagnostic(row.channel,false,'PROVIDER_VERIFY_FAILED');}
   if(!valid)return invalidAfter(start,timing.invalidDelayMs);
   const result=await db.transaction(async()=>{const current=await db.prepare('SELECT * FROM login_otps WHERE id=?').get(row.id),latest=await readMarker(db,row.id);if(!current||current.consumed||Number(current.expires)<=Date.now()||current.code_hash!==row.code_hash||latest?.deliveryState!=='READY'||!sameHash(latest.browserHash,browser)||latest.userId!==marker.userId)return null;if(!await eligible(current,latest))return null;const user=await completeRoleOtpContact(db,current,latest);await db.prepare('UPDATE login_otps SET consumed=1 WHERE id=?').run(row.id);if(user.phoneChangedDuringOtp&&typeof options.onVerified!=='function')await db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(user.id);const issued=typeof options.onVerified==='function'?await options.onVerified(user):undefined;await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...latest,deliveryState:'CONSUMED'}),markerKey(row.id));return{user,issued};});
   if(!result)return invalidAfter(start,timing.invalidDelayMs);return typeof options.onVerified==='function'?result:result.user;
  }
 };
}
