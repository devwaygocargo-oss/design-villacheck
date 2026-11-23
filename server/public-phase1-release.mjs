// Public Phase1 activates only after an operator binds the documented release
// receipt to the existing Production target. This is not an approval generator.
import {phase2ProductionPolicy} from './phase2-production.mjs';
import {requestAllowed} from './staging-interactive-policy.mjs';
export const publicPhase1Mode='PHASE1_PUBLIC';
export function publicPhase1Policy(env){
 if(env.PRODUCTION_RELEASE_MODE!==publicPhase1Mode)return null;
 const stage=env.PUBLIC_PHASE1_STAGE||'PUBLIC';if(!['PUBLIC','ADMIN_ONLY','USER_ACCESS'].includes(stage))throw Error('Public Phase1 stage rejected');
 const selected=(env.CUSTOMER_OAUTH_PROVIDERS||'').split(',');
 const evidence=provider=>stage==='PUBLIC'&&env.CUSTOMER_OAUTH_EXISTING_ENABLED==='true'&&selected.includes(provider)&&/^PROVIDER_VERIFIED:[a-zA-Z0-9_.:-]{3,120}$/.test(env['PUBLIC_PHASE1_'+provider.toUpperCase()+'_EVIDENCE']||'');
 const googleOAuthEnabled=evidence('google'),lineOAuthEnabled=evidence('line');
 if(env.CUSTOMER_OAUTH_EXISTING_ENABLED==='true'&&(!selected.length||new Set(selected).size!==selected.length||selected.some(p=>!['google','line'].includes(p)||!evidence(p))))throw Error('Public Phase1 provider evidence required');
 const userAccess=stage==='USER_ACCESS',adminOnly=stage!=='PUBLIC';if(stage==='ADMIN_ONLY'&&(env.OTP_LOGIN_ENABLED==='true'||env.CUSTOMER_OAUTH_EXISTING_ENABLED==='true'))throw Error('Admin phase cannot activate public providers');
 if(env.APP_ENV!=='production'||env.VERCEL_PROJECT_ID!=='prj_AojlAe1eFqvqEnKd3FPENLbr3DtO'||env.APP_URL!=='https://www.villacheckth.com'||!/^OWNER_DIRECTIVE:[a-zA-Z0-9_.:-]{3,120}$/.test(env.PUBLIC_PHASE1_RELEASE_APPROVAL||'')||env.BUSINESS_INITIALIZATION_MODE!=='EXISTING_CATALOG'||env.PAYMENT_ACCESS_MODE!=='DISABLED'||env.CUSTOMER_OAUTH_EXISTING_ENABLED==='true'&&!googleOAuthEnabled&&!lineOAuthEnabled||env.PHASE2_ENABLED==='true'&&!phase2ProductionPolicy(env))throw Error('Public Phase1 release target rejected');
 if(userAccess&&(!/^OWNER_DIRECTIVE:[a-zA-Z0-9_.:-]{3,120}$/.test(env.PUBLIC_PHASE1_USER_ACCESS_APPROVAL||'')||env.UNIFIED_AUTH_ENABLED!=='true'))throw Error('Public User access approval required');
 for(const [flag,ref] of [['OTP_LOGIN_ENABLED','PUBLIC_PHASE1_OTP_EVIDENCE'],['ADMIN_PASSWORD_SETUP_ENABLED','ADMIN_PASSWORD_SETUP_APPROVAL']])if(env[flag]==='true'&&!/^[a-zA-Z0-9_.:-]{3,160}$/.test(env[ref]||''))throw Error('Public Phase1 sensitive capability evidence required');
 return{...phase2ProductionPolicy(env),prelaunch:false,phase1:true,releaseMode:publicPhase1Mode,publicPhase1:!adminOnly,adminOnly,googleOAuthEnabled,lineOAuthEnabled,publicUserAccessEnabled:userAccess,publicPublicationDisabled:adminOnly,businessInitializationDisabled:false,propertyMediaWorkflowEnabled:true,privateRegistryDetails:false,unifiedAuthEnabled:env.UNIFIED_AUTH_ENABLED==='true',emailOtpDelivery:env.PHASE1_EMAIL_OTP_DELIVERY||'DISABLED'};
}
export function publicPhase1RequestAllowed(method,path,policy={}){
 if(method==='HEAD')method='GET';
 if(path==='/api/public/events')return method==='POST'&&policy.adminOnly!==true;
 if(['/api/admin/villa-archive','/api/merchant/villa-archive'].includes(path))return ['GET','POST'].includes(method);
 if(path==='/api/admin/email-test')return method==='POST'&&policy.adminPasswordSetupEnabled===true;
 if(policy.adminOnly===true){
  if(policy.publicUserAccessEnabled===true){
   if(method==='POST'&&['/api/auth/register-user','/api/auth/registration/verify','/api/auth/recovery/request','/api/auth/recovery/verify'].includes(path))return policy.otpLoginEnabled===true;
   if(method==='POST'&&['/api/auth/otp/request','/api/auth/otp/verify'].includes(path))return policy.otpLoginEnabled===true;
   if(method==='GET'&&path==='/api/auth/otp/status')return policy.otpLoginEnabled===true;
   if(method==='POST'&&['/api/auth/password','/api/auth/logout-all','/api/user/profile','/api/account/privacy-requests','/api/user/merchant-registration'].includes(path))return requestAllowed(method,path,policy);
  }
  if(['/api/auth/admin-password/request','/api/auth/admin-password/complete','/api/admin/password-invitation'].includes(path))return method==='POST'&&policy.adminPasswordSetupEnabled===true;
  if(path.startsWith('/api/public/'))return method==='GET'&&(['/api/public/cms','/api/public/villas','/api/public/advertisements','/api/public/reviews'].includes(path)||['/api/public/cms-media/','/api/public/property-media-file/','/api/public/villa-photo/','/api/public/review-media/'].some(prefix=>path.startsWith(prefix)));
  if(!path.startsWith('/api/admin/')&&method!=='GET'&&!['/api/auth/admin-login','/api/auth/admin-logout','/api/auth/login','/api/auth/logout'].includes(path))return false;
 }

 if(path.startsWith('/api/payments')||path.startsWith('/api/webhooks/')||path.startsWith('/api/advertisements')||path.includes('/social-')||method!=='GET'&&(/^\/api\/(?:admin\/|merchant\/)?reviews(?:\/|$)/.test(path)||path==='/api/admin/packages'||/^\/api\/admin\/packages\//.test(path)||path.startsWith('/api/admin/promotions')||path.startsWith('/api/admin/subscriptions')))return false;
 if(['/api/auth/admin-password/request','/api/auth/admin-password/complete','/api/admin/password-invitation'].includes(path))return method==='POST'&&policy.adminPasswordSetupEnabled===true;
 if(method==='POST'&&['/api/auth/otp/request','/api/auth/otp/verify'].includes(path))return policy.otpLoginEnabled===true;
 if(path==='/api/auth/oauth/status')return method==='GET';
 const oauth=path.match(/^\/api\/auth\/oauth\/(google|line)\/(start|callback|link|reauth)$/);
 if(oauth)return policy[oauth[1]==='google'?'googleOAuthEnabled':'lineOAuthEnabled']===true&&(method==='GET'&&/\/(start|callback)$/.test(path)||method==='POST'&&/\/(link|reauth)$/.test(path));
 if(/^\/api\/auth\/oauth\//.test(path))return false; // no unverified provider activation
 return requestAllowed(method,path,policy);
}
