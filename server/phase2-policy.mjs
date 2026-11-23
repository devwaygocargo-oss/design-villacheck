import {phase2ProductionPolicy,productionOwnerApproval,phase2ProductionTarget} from './phase2-production.mjs';
import {approvedOwnerMappings} from './phase2-approvers.mjs';
import previewTarget from './phase2-preview-target.json' with {type:'json'};
// Separate, opt-in development runtime. Never enables Phase 2 on Phase 1/Production.
export const phase2Prices=Object.freeze({basic:99000,starter:199000,pro:299000,premium:499000});
export const phase2Defaults=Object.freeze({revision:0,trialScope:'MERCHANT_ACCOUNT',billingCycle:'MONTHLY',billingUnit:null,billingDays:null,monthlyBoundary:null,vatMode:'INCLUSIVE',vatBasisPoints:null,vatRoundingPolicy:null,financeApprovalReference:null,invoiceRequirementsConfirmed:false,paidStartRule:'AFTER_TRIAL_OR_SETTLEMENT',remindersEnabled:true,noticeDays:[7],noticeChannels:['IN_APP'],noticeTimezone:null,noticeScheduleApprovalReference:'BUSINESS_OWNER_FINAL_DECISIONS_20261117_OFFSET_7',premiumChannels:[],higherTierMedia:false,homeSlots:null,homeRotation:null,publicPromotions:false,reviewsEnabled:false,allowImmediateReviews:false,publicReviews:false,approvalReference:null});
export const phase2PolicyFields=Object.keys(phase2Defaults).filter(k=>k!=='revision');
export function phase2Runtime(env){
 let owners=[];try{owners=JSON.parse(env.PHASE2_BUSINESS_OWNER_IDS||'[]');}catch{throw Error('Invalid Phase 2 Owner configuration');}
 if(!Array.isArray(owners)||owners.some(x=>typeof x!=='string'||!/^[a-f0-9-]{36}$/.test(x)))throw Error('Invalid Phase 2 Owner configuration');
 let mappings=null;try{mappings=JSON.parse(env.PHASE2_OWNER_APPROVER_MAPPING_JSON||'null');}catch{throw Error('Invalid explicit approver mapping');}
 if(mappings!==null&&!approvedOwnerMappings(mappings))throw Error('Both existing account mappings and grant references required');
 const provider=env.PHASE2_PAYMENT_PROVIDER||'OMISE_TEST';if(!['OMISE_TEST','LOCAL_SIMULATOR'].includes(provider))throw Error('Only Omise test or explicit local simulator is supported');
 if(env.PHASE2_OMISE_TEST_SECRET_KEY&&!/^skey_test_[a-zA-Z0-9]+$/.test(env.PHASE2_OMISE_TEST_SECRET_KEY))throw Error('Phase2 rejects live payment credentials');
 let qaAuthorization=null;if(env.PHASE2_OWNER_QA_READ_ENABLED==='true'){if(env.APP_ENV!=='phase2-local')throw Error('Owner QA read acceptance is local only');try{qaAuthorization=JSON.parse(env.PHASE2_OWNER_QA_AUTHORIZATION_JSON||'null')}catch{throw Error('Invalid local QA authorization')}}
 return {phase2OwnerQaReadEnabled:env.PHASE2_OWNER_QA_READ_ENABLED==='true',phase2OwnerQaAuthorization:qaAuthorization,...phase2ProductionPolicy(env),phase2OwnerCapabilityCandidateEnabled:env.PHASE2_OWNER_CAPABILITY_CANDIDATE_ENABLED==='true',phase2OwnerCapabilityApprovalReference:env.PHASE2_OWNER_CAPABILITY_APPROVAL_REFERENCE||'',phase2Enabled:env.PHASE2_ENABLED==='true',phase2SandboxEnabled:env.PHASE2_SANDBOX_ENABLED==='true',phase2PaymentProvider:provider,phase2OmiseTestSecretKey:env.PHASE2_OMISE_TEST_SECRET_KEY||'',phase2OmiseTestPublicKey:/^pkey_test_[A-Za-z0-9]+$/.test(env.PHASE2_OMISE_TEST_PUBLIC_KEY||'')?env.PHASE2_OMISE_TEST_PUBLIC_KEY:null,phase2EmailEnabled:env.PHASE2_EMAIL_ENABLED==='true',phase2ReminderDeliveryAcceptanceReference:env.PHASE2_REMINDER_DELIVERY_ACCEPTANCE_REFERENCE||'',phase2EmailRecipientAllowlist:(env.PHASE2_EMAIL_RECIPIENT_ALLOWLIST||'').split(',').map(s=>s.trim()).filter(Boolean),phase2BusinessOwnerIds:owners,phase2OwnerApproverMappings:mappings,phase2OwnerApprovalReference:env.PHASE2_OWNER_APPROVAL_REFERENCE||''};
}
export function requirePhase2(config){
 if(config.phase2ProductionCoreOnly===true&&config.appEnvironment==='production'&&config.productionRuntime===true&&(config.phase2ProductionApproval==='USER_REQUEST:PHASE2_RELEASE_20261118'||config.phase2ProductionOwnerMode===true&&config.phase2ProductionApproval===productionOwnerApproval)&&config.phase2SandboxEnabled===false)return;
 if(config.phase2Enabled!==true||!['development','phase2-local','phase2-preview'].includes(config.appEnvironment)||config.productionRuntime||config.productionReleaseMode||config.productionPrelaunch||config.interactiveDemo)throw Object.assign(Error('Phase 2 disabled / ปิด Phase 2 ในระบบนี้'),{status:503,code:'PHASE2_DISABLED'});
}
export function validatePhase2Policy(value){
 const fail=()=>{throw Object.assign(Error('Invalid or unapproved Phase 2 policy / กรุณาระบุกติกาที่อนุมัติ'),{status:400});};
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['revision',...phase2PolicyFields].includes(k)))fail();
 const p={...phase2Defaults,...value};
 if(!Number.isInteger(p.revision)||p.revision<0||typeof p.approvalReference!=='string'||!p.approvalReference.trim()||p.approvalReference.length>300)fail();
 for(const [key,choices]of Object.entries({trialScope:['MERCHANT_ACCOUNT'],billingCycle:['MONTHLY'],billingUnit:[null,'VILLA'],monthlyBoundary:[null,'EXPLICIT_ELAPSED_DAYS'],vatMode:['INCLUSIVE'],vatRoundingPolicy:[null,'HALF_UP','HALF_EVEN','DOWN'],paidStartRule:[null,'AFTER_TRIAL_OR_SETTLEMENT'],homeRotation:[null,'STABLE_SESSION']}))if(!choices.includes(p[key]))fail();
 if(p.billingDays!==null&&(!Number.isInteger(p.billingDays)||p.billingDays<28||p.billingDays>31))fail();
 if(p.vatBasisPoints!==null&&(!Number.isInteger(p.vatBasisPoints)||p.vatBasisPoints<0||p.vatBasisPoints>10000))fail();
 if(!Array.isArray(p.noticeDays)||p.noticeDays.length>1||p.noticeDays.some(d=>d!==7))fail();
 if(!Array.isArray(p.noticeChannels)||new Set(p.noticeChannels).size!==p.noticeChannels.length||p.noticeChannels.some(c=>!['IN_APP','EMAIL'].includes(c)))fail();
 if(!Array.isArray(p.premiumChannels)||new Set(p.premiumChannels).size!==p.premiumChannels.length||p.premiumChannels.some(c=>!['facebook','instagram','tiktok'].includes(c)))fail();
 if(p.homeSlots!==null&&(!Number.isInteger(p.homeSlots)||p.homeSlots<1||p.homeSlots>50))fail();
 for(const key of ['remindersEnabled','invoiceRequirementsConfirmed','higherTierMedia','publicPromotions','reviewsEnabled','allowImmediateReviews','publicReviews'])if(typeof p[key]!=='boolean')fail();
 for(const key of ['financeApprovalReference','noticeScheduleApprovalReference'])if(p[key]!==null&&(typeof p[key]!=='string'||!p[key].trim()||p[key].length>300))fail();
 if(p.noticeTimezone!==null){try{new Intl.DateTimeFormat('en',{timeZone:p.noticeTimezone});}catch{fail();}}
 if(p.remindersEnabled&&(!p.noticeDays.length||!p.noticeChannels.length||!p.noticeScheduleApprovalReference))fail();
 return p;
}
export function phase2Capabilities(plan,p={}){return {qr:['basic','starter'].includes(plan)||p.higherTierMedia===true,photos:['basic','starter'].includes(plan)||p.higherTierMedia===true,video:plan==='starter'||['pro','premium'].includes(plan)&&p.higherTierMedia===true,detailBanner:plan==='pro',homeBanner:plan==='premium',socialImage:['pro','premium'].includes(plan)?1:0,socialVideo:plan==='premium'?1:0};}

export function requirePhase2Database(db,config){if(config?.phase2ProductionCoreOnly===true){requirePhase2(config);const t=phase2ProductionTarget,i=db?.connectionIdentity;if(db?.dialect==='postgres'&&i?.host?.replace('-pooler.','.')===t.host&&i.database===t.database&&i.role===t.role)return;throw Object.assign(Error('Phase2 Production database denied'),{status:503,code:'PHASE2_DATABASE_DENIED'});}if(db?.dialect!=='postgres'||!(['127.0.0.1','localhost','::1'].includes(db.connectionIdentity?.host)||db.connectionIdentity?.host?.replace('-pooler.','.')===previewTarget.host&&db.connectionIdentity?.database===previewTarget.database&&db.connectionIdentity?.role===previewTarget.role))throw Object.assign(Error('Phase 2 requires isolated PostgreSQL target; other databases denied'),{status:503,code:'PHASE2_DATABASE_DENIED'});}
