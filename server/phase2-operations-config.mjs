// Inert configuration preparation. This module opens no connection or timer.
const invalid=()=>{throw Error('Invalid Phase2 operations configuration; inspect documented variable names');};
function minutes(value){if(!value)return null;if(!/^[1-9]\d*$/.test(value)||Number(value)>10080)invalid();return Number(value);}
export function phase2OperationsConfig(env){
 const intervalMinutes=minutes(env.PHASE2_SCHEDULER_INTERVAL_MINUTES);
 const scheduler={enabled:env.PHASE2_SCHEDULER_ENABLED==='true',intervalMinutes,approvalReference:env.PHASE2_SCHEDULER_APPROVAL_REFERENCE||''};
 if(scheduler.enabled&&(!intervalMinutes||!scheduler.approvalReference.trim()))invalid();
 const smtp={enabled:env.PHASE2_SMTP_ENABLED==='true',approvalReference:env.PHASE2_SMTP_APPROVAL_REFERENCE||''};
 if(smtp.enabled){
  const port=env.PHASE2_SMTP_PORT;if(!['465','587'].includes(port)||!env.PHASE2_SMTP_HOST||/[\s/@]/.test(env.PHASE2_SMTP_HOST)||!env.PHASE2_SMTP_USER||!env.PHASE2_SMTP_PASSWORD||!smtp.approvalReference.trim()||!env.PHASE2_SMTP_FROM||/[\r\n]/.test(env.PHASE2_SMTP_FROM)||!env.PHASE2_EMAIL_RECIPIENT_ALLOWLIST?.trim())invalid();
 }
 return {scheduler,smtp};
}
export function phase2SmtpOptions(env){
 const {smtp}=phase2OperationsConfig(env);if(!smtp.enabled)return null;
 return {host:env.PHASE2_SMTP_HOST,port:Number(env.PHASE2_SMTP_PORT),secure:env.PHASE2_SMTP_PORT==='465',requireTLS:true,tls:{rejectUnauthorized:true},auth:{user:env.PHASE2_SMTP_USER,pass:env.PHASE2_SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000,logger:false,debug:false};
}
export async function preparePhase2NoticeTransport(env,transportFactory){
 const {smtp}=phase2OperationsConfig(env);
 if(!smtp.enabled||env.PHASE2_EMAIL_ENABLED!=='true')return undefined;
 if(!['phase2-local','phase2-preview'].includes(env.APP_ENV))invalid();
 const options=phase2SmtpOptions(env);
 if(transportFactory)return transportFactory(options);
 const {default:nodemailer}=await import('nodemailer');
 return nodemailer.createTransport(options);
}
export function phase2OperationsPreflight(env){
 const config=phase2OperationsConfig(env);
 return {networkCalls:0,externalEmailSent:0,scheduler:{enabled:config.scheduler.enabled,intervalMinutes:config.scheduler.intervalMinutes,approvalReferencePresent:Boolean(config.scheduler.approvalReference),status:config.scheduler.enabled?'CONFIGURED_NOT_ACTIVATED':'BLOCKED_SCHEDULE_AND_APPROVAL_REQUIRED'},smtp:{enabled:config.smtp.enabled,approvalReferencePresent:Boolean(config.smtp.approvalReference),status:config.smtp.enabled?'CONFIGURED_NOT_ACTIVATED':'BLOCKED_AUTHORIZED_SMTP_REQUIRED'},omise:{testSecretPresent:Boolean(env.PHASE2_OMISE_TEST_SECRET_KEY),testPublicPresent:Boolean(env.PHASE2_OMISE_TEST_PUBLIC_KEY),acceptance:'BLOCKED_UNTIL_REAL_SANDBOX_TEST'},providerAcceptance:'BLOCKED',businessApproval:'NOT_INFERRED_FROM_CONFIGURATION'};
}
