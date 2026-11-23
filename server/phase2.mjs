import {requireBusinessPermission,withPermissionContext} from './business-permissions.mjs';
import {approvedReviewAuthority,decisionAudit} from './decision-audit.mjs';
import {approvalReviewDigest,companyApprovalPreview} from './phase2-company-approval.mjs';
import {gameResponsesEnabled} from './phase2-game-responses.mjs';
import {paidQrVisibility} from './phase2-paid-qr-visibility.mjs';
import {downgradedVideoRestriction,publicPackageVideoAllowed,companySocialSummary} from './phase2-latest-decisions.mjs';
import {ownerQaReadAuthorized} from './phase2-owner-qa-readonly.mjs';
import {grantEnvironment} from './phase2-grants.mjs';
import {publicRevision} from './public-revision.mjs';
import {phase2ProductionReadAllowed} from './phase2-production.mjs';
import {independentOwnerEnabled,activeOwnerGrant,independentOwnerAuthorized,bindIndependentOwnerSession,canInitializeProductionOwner} from './phase2-owner-capability.mjs';
import {syncPhase2Reminders,currentPhase2Notices,effectiveReminderPolicy} from './phase2-reminders.mjs';
import {assertPhase2VillaEditing,phase2VillaAccess} from './phase2-access.mjs';
import {canApprovePhase2} from './phase2-approvers.mjs';
import {monthlyQuote,assertPhase2OrderTerms} from './phase2-finance.mjs';
import {selectedPhase2Grant,selectedPhase2GrantRecord,phase2VillaGrants,grantState} from './phase2-grants.mjs';
import {deliverPhase2NoticeEmails} from './phase2-notifications.mjs';
import {villaPackageRights} from './phase2-entitlement-bridge.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {audit} from './database.mjs';
import {assertWriteSession} from './write-session.mjs';
import {hasMerchantCapability} from './merchant-capabilities.mjs';
import {publicOtpEmail,publicOtpPhone,normalizeProfileOtpPhone} from './role-otp-contacts.mjs';
import {mediaDate} from './media-date.mjs';
import {phase2Prices,phase2Defaults,phase2Capabilities,requirePhase2,requirePhase2Database,validatePhase2Policy} from './phase2-policy.mjs';
const DAY=86400000,prefix='phase2:v1:',sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const text=(v,max=2000)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v))fail(400,'Invalid text / ข้อความไม่ถูกต้อง');return v.trim();};
const instant=v=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail(400,'Invalid UTC date / วันเวลาไม่ถูกต้อง');return Date.parse(v);};
const read=async(db,k,f=null)=>{const r=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(prefix+k);return r?JSON.parse(r.value):f;};
const put=(db,k,v)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(prefix+k,JSON.stringify(v));
const rows=async(db,type)=>(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ? ORDER BY key').all(prefix+type+':%')).map(r=>JSON.parse(r.value));
const policy=async db=>effectiveReminderPolicy({...phase2Defaults,...await read(db,'policy',{}),billingUnit:'VILLA',billingDays:30,monthlyBoundary:'EXPLICIT_ELAPSED_DAYS',vatMode:'EXCLUSIVE',paidStartRule:'COMPANY_APPROVAL',premiumChannels:['facebook']});
function fields(data,allowed){if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!allowed.includes(k)))fail(400,'Unexpected request fields / ข้อมูลเกินขอบเขต');}
async function principal(db,a,c){
 const u=await db.prepare('SELECT id,role,email,name FROM users WHERE id=?').get(a?.id||'');
 if(!u||!['user','merchant','admin'].includes(u.role)||(a.primaryRole||a.role)!==u.role)fail(403,'Account role denied / ไม่มีสิทธิ์');
 const access=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+u.id);if(access&&JSON.parse(access.value).status==='suspended')fail(403,'Account suspended / บัญชีถูกระงับ');
 const ownerContext=independentOwnerEnabled(c)?await independentOwnerAuthorized(db,a,c):canApprovePhase2(u,c);
 const adminContext=ownerContext||u.role==='admin'||a.adminSession===true&&a.role==='admin';
 const merchant=!adminContext&&await hasMerchantCapability(db,u);
 return {...a,ownerQaRead:await ownerQaReadAuthorized(db,a,c),primaryRole:u.role,admin:adminContext,merchant,businessOwner:ownerContext,canBindOwner:Boolean(await activeOwnerGrant(db,a,c))||await canInitializeProductionOwner(db,a,c),user:!adminContext};
}
function admin(a){if(!a?.admin)fail(403,'Admin required / เฉพาะผู้ดูแล');}
function owner(a){if(!a?.businessOwner)fail(403,'Explicit Business Owner authorization required / ต้องได้รับสิทธิ์ Owner ที่อนุมัติ');}
async function villa(db,a,id,publicRead=false){const v=await db.prepare('SELECT * FROM villas WHERE id=?').get(id||'');if(!v||!publicRead&&!a.admin&&(!a.merchant||v.owner_id!==a.id))fail(404,'Villa unavailable / ไม่พบที่พัก');return v;}
async function visible(db,v,config){if(config?.publicPublicationDisabled)return false;const s=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+v.id);let snapshot;try{snapshot=s&&JSON.parse(s.value);}catch{return false;}const account=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+v.owner_id),sub=await db.prepare('SELECT lifecycle FROM subscriptions WHERE owner_id=?').get(v.owner_id),qr=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_qr:'+v.id);return v.status==='approved'&&Boolean(v.qr)&&(!account||JSON.parse(account.value).status!=='suspended')&&!['SUSPENDED','CANCELLED'].includes(sub?.lifecycle)&&!['SUSPENDED','INACTIVE','"SUSPENDED"','"INACTIVE"'].includes(qr?.value)&&snapshot?.villa?.id===v.id&&snapshot.villa.owner_id===v.owner_id&&snapshot.villa.status==='approved'&&Array.isArray(snapshot.media);}
const state=grantState;
async function activeGrant(db,id,now){const v=await db.prepare('SELECT id,owner_id FROM villas WHERE id=?').get(id);return v?selectedPhase2Grant(db,v,now):null;}
async function verified(db,a){
 const u=await db.prepare('SELECT * FROM users WHERE id=?').get(a.id);
 if(await db.prepare("SELECT user_id FROM oauth_identities WHERE user_id=? AND provider IN ('phone_otp','google','line','facebook') LIMIT 1").get(a.id))return true;
 for(const [channel,d]of [['email',await publicOtpEmail(db,u)],['sms',normalizeProfileOtpPhone(await publicOtpPhone(db,u)||u.phone)]]){
  if(!d)continue;const key='role_otp_contact:'+u.role+':'+channel+':'+createHash('sha256').update(d).digest('hex'),r=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);let p;try{p=r&&JSON.parse(r.value);}catch{continue;}if(p?.userId===u.id&&p.role===u.role&&p.destination===d&&p.channel===channel&&Number.isFinite(Date.parse(p.verifiedAt)))return true;
 }return false;
}
const quote=async(db,plan,p)=>{const row=await db.prepare('SELECT amount,active FROM package_catalog WHERE id=?').get(plan);if(!row||!row.active)fail(409,'Package unavailable');return monthlyQuote(plan,{...phase2Prices,[plan]:Number(row.amount)},p);};
async function docsComplete(db,v){
 const r=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('ownership_documents:'+v.id);let p;try{p=r&&JSON.parse(r.value);}catch{return false;}
 const ds=p?.documents?.filter(d=>!d.removedAt&&!d.supersededAt)||[];if(!ds.length||v.status!=='approved'||!Number.isFinite(Date.parse(v.reviewed_at))||!Number.isFinite(Date.parse(v.created)))return false;const approver=await db.prepare('SELECT id,role FROM users WHERE id=?').get(v.reviewed_by||'');if(!await approvedReviewAuthority(db,approver,v.id,v.reviewed_at,'VILLA_REVIEW'))return false;
 for(const d of ds){const reviewer=await db.prepare('SELECT id,role FROM users WHERE id=?').get(d.reviewedBy||''),f=await db.prepare('SELECT owner_id FROM documents WHERE id=?').get(d.id);if(d.status!=='accepted'||!Number.isFinite(Date.parse(d.reviewedAt))||!await approvedReviewAuthority(db,reviewer,d.id,d.reviewedAt,'OWNERSHIP_DOCUMENT')||f?.owner_id!==v.owner_id)return false;}
 return new Date(Math.max(Date.parse(v.created),Date.parse(v.reviewed_at),...ds.map(d=>Date.parse(d.reviewedAt)))).toISOString();
}
export async function settlePhase2Sandbox(db,a,config,envelope,now=new Date().toISOString()){
 requirePhase2(config);requirePhase2Database(db,config);if(await gameResponsesEnabled(db,config))fail(503,'Game response candidate: Finance and company approval workflow acceptance pending');if(!config.phase2SandboxEnabled||!config.phase2SandboxGateway)fail(503,'Sandbox not configured');
 return db.transaction(async()=>{
  const actor=a?await principal(db,a,config):null;if(actor){admin(actor);await assertWriteSession(db,a);}else if(config.phase2SandboxGateway.provider!=='OMISE_TEST')fail(403,'Verified provider required');instant(now);
  const e=config.phase2SandboxGateway.verify(envelope);if(!['pending','succeeded','cancelled','failed'].includes(e.status)||typeof e.eventId!=='string'||!/^[a-f0-9-]{36}$/.test(e.eventId))fail(400,'Invalid Sandbox event');
  const order=await read(db,'order:'+e.orderId);if(!order||order.environment!=='SANDBOX'||e.amount!==order.totalSatang||e.currency!=='THB'||e.providerReference!==order.providerReference)fail(400,'Sandbox amount/reference mismatch');
  const old=await read(db,'event:'+e.eventId);if(old){if(old.fingerprint!==sha(e))fail(409,'Event reuse mismatch');return {order,duplicate:true};}
  const previousPaymentStatus=order.status;
  if(order.status!=='pending'&&e.status!==order.status)fail(409,'Terminal order cannot change');
  const v=await villa(db,actor,order.villaId,!actor);if(v.owner_id!==order.userId)fail(409,'Ownership changed');
  // Verified payment alone never creates entitlement; an authorized company decision is still required.
  if(previousPaymentStatus!==e.status&&['succeeded','failed','cancelled'].includes(e.status))await decisionAudit(db,a?withPermissionContext(a,config,'payments.review',(await requireBusinessPermission(db,a,config,'payments.review')).owner):null,{kind:'PAYMENT',resourceType:'SANDBOX_ORDER',targetId:order.id,outcome:e.status==='succeeded'?'APPROVED':'REJECTED',previousStatus:previousPaymentStatus,newStatus:e.status,action:'sandbox.payment.'+e.status,providerEvent:{provider:config.phase2SandboxGateway.provider,eventId:e.eventId}});
  order.status=e.status;order.updatedAt=now;await put(db,'order:'+order.id,order);await put(db,'event:'+e.eventId,{id:e.eventId,sequence:(await rows(db,'event')).filter(row=>row.orderId===order.id).length+1,fingerprint:sha(e),orderId:order.id,at:now,status:e.status,amountSatang:e.amount,currency:e.currency,providerReference:e.providerReference});if(a)await audit(db,a,'phase2.sandbox.'+e.status,order.id);else await put(db,'provider-audit:'+e.eventId,{provider:'OMISE_TEST',orderId:order.id,status:e.status,at:now});if(e.status==='succeeded')await syncPhase2Reminders(db,await policy(db),instant(now),v.owner_id);return {order,duplicate:false};
 });
}
export async function phase2Api(db,actor,req,path,url,body,config){
 requirePhase2(config);requirePhase2Database(db,config);if(config.phase2ProductionCoreOnly&&!phase2ProductionReadAllowed(req.method,path,config))fail(503,'รอการอนุมัติที่เกี่ยวข้อง / Phase2 activation, payments, policy and publication writes remain disabled');const nowMs=config.phase2Clock?config.phase2Clock():Date.now(),now=new Date(nowMs).toISOString();
 const write=req.method==='POST';if(!['GET','POST'].includes(req.method))fail(405,'Method not allowed');const parsedBody=write?await body(req):null;
 const work=async()=>{
  const a=actor?await principal(db,actor,config):null,responseCandidate=await gameResponsesEnabled(db,config),p=await policy(db);if(write){if(!a)fail(401,'Login required');await assertWriteSession(db,actor);}
  if(a?.admin){const permissions={policy:'subscriptions.configure',trial:'memberships.manage',notices:'memberships.manage',promotions:'content.manage',social:'content.manage',media:'content.manage',sandbox:'payments.review','company-decisions':'payments.review'};const permission=permissions[path.split('/').at(-1)];if(permission&&(write||permission!=='subscriptions.configure'))await requireBusinessPermission(db,actor,config,permission);}
  if(responseCandidate&&write&&['orders','payment','sandbox','policy','promotions'].some(resource=>path==='/api/phase2/'+resource))fail(503,'Game responses recorded; financial/policy activation and new Banner remain disabled');
  if(responseCandidate&&write&&path==='/api/phase2/notices'&&parsedBody?.action==='deliver')fail(503,'External reminder acceptance pending');
  if(path==='/api/phase2/public'){
   if(write)fail(405,'Read only');const id=url.searchParams.get('villaId'),v=id?await publicRevision(db,await db.prepare('SELECT * FROM villas WHERE id=?').get(id),undefined,{phase2Config:config}):null;
   if(id&&(!v||!await visible(db,v,config)))return {reviews:[],promotions:[],media:[],packageState:'UNAVAILABLE',qr:null};
   const reviews=p.publicReviews&&p.reviewsEnabled?(await rows(db,'review')).filter(r=>r.villaId===id&&r.status==='published').map(({id,villaId,content,rating,publishedAt,reply})=>({id,villaId,content,rating,publishedAt,reply:reply?{content:reply.content,at:reply.at}:null})):[];
   const placement=url.searchParams.get('placement')||'detail';if(!['home','detail'].includes(placement))fail(400,'Invalid placement');
   const promos=[];if(p.publicPromotions)for(const pr of await rows(db,'promotion')){
    const parent=await publicRevision(db,await db.prepare('SELECT * FROM villas WHERE id=?').get(pr.villaId),undefined,{phase2Config:config});if(pr.placement!==placement||!pr.approved||nowMs<instant(pr.startsAt)||nowMs>=instant(pr.endsAt)||!parent||!await visible(db,parent,config)||parent.photo_url!==pr.image||!parent.photo_reviewed_at)continue;
    const file=await db.prepare('SELECT owner_id,name,mime FROM documents WHERE id=?').get(pr.image.split('/').at(-1));if(file?.owner_id!==parent.owner_id||file.name!=='property-media'||!['image/jpeg','image/png'].includes(file.mime))continue;const pub=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+parent.id)).value);if(!pub.media?.some(m=>m.url===pr.image))continue;
    if(pr.source==='PACKAGE'){const g=await activeGrant(db,parent.id,nowMs);if(!g||!phase2Capabilities(g.packageId,p)[placement==='home'?'homeBanner':'detailBanner'])continue;}
    if(placement==='home'&&(!p.homeSlots||p.homeRotation!=='STABLE_SESSION'))continue;promos.push({id:pr.id,villaId:pr.villaId,image:pr.image,href:'/#page=detail&item='+encodeURIComponent(parent.qr),title:parent.name});
   }
   const seed=String(url.searchParams.get('seed')||'').slice(0,80);promos.sort((x,y)=>sha([seed,x.id]).localeCompare(sha([seed,y.id])));
   const media=[];if(v)for(const row of await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all('property_media:'+v.id+':%')){const m=JSON.parse(row.value);if(m.removedAt||!m.reviewedAt||m.kind==='video'&&!await publicPackageVideoAllowed(db,v,config))continue;const snapshot=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+v.id)).value);if(!snapshot.media?.some(f=>f.id===m.id)&&snapshot.villa.photo_url!==m.url)continue;const meta=await read(db,'media:'+m.id);media.push({id:m.id,kind:m.kind,uploadedAt:m.uploadedAt,takenAt:meta?meta.takenAt:m.takenAt||null,verifiedAt:meta?meta.verifiedAt:m.reviewedAt});}const grants=v?(await phase2VillaGrants(db,v)).sort((a,b)=>instant(b.endsAt)-instant(a.endsAt)):[],selected=v?await selectedPhase2Grant(db,v,nowMs):null;return {reviews,promotions:promos.slice(0,placement==='home'?p.homeSlots||0:1),media,packageState:selected?'ACTIVE':grants.length?'EXPIRED_OR_SELECTION_POLICY_PENDING':'NOT_STARTED',selectedPackageId:selected?.packageId||null,expiryRightsPolicy:(await paidQrVisibility(db,v,config)).scoped?'PAID_QR_INFORMATION_HIDDEN_AFTER_EXPIRY_IDENTITY_RETAINED':'PUBLIC_APPROVED_QR_RETAINED_MERCHANT_EDITING_DISABLED_AFTER_EXPIRY_OTHER_FEATURES_PENDING',qr:v?.qr||null};
  }
  if(!a)fail(401,'Login required');
  const data=parsedBody,asUser=req.headers?.['x-villacheck-portal']==='user'&&a.user;
  if(path==='/api/phase2/workspaces'){const same=(config.phase2WorkspaceSessionClaims||[]).filter(s=>s.id===a.id),user=a.user||same.some(s=>s.portal==='user'),merchant=a.merchant||same.some(s=>s.portal==='user'&&s.merchant),admin=a.admin||same.some(s=>s.portal==='admin');return {accountId:a.id,sessionPortal:a.admin?'admin':'user',workspaces:[...(user?[{id:'user',href:'/dashboard'}]:[]),...(merchant?[{id:'merchant',href:'/merchant'}]:[]),...(admin?[{id:'admin',href:'/admin'}]:[]),...((a.businessOwner||a.ownerQaRead)?[{id:'owner',href:'/owner'}]:[])],financialActionsEnabled:false};}
  if(path==='/api/phase2/owner-workspace'){if(!a.ownerQaRead)owner(a);return {workspace:'BUSINESS_OWNER',financialActionsEnabled:false,policyChangesEnabled:false,externalNotificationsEnabled:false,escalations:(await rows(db,'escalation')).map(({id,kind,status,revision})=>({id,kind,status,revision}))};}
  if(path==='/api/phase2/owner-session'){if(!write)fail(405,'POST required');fields(data,[]);return bindIndependentOwnerSession(db,actor,config);}
  if(path==='/api/phase2/policy'){
   if(!write){if(!a.admin&&!a.businessOwner)fail(403,'Owner or Admin read required');return {policy:p,canDecide:a.businessOwner};}owner(a);fields(data,['policy','reason']);text(data.reason,120);const n=validatePhase2Policy(data.policy);if(n.revision!==p.revision)fail(409,'Policy changed');n.revision++;await put(db,'policy',n);await put(db,'policy-change:'+randomUUID(),{revision:n.revision,actorId:a.id,at:now,reason:data.reason,beforeSha256:sha(p),policy:n});await audit(db,actor,'phase2.policy.updated',n.approvalReference);return {policy:n};
  }
  if(path==='/api/phase2/catalog')return {packages:(await Promise.all(Object.keys(phase2Prices).map(async id=>{const row=await db.prepare('SELECT amount FROM package_catalog WHERE id=?').get(id);return [id,Number(row?.amount??phase2Prices[id])]}))).map(([id,amount])=>({id,amountSatang:amount,currency:'THB',billingCycle:'MONTHLY',billingDays:p.billingDays,vatMode:p.vatMode,vatRateConfirmed:p.vatBasisPoints!==null,capabilities:phase2Capabilities(id,p)})),businessResponses:{reference:'CONSOLIDATED_GAME_20261123',respondent:'Game',packageDays:30,periodStart:'COMPANY_APPROVAL',renewal:'MANUAL',premiumChannels:['facebook'],bannerEnabled:true},financialActionsEnabled:!config.phase2ProductionCoreOnly,newBannerEnabled:!config.phase2ProductionCoreOnly,sandboxOnly:!config.phase2ProductionCoreOnly,productionCoreOnly:config.phase2ProductionCoreOnly===true,canAdmin:a.admin,canDecide:a.businessOwner,canBindOwner:a.canBindOwner,ownerCandidate:independentOwnerEnabled(config),canMerchant:a.merchant&&!asUser,canReview:a.user&&(asUser||!a.merchant),policyRevision:p.revision};
  if(path==='/api/phase2/workspace'){
   if(write)fail(405,'Read only');const vs=a.admin?await db.prepare('SELECT id,name,owner_id,status,qr,package_id FROM villas ORDER BY id').all():a.merchant&&!asUser?await db.prepare('SELECT id,name,owner_id,status,qr,package_id FROM villas WHERE owner_id=? ORDER BY id').all(a.id):(await db.prepare("SELECT id,name,status,owner_id FROM villas WHERE status='approved' ORDER BY id").all()).map(({owner_id,...v})=>({...v,isOwn:owner_id===a.id}));
   const all=await rows(db,'grant');const companySocial=(a.admin||a.merchant&&!asUser)?await companySocialSummary(db,vs,config,p,nowMs):null;return {...(companySocial?{companySocial}:{}),serverNow:now,villas:vs,packageRights:await Promise.all(vs.filter(v=>a.admin||v.owner_id===a.id).map(async v=>({villaId:v.id,...await villaPackageRights(db,v,config,nowMs)}))),grants:all.filter(g=>a.admin||g.userId===a.id).map(g=>({...g,state:state(g,nowMs),appliesToVillaIds:vs.filter(v=>g.scope==='MERCHANT_ACCOUNT'?(v.owner_id===g.userId||v.isOwn&&g.userId===a.id):g.villaId===v.id).map(v=>v.id)})),notices:(await currentPhase2Notices(db,p,nowMs)).filter(n=>a.admin||n.userId===a.id),orders:(await rows(db,'order')).filter(o=>a.admin||o.userId===a.id),escalations:(await rows(db,'escalation')).filter(e=>a.admin||a.businessOwner||e.submittedBy===a.id)};
  }
  if(path==='/api/phase2/company-decisions'){
   if(!write)fail(405,'POST required');admin(a);const decisionAccess=await requireBusinessPermission(db,actor,config,'payments.review');
   fields(data,['orderId','decision','revision','reason']);
   if(!['APPROVED','REJECTED'].includes(data.decision))fail(400,'Invalid company decision');const reason=text(data.reason,500);
   const order=await read(db,'order:'+data.orderId);if(!order)fail(404,'Order missing');
   if(order.companyStatus===data.decision)return {order,duplicate:true};
   if(order.companyStatus!=='PENDING_REVIEW'||order.companyRevision!==data.revision)fail(409,'Company decision changed');
   const v=await villa(db,a,order.villaId);if(v.owner_id!==order.userId)fail(409,'Ownership changed');
   assertPhase2OrderTerms(order);if(order.termsVersion!==2)fail(409,'Historical terms require separate Finance review');
   if(data.decision==='APPROVED'){
    if(order.status!=='succeeded'||order.grantId)fail(409,'Verified successful payment required');
    const previous=await selectedPhase2GrantRecord(db,v,nowMs),id=randomUUID();
    const grant={id,villaId:v.id,userId:v.owner_id,packageId:order.packageId,startsAt:now,billingStartsAt:now,endsAt:new Date(nowMs+30*DAY).toISOString(),source:'COMPANY_APPROVED_ORDER',scope:'VILLA',orderId:order.id,environment:grantEnvironment(db),createdAt:now,approvedBy:a.id,approvedAt:now,financialAdjustment:'NONE_APPROVED_NO_REFUND_CARRYOVER_PRORATION',switchingPolicy:structuredClone(order.switchingPolicy)};
    const restriction=downgradedVideoRestriction(previous,order.packageId,p);if(restriction)grant.videoRestriction=restriction;
    await put(db,'grant:'+id,grant);order.grantId=id;
    await put(db,'selection:'+v.id,{villaId:v.id,userId:v.owner_id,grantId:id,orderId:order.id,selectedAt:now,reason:'PAYMENT_AND_COMPANY_APPROVAL'});
   }
   const previousStatus=order.companyStatus;Object.assign(order,{companyStatus:data.decision,companyRevision:order.companyRevision+1,companyDecidedBy:a.id,companyDecidedAt:now,updatedAt:now});
   await put(db,'order:'+order.id,order);await decisionAudit(db,withPermissionContext(actor,config,'payments.review',decisionAccess.owner),{kind:'PAYMENT',resourceType:'PACKAGE_COMPANY_APPROVAL',targetId:order.id,outcome:data.decision,reason,previousStatus,newStatus:order.companyStatus,action:'phase2.company.'+data.decision.toLowerCase()});
   await syncPhase2Reminders(db,p,nowMs,v.owner_id);return {order,duplicate:false};
  }
  if(path==='/api/phase2/company-approval-requests'||path==='/api/phase2/company-approval-preview'){
   if(!responseCandidate)fail(503,'Legacy preview superseded; use company decisions for verified orders');
   const binding=async v=>approvalReviewDigest({villa:{id:v.id,ownerId:v.owner_id,status:v.status,qr:v.qr},selection:await read(db,'selection:'+v.id),policyRevision:p.revision});
   if(path==='/api/phase2/company-approval-preview'){
    if(!write)fail(405,'POST required');if(!a.admin)fail(403,'Existing Admin review access required');fields(data,['requestId']);
    const request=await read(db,'approval-request:'+data.requestId);if(!request)fail(404,'Request unavailable');const v=await villa(db,a,request.villaId);
    if(v.owner_id!==request.userId||await binding(v)!==request.bindingDigest)fail(409,'Request context changed; submit a new request');
    return {preview:companyApprovalPreview(request,config.phase2ApprovalPreviewTerms,now)};
   }
   if(!write){
    if(!a.admin&&(!a.merchant||asUser))fail(403,'Merchant or existing reviewer required');
    const requests=(await rows(db,'approval-request')).filter(r=>a.admin||a.merchant&&r.userId===a.id);
    return {requests,financialActionsEnabled:false,approvalActionsEnabled:false};
   }
   if(!a.merchant||asUser)fail(403,'Own Merchant request required');fields(data,['villaId','packageId','requestKey']);
   const v=await villa(db,a,data.villaId);if(!Object.hasOwn(phase2Prices,data.packageId)||typeof data.requestKey!=='string'||!/^[a-f0-9-]{36}$/.test(data.requestKey))fail(400,'Package and request identity required');
   const fingerprint=sha({userId:a.id,villaId:v.id,packageId:data.packageId}),key='approval-request-key:'+sha([a.id,data.requestKey]),existing=await read(db,key);
   if(existing){if(existing.fingerprint!==fingerprint)fail(409,'Request key reused with different content');const request=await read(db,'approval-request:'+existing.id);if(!request||request.id!==existing.id||request.userId!==a.id||request.villaId!==v.id||request.packageId!==data.packageId)fail(409,'Request inventory mismatch');if(request.bindingDigest!==await binding(v))fail(409,'Request context changed; submit a new request');return {request,created:false};}
   const bindingDigest=await binding(v),activeKey='approval-request-active:'+sha([a.id,v.id,data.packageId,bindingDigest]),active=await read(db,activeKey);
   if(active){const request=await read(db,'approval-request:'+active.id);if(!request||request.id!==active.id||request.userId!==a.id||request.villaId!==v.id||request.packageId!==data.packageId||request.bindingDigest!==bindingDigest||request.status!=='PENDING_REVIEW')fail(409,'Request inventory mismatch');await put(db,key,{id:request.id,fingerprint});return {request,created:false};}
   const request={id:randomUUID(),revision:0,status:'PENDING_REVIEW',userId:a.id,villaId:v.id,packageId:data.packageId,renewal:'MANUAL',requestedAt:now,bindingDigest,simulationOnly:true,companyApproved:false};
   await put(db,'approval-request:'+request.id,request);await put(db,activeKey,{id:request.id});await put(db,key,{id:request.id,fingerprint});await audit(db,actor,'phase2.company_review.requested',request.id);
   return {request,created:true};
  }

  if(path==='/api/phase2/trial'){
   admin(a);if(!write)fail(405,'POST required');fields(data,['villaId','merchantId']);const v=await villa(db,a,data.villaId);
   if(p.trialScope!=='MERCHANT_ACCOUNT')fail(409,'Account trial policy update/legacy transition required');
   if(data.merchantId&&data.merchantId!==v.owner_id)fail(409,'Merchant ownership mismatch');
   const merchantOwner=await db.prepare('SELECT id,role FROM users WHERE id=?').get(v.owner_id);if(!merchantOwner||!await hasMerchantCapability(db,merchantOwner))fail(409,'Merchant enrollment required');
   const previous=await read(db,'account-trial:'+v.owner_id);if(previous)return {trial:previous,created:false};
   if((await rows(db,'trial')).some(t=>t.userId===v.owner_id))fail(409,'Legacy per-Villa trial transition awaiting approval');
   if(config.phase2ProductionCoreOnly){const legacy=await db.prepare("SELECT key FROM system_settings WHERE key=? OR key IN (SELECT 'villa_free_trial:'||id FROM villas WHERE owner_id=?) LIMIT 1").get('merchant_free_period:'+v.owner_id,v.owner_id);const sub=await db.prepare('SELECT owner_id FROM subscriptions WHERE owner_id=?').get(v.owner_id);if(legacy||sub)fail(409,'Existing entitlement transition requires approval; legacy rights preserved');}
   const eligibilityAt=await docsComplete(db,v);if(!eligibilityAt||instant(eligibilityAt)>nowMs)fail(409,'Complete dated documents and Admin approval required');
   const trial={id:randomUUID(),scope:'MERCHANT_ACCOUNT',userId:v.owner_id,triggerVillaId:v.id,packageId:'starter',startsAt:now,endsAt:new Date(nowMs+90*DAY).toISOString(),eligibilityAt,activatedAt:now,activatedBy:a.id,source:'ACCOUNT_DOCUMENTS_COMPLETE_ADMIN_ACTIVATION',environment:grantEnvironment(db),policyRevision:p.revision};
   await put(db,'account-trial:'+v.owner_id,trial);await put(db,'grant:'+trial.id,trial);await audit(db,actor,'phase2.account_trial.started',v.owner_id);await syncPhase2Reminders(db,p,nowMs,v.owner_id);return {trial,created:true};
  }

  if(path==='/api/phase2/notices'){
   admin(a);if(!write)fail(405,'POST required');fields(data,['action']);if(data.action==='deliver')return deliverPhase2NoticeEmails(db,config);if(data.action&&data.action!=='generate')fail(400,'Invalid notice action');const result=await syncPhase2Reminders(db,p,nowMs);await audit(db,actor,'phase2.notices.generated',String(result.created.length));return result;
  }

  if(path==='/api/phase2/orders'){
   if(!write){
    const id=url.searchParams.get('orderId');
    if(id){
     const order=await read(db,'order:'+id);if(!order||!a.admin&&order.userId!==a.id)fail(404,'Order missing');
     const storedGrant=order.grantId?await read(db,'grant:'+order.grantId):null;
     const grant=storedGrant?.orderId===order.id&&storedGrant.userId===order.userId&&storedGrant.villaId===order.villaId?storedGrant:null;
     const events=(await rows(db,'event')).filter(e=>e.orderId===id).map(({fingerprint,...e})=>e).sort((x,y)=>x.sequence&&y.sequence?x.sequence-y.sequence:x.at.localeCompare(y.at)||String(x.id||'').localeCompare(String(y.id||'')));
     const attempt=order.provider==='OMISE_TEST'?await read(db,'omise:'+order.id):null;return {order,events,grant:grant?{...grant,state:state(grant,nowMs)}:null,checkout:order.provider==='OMISE_TEST'?{enabled:!responseCandidate&&Boolean(config.phase2PaymentService&&config.phase2OmiseTestPublicKey),publicKey:config.phase2OmiseTestPublicKey||null,attempt:attempt?{status:attempt.status,chargeId:attempt.chargeId||null,qrImage:attempt.qrImage||null,authorizeUri:attempt.authorizeUri||null}:null}:null};
    }
    return {orders:(await rows(db,'order')).filter(o=>a.admin||o.userId===a.id)};
   }
   fields(data,['villaId','packageId','requestKey']);if(!a.merchant)fail(403,'Merchant required');const v=await villa(db,a,data.villaId);if(v.owner_id!==a.id)fail(403,'Own Villa only');if(!await visible(db,v))fail(409,'Approved published Villa required');if(!config.phase2SandboxEnabled||!config.phase2SandboxGateway)fail(503,'Sandbox not configured');
   if(typeof data.requestKey!=='string'||!/^[a-f0-9-]{36}$/.test(data.requestKey))fail(400,'Idempotency key required');const k='request:'+a.id+':'+data.requestKey,fp=sha({villaId:v.id,packageId:data.packageId}),old=await read(db,k);if(old){if(old.fingerprint!==fp)fail(409,'Idempotency conflict');return {order:await read(db,'order:'+old.orderId),created:false};}
   const q=await quote(db,data.packageId,p),order={id:randomUUID(),userId:a.id,villaId:v.id,packageId:data.packageId,...q,status:'pending',companyStatus:'PENDING_REVIEW',companyRevision:0,environment:'SANDBOX',provider:config.phase2PaymentProvider||'LOCAL_SIMULATOR',providerReference:randomUUID(),createdAt:now,grantId:null};await put(db,'order:'+order.id,order);await put(db,k,{fingerprint:fp,orderId:order.id});await audit(db,actor,'phase2.sandbox.order',order.id);return {order,created:true};
  }
  if(path==='/api/phase2/payment'){
   if(!write)fail(405,'POST required');fields(data,['orderId','source','action']);if(!config.phase2PaymentService)fail(503,'Omise Sandbox not configured');
   const order=await read(db,'order:'+data.orderId);if(!order||!a.admin&&order.userId!==a.id)fail(404,'Order missing');
   if(data.action==='status')return config.phase2PaymentService.status(actor,order.id);
   if(data.action==='cancel'&&a.merchant&&order.userId===a.id)return config.phase2PaymentService.cancel(actor,order.id);
   if(data.action!=='checkout'||!a.merchant||order.userId!==a.id)fail(403,'Merchant checkout required');
   return config.phase2PaymentService.checkout(actor,order.id,data.source);
  }
  if(path==='/api/phase2/sandbox'){
   admin(a);if(!write)fail(405,'POST required');fields(data,['orderId','status']);if(config.phase2PaymentProvider==='OMISE_TEST')fail(403,'Provider outcomes must be verified with Omise');if(!config.phase2SandboxEnabled||!config.phase2SandboxGateway)fail(503,'Sandbox not configured');if(!['pending','succeeded','failed','cancelled'].includes(data.status))fail(400,'Invalid outcome');const o=await read(db,'order:'+data.orderId);if(!o)fail(404,'Order missing');return settlePhase2Sandbox(db,actor,config,config.phase2SandboxGateway.create(o,data.status),now);
  }
  if(path==='/api/phase2/escalations'){
   if(!a.admin&&!a.businessOwner)fail(403,'Owner or Admin required');if(!write)return {escalations:await rows(db,'escalation')};fields(data,['id','kind','reason','decision','revision']);if(data.id){owner(a);const r=await read(db,'escalation:'+data.id);if(!r)fail(404,'Missing escalation');if(r.revision!==data.revision||r.status!=='pending')fail(409,'Escalation changed');if(!['approved','changes','rejected'].includes(data.decision))fail(400,'Invalid decision');Object.assign(r,{status:data.decision,decidedBy:a.id,decidedAt:now,decisionReason:text(data.reason),revision:r.revision+1});await put(db,'escalation:'+r.id,r);await audit(db,actor,'phase2.escalation.decided',r.id);return {escalation:r,automaticPolicyOrGrantChanges:false};}
   admin(a);if(!['POLICY_CHANGE','TRIAL_EXCEPTION','PROMOTION_EXCEPTION'].includes(data.kind))fail(400,'Invalid escalation');const r={id:randomUUID(),kind:data.kind,reason:text(data.reason),submittedBy:a.id,createdAt:now,status:'pending',revision:1};await put(db,'escalation:'+r.id,r);await audit(db,actor,'phase2.escalation.submitted',r.id);return {escalation:r};
  }
  if(path==='/api/phase2/promotions'){
   if(!write){admin(a);return {promotions:await rows(db,'promotion')};}admin(a);fields(data,['villaId','placement','source','startsAt','endsAt','approved']);const v=await villa(db,a,data.villaId);if(!await visible(db,v)||!v.photo_reviewed_at||!/^\/api\/public\/property-media-file\/[a-f0-9-]{36}$/.test(v.photo_url))fail(409,'Current approved public media required');const published=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+v.id);if(JSON.parse(published.value).villa.photo_url!==v.photo_url||!JSON.parse(published.value).media?.some(m=>m.url===v.photo_url))fail(409,'Approved cover changed');const m=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('property_media:'+v.id+':'+v.photo_url.split('/').at(-1));const media=m&&JSON.parse(m.value),doc=await db.prepare('SELECT owner_id,name,mime FROM documents WHERE id=?').get(media?.id||'');if(!media?.reviewedAt||media.removedAt||media.villaId!==v.id||doc?.owner_id!==v.owner_id||doc.name!=='property-media'||!['image/jpeg','image/png'].includes(doc.mime)||media.kind!=='image')fail(409,'Media ownership/review mismatch');
   if(!['home','detail'].includes(data.placement)||!['TEAM','PACKAGE'].includes(data.source)||typeof data.approved!=='boolean'||instant(data.endsAt)<=instant(data.startsAt))fail(400,'Invalid promotion');const r={id:randomUUID(),villaId:v.id,placement:data.placement,source:data.source,startsAt:data.startsAt,endsAt:data.endsAt,approved:data.approved,image:v.photo_url,createdBy:a.id,createdAt:now};await put(db,'promotion:'+r.id,r);await audit(db,actor,'phase2.promotion.saved',r.id);return {promotion:r};
  }
  if(path==='/api/phase2/social'){
   if(!write)return {jobs:(await rows(db,'social')).filter(j=>a.admin||j.ownerId===a.id)};admin(a);fields(data,['villaId','source','kind','channel','month','status','postUrl','publishedAt','jobId','revision']);const v=await villa(db,a,data.villaId);if(!await visible(db,v))fail(409,'Published Villa required');if(!['TEAM','PACKAGE'].includes(data.source)||!['image','video'].includes(data.kind)||data.channel!=='facebook'||!['scheduled','published'].includes(data.status)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.month))fail(400,'Invalid social job');
   const previous=data.jobId?await read(db,'social:'+data.jobId):null;
   if(data.jobId&&!previous)fail(404,'Social job missing');if(!data.jobId&&data.revision!==undefined)fail(400,'Existing job required');
   if(previous&&(previous.ownerId!==v.owner_id||['villaId','source','kind','channel','month'].some(k=>previous[k]!==data[k])||data.status!=='published'))fail(409,'Social job binding/status is immutable');
   let postUrl=null;if(data.status==='published'){instant(data.publishedAt);if(new Date(instant(data.publishedAt)+7*3600000).toISOString().slice(0,7)!==data.month||instant(data.publishedAt)>nowMs)fail(400,'Publication date/month mismatch');let u;try{u=new URL(data.postUrl);}catch{fail(400,'Invalid post URL');}const domains={facebook:'facebook.com',instagram:'instagram.com',tiktok:'tiktok.com'};if(u.protocol!=='https:'||u.username||u.password||!(u.hostname===domains[data.channel]||u.hostname.endsWith('.'+domains[data.channel])))fail(400,'Invalid post URL');u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^fbclid$|^igshid$/i.test(k))u.searchParams.delete(k);u.hostname=u.hostname.replace(/^(www|m)\./,'');postUrl=u.href;if((await rows(db,'social')).some(j=>j.id!==previous?.id&&j.postUrl===postUrl))fail(409,'Post already recorded');}
   const publicationFingerprint=sha({villaId:v.id,source:data.source,kind:data.kind,channel:data.channel,month:data.month,status:data.status,postUrl,publishedAt:data.publishedAt||null});
   if(previous?.status==='published'){if(previous.publicationFingerprint!==publicationFingerprint)fail(409,'Publication already final');return {job:previous,duplicate:true,externalPostsCreated:0};}
   if(previous&&(previous.status!=='scheduled'||data.revision!==(previous.revision||1)))fail(409,'Social job revision changed');
   let packageId=null;if(data.source==='PACKAGE'){const g=await activeGrant(db,v.id,nowMs);if(!g)fail(409,'Active package required');packageId=g.packageId;const start=Date.parse(data.month+'-01T00:00:00.000+07:00'),endDate=new Date(start+7*3600000);endDate.setUTCMonth(endDate.getUTCMonth()+1);const end=endDate.getTime()-7*3600000;if(start>=instant(g.endsAt)||end<=instant(g.startsAt))fail(409,'Social month outside entitlement');const cap=phase2Capabilities(g.packageId,p),quota=cap[data.kind==='image'?'socialImage':'socialVideo'];if(!quota||g.packageId==='pro'&&data.channel!=='facebook'||g.packageId==='premium'&&!p.premiumChannels.includes(data.channel))fail(409,'Social channel/entitlement not confirmed');if(previous&&previous.packageId!==packageId)fail(409,'Reserved package changed; review required');const used=(await rows(db,'social')).filter(j=>j.id!==previous?.id&&j.villaId===v.id&&j.source==='PACKAGE'&&j.month===data.month&&j.kind===data.kind).length;if(used>=quota)fail(409,'Monthly social quota reached');}
   const event={status:data.status,by:a.id,at:now,postUrl,publishedAt:data.publishedAt||null};
   const r=previous?{...previous,status:'published',postUrl,publishedAt:data.publishedAt,publishedBy:a.id,updatedAt:now,revision:(previous.revision||1)+1,publicationFingerprint,history:[...(previous.history||[{status:'scheduled',by:previous.createdBy,at:previous.createdAt}]),event]}:{id:randomUUID(),villaId:v.id,ownerId:v.owner_id,source:data.source,packageId,kind:data.kind,channel:data.channel,month:data.month,status:data.status,postUrl,publishedAt:data.publishedAt||null,createdBy:a.id,createdAt:now,revision:1,history:[event],...(data.status==='published'?{publishedBy:a.id,publicationFingerprint}:{})};
   await put(db,'social:'+r.id,r);await put(db,'social-event:'+randomUUID(),{jobId:r.id,...event,revision:r.revision});await audit(db,actor,previous?'phase2.social.published':'phase2.social.recorded',r.id);return {job:r,duplicate:false,externalPostsCreated:0};
  }
  if(path==='/api/phase2/review-mode'){
   admin(a);const id=write?data.villaId:url.searchParams.get('villaId');await villa(db,a,id);const old=await read(db,'review-mode:'+id,{mode:'pending',revision:0});if(!write)return old;fields(data,['villaId','mode','revision','reason']);if(!p.reviewsEnabled||!['pending','immediate'].includes(data.mode)||data.mode==='immediate'&&!p.allowImmediateReviews)fail(409,'Review mode not enabled');if(data.revision!==old.revision)fail(409,'Mode changed');const m={mode:data.mode,revision:old.revision+1,changedBy:a.id,changedAt:now,reason:text(data.reason)};await put(db,'review-mode:'+id,m);await audit(db,actor,'phase2.review_mode.changed',id);return m;
  }
  if(path==='/api/phase2/reviews'){
   if(!write){const ownVillas=a.merchant?(await db.prepare('SELECT id FROM villas WHERE owner_id=?').all(a.id)).map(v=>v.id):[];return {reviews:(await rows(db,'review')).filter(r=>a.admin||r.userId===a.id||r.status==='published'&&ownVillas.includes(r.villaId)).map(r=>a.admin||r.userId===a.id?r:{id:r.id,villaId:r.villaId,content:r.content,rating:r.rating,status:r.status,reply:r.reply})};}
   fields(data,['villaId','content','rating']);if(!p.reviewsEnabled)fail(503,'Reviews disabled');if(!a.user||!await verified(db,a))fail(403,'Verified User required');const v=await villa(db,a,data.villaId,true);if(!await visible(db,v))fail(404,'Villa unavailable');if(v.owner_id===a.id)fail(403,'Self review denied');if(!Number.isInteger(data.rating)||data.rating<1||data.rating>5)fail(400,'Rating 1–5 required');const existing=await rows(db,'review');if(existing.some(r=>r.userId===a.id&&r.villaId===v.id))fail(409,'Duplicate review');if(existing.filter(r=>r.userId===a.id&&instant(r.createdAt)>nowMs-15*60000).length>=5)fail(429,'Review rate limit');const mode=await read(db,'review-mode:'+v.id,{mode:'pending'}),immediate=mode.mode==='immediate'&&p.allowImmediateReviews;const r={id:randomUUID(),villaId:v.id,userId:a.id,content:text(data.content),rating:data.rating,status:immediate?'published':'pending',createdAt:now,publishedAt:immediate?now:null,modeSnapshot:mode.mode,history:[]};await put(db,'review:'+r.id,r);await audit(db,actor,'phase2.review.submitted',r.id);return {review:r};
  }
  if(path==='/api/phase2/moderate'){
   admin(a);if(!write)fail(405,'POST required');fields(data,['id','status','reasonCode','reason']);if(!p.reviewsEnabled)fail(503,'Reviews disabled');const r=await read(db,'review:'+data.id);if(!r)fail(404,'Review missing');if(!['published','changes','rejected'].includes(data.status))fail(400,'Invalid moderation');if(data.status!=='published'&&!['spam','privacy','duplicate','impersonation','insufficient_evidence'].includes(data.reasonCode))fail(400,'Content reason required, not rating');r.status=data.status;r.publishedAt=data.status==='published'?now:null;r.history.push({status:data.status,reasonCode:data.reasonCode||null,reason:text(data.reason),by:a.id,at:now});await put(db,'review:'+r.id,r);await audit(db,actor,'phase2.review.moderated',r.id);return {review:r};
  }
  if(path==='/api/phase2/reply'){
   if(!write)fail(405,'POST required');fields(data,['id','content']);if(!p.reviewsEnabled||!a.merchant)fail(403,'Merchant reply disabled');const r=await read(db,'review:'+data.id);if(!r||r.status!=='published')fail(404,'Published review missing');const v=await villa(db,a,r.villaId);if(v.owner_id!==a.id)fail(403,'Own review only');r.reply={content:text(data.content),by:a.id,at:now};await put(db,'review:'+r.id,r);await audit(db,actor,'phase2.review.replied',r.id);return {review:r};
  }
  if(path==='/api/phase2/media'){
   const v=await villa(db,a,write?data.villaId:url.searchParams.get('villaId'));const key='property_media:'+v.id+':';
   const ms=(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all(key+'%')).map(r=>JSON.parse(r.value)).filter(m=>!m.removedAt);
   if(!write)return {media:await Promise.all(ms.map(async m=>{const meta=await read(db,'media:'+m.id);return {id:m.id,kind:m.kind,uploadedAt:m.uploadedAt,takenAt:meta?meta.takenAt:m.takenAt??null,verifiedAt:meta?meta.verifiedAt:m.reviewedAt??null};})),latestUploadedAt:ms.map(m=>m.uploadedAt).filter(Boolean).sort().at(-1)||null};
   fields(data,['villaId','mediaId','takenAt','action','reason','confirmReviewed']);const m=ms.find(m=>m.id===data.mediaId),doc=await db.prepare('SELECT owner_id FROM documents WHERE id=?').get(data.mediaId||'');if(!m||doc?.owner_id!==v.owner_id||!Number.isFinite(Date.parse(m.uploadedAt)))fail(404,'Media binding missing');const old=await read(db,'media:'+m.id,{takenAt:m.takenAt||null,verifiedAt:m.reviewedAt||null,history:[]});
   if(data.action==='verify'){admin(a);if(data.confirmReviewed!==true)fail(400,'Confirm actual media review');old.verifiedAt=now;old.history.push({action:'verify',by:a.id,at:now,reason:text(data.reason)});}else if(data.action==='capture'){if(!a.merchant||v.owner_id!==a.id)fail(403,'Own media only');await assertPhase2VillaEditing(db,a,v,config);old.takenAt=data.takenAt===null?null:mediaDate(data.takenAt);old.verifiedAt=null;old.history.push({action:'capture_date_changed',by:a.id,at:now});}else fail(400,'Invalid media action');await put(db,'media:'+m.id,old);await audit(db,actor,'phase2.media.'+data.action,m.id);return {media:{id:m.id,uploadedAt:m.uploadedAt,...old}};
  }
  fail(404,'Phase 2 resource missing');
 };
 return write&&path!=='/api/phase2/payment'&&!(path==='/api/phase2/notices'&&parsedBody?.action==='deliver')?db.transaction(work):work();
}
