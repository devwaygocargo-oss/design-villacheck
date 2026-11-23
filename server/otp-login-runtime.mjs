import {applicationTargets} from './shared-application-environment.mjs';
import {smtpTransportOptions} from './smtp-diagnostics.mjs';

const origins={staging:'https://design-villacheck.vercel.app',production:'https://www.villacheckth.com'};
const emailPattern=/^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/;
const phonePattern=/^\+66[689]\d{8}$/;
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const has=value=>typeof value==='string'&&value.length>0;
function list(value,pattern,normalize=value=>value){
 if(value===undefined||value==='')return{values:[],valid:true};
 if(typeof value!=='string'||value.length>8192)return{values:[],valid:false};
 const values=value.split(',').map(value=>normalize(value.trim()));
 const valid=values.length<=100&&values.every(value=>value.length<=254&&pattern.test(value))&&new Set(values).size===values.length;
 return{values:valid?values:[],valid};
}

// Only nonsecret activation metadata is consulted here. Missing/invalid optional
// OTP configuration closes this capability and never breaks password/OAuth login.
export function otpLoginPolicy(env){
 const errors=[],requested=env.OTP_LOGIN_ENABLED==='true';
 if(env.OTP_LOGIN_ENABLED!==undefined&&!['true','false'].includes(env.OTP_LOGIN_ENABLED))errors.push('INVALID_OTP_LOGIN_FLAG');
 const target=applicationTargets[env.APP_ENV];
 const targetValid=Boolean(target&&env.VERCEL_PROJECT_ID===target.projectId&&env.APP_URL===origins[env.APP_ENV]&&env.PAYMENT_ACCESS_MODE==='DISABLED'&&env.COOKIE_SECURE==='true'&&env.NODE_TLS_REJECT_UNAUTHORIZED!=='0');
 const emailMode=env.OTP_EMAIL_PROVIDER||'DISABLED',smsMode=env.OTP_SMS_PROVIDER||'DISABLED';
 const modesValid=['DISABLED','SMTP'].includes(emailMode)&&['DISABLED','THAIBULKSMS_OTP'].includes(smsMode);
 const emails=list(env.OTP_LOGIN_EMAIL_ALLOWLIST,emailPattern,value=>value.toLowerCase()),phones=list(env.OTP_LOGIN_PHONE_ALLOWLIST,phonePattern),ids=list(env.OTP_LOGIN_STAGING_USER_IDS,uuidPattern,value=>value.toLowerCase());
 if(requested&&!targetValid)errors.push('OTP_LOGIN_TARGET_REJECTED');
 if(requested&&!modesValid)errors.push('OTP_LOGIN_PROVIDER_MODE_REJECTED');
 if(requested&&!emails.valid)errors.push('OTP_LOGIN_EMAIL_ALLOWLIST_REJECTED');
 if(requested&&!phones.valid)errors.push('OTP_LOGIN_PHONE_ALLOWLIST_REJECTED');
 if(requested&&(!ids.valid||env.APP_ENV!=='staging'&&ids.values.length))errors.push('OTP_LOGIN_STAGING_USER_SCOPE_REJECTED');
 return{
  otpLoginEnabled:requested&&targetValid&&modesValid&&errors.length===0,
  unifiedAuthEnabled:requested&&targetValid&&modesValid&&errors.length===0&&env.UNIFIED_AUTH_ENABLED==='true',
  merchantRegistrationDocumentsEnabled:env.MERCHANT_REGISTRATION_DOCUMENTS_ENABLED==='true',
  otpLoginProductionMerchants:requested&&targetValid&&env.APP_ENV==='production'&&modesValid&&errors.length===0,
  otpLoginEmailProvider:['DISABLED','SMTP'].includes(emailMode)?emailMode:'DISABLED',
  otpLoginSmsProvider:['DISABLED','THAIBULKSMS_OTP'].includes(smsMode)?smsMode:'DISABLED',
  otpLoginEmailAllowlist:emails.values,otpLoginPhoneAllowlist:phones.values,
  otpLoginStagingUserIds:env.APP_ENV==='staging'&&ids.valid?ids.values:[],
  otpLoginConfigurationErrors:errors,
 };
}

// Capture only this narrow provider view before the existing environment masks
// run. No generic provider or business-mail credential is restored to base config.
export function deriveOtpLoginRuntime(raw){
 const config=otpLoginPolicy(raw),errors=[...config.otpLoginConfigurationErrors];
 if(!config.otpLoginEnabled)return{config:{...config,otpLoginProviderConfig:undefined},transportOptions:undefined};
 const secretReady=typeof raw.OTP_SECRET==='string'&&raw.OTP_SECRET.length>=32;
 if(!secretReady)errors.push('OTP_LOGIN_SECRET_UNAVAILABLE');
 const emailRequested=config.otpLoginEmailProvider==='SMTP',smsRequested=config.otpLoginSmsProvider==='THAIBULKSMS_OTP';
 const port=String(raw.SMTP_PORT||'587'),secure=raw.SMTP_SECURE===undefined?port==='465':raw.SMTP_SECURE==='true';
 const smtpReady=emailRequested&&secretReady&&has(raw.SMTP_HOST)&&/^[a-zA-Z0-9.-]{1,253}$/.test(raw.SMTP_HOST)&&['465','587'].includes(port)&&[undefined,'true','false'].includes(raw.SMTP_SECURE)&&secure===(port==='465')&&has(raw.SMTP_USER)&&has(raw.SMTP_PASSWORD)&&has(raw.SMTP_FROM)&&raw.SMTP_FROM.length<=320&&!/[\r\n\x00]/.test(raw.SMTP_FROM);
 const smsReady=smsRequested&&secretReady&&has(raw.THAIBULKSMS_OTP_KEY)&&has(raw.THAIBULKSMS_OTP_SECRET);
 if(emailRequested&&!smtpReady)errors.push('OTP_LOGIN_SMTP_UNAVAILABLE');
 if(smsRequested&&!smsReady)errors.push('OTP_LOGIN_SMS_UNAVAILABLE');
 const provider={
  otpLoginOnly:true,otpSecret:secretReady?raw.OTP_SECRET:undefined,
  otpLoginEmailProvider:config.otpLoginEmailProvider,otpLoginSmsProvider:config.otpLoginSmsProvider,
  otpLoginEmailAllowlist:config.otpLoginEmailAllowlist,otpLoginPhoneAllowlist:config.otpLoginPhoneAllowlist,
  stagingEmailAllowlist:config.otpLoginEmailAllowlist,stagingSmsAllowlist:config.otpLoginPhoneAllowlist,
  smtpFrom:smtpReady?raw.SMTP_FROM:undefined,
  thaiBulkSmsOtpKey:smsReady?raw.THAIBULKSMS_OTP_KEY:undefined,
  thaiBulkSmsOtpSecret:smsReady?raw.THAIBULKSMS_OTP_SECRET:undefined,
  // Explicit own properties prevent CMS/template or legacy API-key fallback.
  thaiBulkSmsEmailOtpTemplateId:undefined,thaiBulkSmsApiKey:undefined,thaiBulkSmsApiSecret:undefined,thaiBulkSmsSender:undefined,
 };
 const transportOptions=smtpReady?{...smtpTransportOptions({...raw,SMTP_PORT:port,SMTP_SECURE:String(secure)}),logger:false,debug:false,tls:{rejectUnauthorized:true}}:undefined;
 return{config:{...config,otpLoginProviderConfig:provider,otpLoginConfigurationErrors:errors},transportOptions};
}

export async function createOtpLoginTransport(runtime,{transportFactory}={}){
 if(!runtime.transportOptions)return undefined;
 const factory=transportFactory||((await import('nodemailer')).default.createTransport);
 const transport=factory(runtime.transportOptions),sender=runtime.config.otpLoginProviderConfig.smtpFrom;
 return{
  sendMail:message=>{
   if(!message||typeof message.to!=='string'||!emailPattern.test(message.to.trim())||message.from!==sender||Object.keys(message).some(key=>!['from','to','subject','text'].includes(key)))throw Object.assign(Error('OTP login email scope rejected'),{code:'EENVELOPE'});
   return transport.sendMail(message);
  },
  ...(typeof transport.close==='function'?{close:()=>transport.close()}:{}),
 };
}

export async function validatedOtpLoginStagingUserIds(db,config){
 if(!config.otpLoginEnabled||!config.otpLoginStagingUserIds?.length)return[];
 const ids=config.otpLoginStagingUserIds;
 const rows=await db.prepare('SELECT id,role FROM users WHERE id IN ('+ids.map(()=>'?').join(',')+')').all(...ids);
 return rows.filter(row=>row.role==='user'&&ids.includes(row.id)).map(row=>row.id);
}
export function otpLoginStagingUser(user,config={}){
 return config.otpLoginEnabled===true&&user?.role==='user'&&Array.isArray(config.otpLoginStagingUserIds)&&config.otpLoginStagingUserIds.includes(user.id);
}
