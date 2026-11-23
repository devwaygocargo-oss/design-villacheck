import productionOwners from './production-owner-accounts.json' with {type:'json'};
export const productionOwnerApproval='USER_REQUEST:COMPANY_RELEASE_OWNER_LOGIN_20261123';
export const productionOperationsApproval='USER_APPROVAL:PHASE2_OPERATIONS_20261123';
export const productionOwnerGrantsApproval='USER_APPROVAL:OWNER_THREE_ACCOUNTS_20261123';
export function productionOwnerTarget(user,slot,accounts=productionOwners){return ['game','prin','dew'].some(k=>(!slot||slot===k)&&accounts?.[k]?.id===user?.id&&accounts?.[k]?.email===user?.email&&(user?.primaryRole||user?.role)===(accounts[k].primaryRole||'admin'));}
// Explicit target-bound release: approved first trial activation; no financial or policy writes.
export const phase2ProductionTarget=Object.freeze({projectId:'prj_AojlAe1eFqvqEnKd3FPENLbr3DtO',host:'ep-square-resonance-aohwf0z5.c-2.ap-southeast-1.aws.neon.tech',database:'villacheck_production',role:'villacheck_runtime'});
export function phase2ProductionPolicy(env){
 if(env.APP_ENV!=='production'||env.PHASE2_ENABLED!=='true')return null;
 const fail=()=>{throw Error('Phase2 Production release contract rejected');};let u;try{u=new URL(env.DATABASE_URL)}catch{fail()}
 const t=phase2ProductionTarget,ownerMode=env.PHASE2_OWNER_CAPABILITY_CANDIDATE_ENABLED==='true';
 if(ownerMode){if(env.PHASE2_PRODUCTION_RELEASE_APPROVAL!==productionOwnerApproval||env.PHASE2_PRODUCTION_OWNER_APPROVAL!==productionOwnerApproval||env.PHASE2_OWNER_CAPABILITY_APPROVAL_REFERENCE!==productionOwnerApproval)fail();}else if(env.PHASE2_PRODUCTION_OWNER_APPROVAL)fail();
 if(env.VERCEL_PROJECT_ID!==t.projectId||env.VERCEL_ENV!=='production'||env.PHASE2_PRODUCTION_RELEASE_APPROVAL!==(ownerMode?productionOwnerApproval:'USER_REQUEST:PHASE2_RELEASE_20261118')||env.APP_URL!=='https://www.villacheckth.com'||u.hostname.replace('-pooler.','.')!==t.host||decodeURIComponent(u.pathname.slice(1))!==t.database||decodeURIComponent(u.username)!==t.role||!u.password||!['require','verify-full'].includes(u.searchParams.get('sslmode'))||u.searchParams.has('options')||env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||env.PAYMENT_ACCESS_MODE!=='DISABLED'||env.PHASE2_OWNER_QA_READ_ENABLED==='true'||env.PHASE2_SANDBOX_ENABLED!=='false'||env.PHASE2_EMAIL_ENABLED!=='false'||!['true','false'].includes(env.PHASE2_OWNER_CAPABILITY_CANDIDATE_ENABLED)||env.DEMO_MODE!=='false'||env.SEED_DEMO_ACCOUNTS!=='false'||env.SEED_PUBLIC_DEMO_DATA!=='false')fail();
 if(Object.entries(env).some(([k,v])=>v&&(/^PHASE2_(?:OMISE_|SMTP_)/.test(k)||['PHASE2_BUSINESS_OWNER_IDS','PHASE2_OWNER_APPROVER_MAPPING_JSON','PHASE2_OWNER_APPROVAL_REFERENCE'].includes(k)&&!['[]','null'].includes(v))))fail();
 return {phase2ProductionCoreOnly:true,phase2ProductionApproval:env.PHASE2_PRODUCTION_RELEASE_APPROVAL,...(ownerMode?{phase2ProductionOwnerMode:true,phase2ProductionOwnerAccounts:productionOwners,phase2ProductionOperationalManagement:env.PHASE2_PRODUCTION_OPERATIONS_APPROVAL===productionOperationsApproval,phase2ProductionOwnerGrantsApproved:env.PHASE2_PRODUCTION_OWNER_GRANTS_APPROVAL===productionOwnerGrantsApproval}:{})};
}
// Existing nonfinancial workflows only; payment/order/settlement writes remain closed.
export function phase2ProductionReadAllowed(method,path,config={}){
 if(config.phase2ProductionOwnerMode===true&&method==='POST'&&path==='/api/phase2/owner-session')return true;
 if(config.phase2ProductionOperationalManagement===true&&method==='POST'&&['policy','trial','escalations','promotions','social','media','review-mode','reviews','moderate','reply'].some(p=>path==='/api/phase2/'+p))return true;
 return ['GET','HEAD'].includes(method)&&['workspaces','owner-workspace','public','catalog','workspace','policy','orders','reviews','review-mode','media','escalations','social'].some(p=>path==='/api/phase2/'+p);
}
