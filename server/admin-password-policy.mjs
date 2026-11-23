export const adminPasswordSetupOrigins=Object.freeze({staging:'https://design-villacheck.vercel.app',production:'https://www.villacheckth.com'});
const projects={staging:'prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC',production:'prj_AojlAe1eFqvqEnKd3FPENLbr3DtO'};
export function validAdminPasswordScope(scope){return Array.isArray(scope)&&scope.length>0&&scope.length<=20&&scope.every(a=>a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).every(k=>['id','email'].includes(k))&&/^[a-f0-9-]{36}$/.test(a.id)&&typeof a.email==='string'&&a.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)&&a.email===a.email.trim().toLowerCase())&&new Set(scope.map(a=>a.id)).size===scope.length&&new Set(scope.map(a=>a.email)).size===scope.length;}
export function adminPasswordSetupRuntimePolicy(env){
 const flag=env.ADMIN_PASSWORD_SETUP_ENABLED;if(flag!==undefined&&!['true','false'].includes(flag))throw Error('Invalid Admin setup configuration');
 const enabled=flag==='true'||flag===undefined&&env.APP_ENV==='staging'&&env.APP_URL?.replace(/\/$/,'')===adminPasswordSetupOrigins.staging;
 if(!enabled)return{adminPasswordSetupEnabled:false};
 if(!adminPasswordSetupOrigins[env.APP_ENV]||env.APP_URL?.replace(/\/$/,'')!==adminPasswordSetupOrigins[env.APP_ENV]||env.VERCEL_PROJECT_ID!==projects[env.APP_ENV])throw Error('Admin setup environment binding rejected');
 if(env.APP_ENV==='staging')return{adminPasswordSetupEnabled:true};
 let scope;try{scope=JSON.parse(env.ADMIN_PASSWORD_SETUP_SCOPE_JSON||'null');}catch{throw Error('Invalid Admin setup authorization scope');}
 if(!validAdminPasswordScope(scope)||!/^[a-zA-Z0-9_.:-]{3,160}$/.test(env.ADMIN_PASSWORD_SETUP_APPROVAL||''))throw Error('Explicit Admin setup authorization required');
 return{adminPasswordSetupEnabled:true,adminPasswordSetupApproval:env.ADMIN_PASSWORD_SETUP_APPROVAL,adminPasswordSetupScope:scope};
}
export function adminPasswordSetupConfigurationEnabled(config){
 const environment=config.appEnvironment;if(config.appUrl!==adminPasswordSetupOrigins[environment])return false;
 if(environment==='staging')return config.adminPasswordSetupEnabled!==false;
 return environment==='production'&&config.adminPasswordSetupEnabled===true&&/^[a-zA-Z0-9_.:-]{3,160}$/.test(config.adminPasswordSetupApproval||'')&&validAdminPasswordScope(config.adminPasswordSetupScope);
}
