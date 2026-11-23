import {assertPhase2VillaEditing,phase2VillaAccess} from './phase2-access.mjs';
import {businessPermissions,permissionForRequest,requireBusinessPermission,withPermissionContext,requestCorrelation} from './business-permissions.mjs';
import {decisionAudit} from './decision-audit.mjs';
import {businessRoleManagement} from './business-role-management.mjs';
import {phase2LegacyWriteBlocked} from './phase2-legacy-policy.mjs';
import {phase2Api} from './phase2.mjs';
import {requirePhase2} from './phase2-policy.mjs';
import {LocalPhase2Sandbox} from './phase2-sandbox.mjs';
import {OmisePhase2Proof,createPhase2Omise} from './phase2-omise.mjs';
import {merchantQrScanCounts} from "./merchant-qr-scans.mjs";
import {bannerVariantWidth} from "./banner-image-policy.mjs";
import {cmsImageVariant} from "./cms-image-variant.mjs";
import {villaFreeTrial,pendingVillaTrial,prepareVillaTrial,activateVillaTrial,perVillaTrialEnabled} from './villa-free-trial.mjs';
import {phoneProfileStatus} from './phone-profile.mjs';
import {villaArchive} from './villa-archive.mjs';
import {publishedCmsMedia} from './cms-publication.mjs';
import {hasAdminAccess,bindAdminSession,validAdminBinding} from './admin-access.mjs';
import {publicFrontendCms} from './public-frontend-cms.mjs';
import {requestAdminSetup,completeAdminSetup,revokeAdminSetup} from './admin-password-setup.mjs';
import {merchantEnrollmentDraft} from './merchant-capabilities.mjs';
import {knownApiPath} from './api-route-manifest.mjs';
import {timed,timedSync} from "./vc04-timing.mjs";
import {reviewedCover} from './cover-review.mjs';
import {merchantChangeApi} from './merchant-change-approval.mjs';
import {hasBasicPasswordAccount} from "./basic-user-registration.mjs";
import {accountCapabilities,actorForRequest,merchantProfile,registerMerchantCapability,saveMerchantProfile} from './merchant-capabilities.mjs';
import {beginUnifiedCredentials,finishUnifiedCredentials} from './unified-credentials.mjs';
import {findRoleOtpContact,roleOtpContactVerified,assertProfileOtpPhoneAvailable} from './role-otp-contacts.mjs';
import {selfRegisteredStagingMerchant,stagingAdminVillas} from './staging-property-workflow.mjs';
import {registryPrecheckApi,registryPrecheckRoute,registryAccount,registryContactPhone} from "./registry-precheck.mjs";
import {propertyUpload} from './property-upload.mjs';
import {sendPropertyFile} from './send-property-file.mjs';
import {sendReviewMedia} from "./review-media.mjs";
import {merchantActionItems} from './merchant-action-items.mjs';
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {beginRoleSafePasswordRecovery,assertRoleSafePasswordRecovery} from './role-otp-recovery-guard.mjs';
import {hasPublicOtpAccount,publicOtpEmail,publicOtpPhone} from './role-otp-contacts.mjs';
import {publicOAuthUser} from "./public-oauth-user.mjs";
import {bannerMedia} from "./banner-language.mjs";
import {createOtpLoginNonce} from './primary-otp-login.mjs';
import {localizeCheckResponse} from "./check-localization.mjs";
import {merchantReceivingBankApi} from "./merchant-receiving-bank.mjs";
import {mediaRange} from "./media-range.mjs";
import {villaDraft,markVillaDraftSubmitted} from './villa-drafts.mjs'
import {assertWriteSession} from './write-session.mjs'
import {publicError} from './public-error.mjs'
import {customerOAuthStatus} from "./customer-oauth-security.mjs";
import {privacyNoticeVersion,privacyRequests,adminPrivacyRequests} from "./privacy-requests.mjs"
import {secureAccountOperation} from './account-security.mjs'
import {beginPasswordRecovery,finishPasswordRecovery} from './password-recovery.mjs'
import {securityEvent} from './security-events.mjs'
import {reserveVillaCreate,completeVillaCreate} from './villa-create-request.mjs';
import {ownershipDocuments,assertOwnershipDocumentsReviewed} from './ownership-documents.mjs'
import {assertVillaCoverLimit} from './villa-media-limits.mjs'
import {merchantFreePeriod,assertVillaCreation,blockFreePackageSelection} from './merchant-free-period.mjs'
import {initialGrantForReview,membershipNotices} from './membership-lifecycle.mjs'
import {verifyProductionDemoGate} from './production-demo-gate.mjs'
import {productionRequestAllowed,phase1PackageDisplay} from "./production-runtime.mjs"
import {isDemoVilla} from "./demo-villa-visibility.mjs"
import {resolvePublicQr,publicRevision,rememberQr,publishedVillas} from "./public-revision.mjs"
import {savePackagePromotion} from "./package-promotions.mjs"
import {paymentAccess,requireManualPayment,requireNewPayment} from "./payment-access.mjs"
import {beginPasswordRegistration,finishPasswordRegistration} from "./password-registration.mjs"
import {reserveManualProof} from "./manual-proof.mjs"
import {OmiseTestGateway,createOmisePayments} from "./omise.mjs"
import {packageEntitlementsApi} from "./package-entitlements.mjs"
import {approvalHistory,preserveApprovedVilla,rotateApprovedRevision} from "./approval-history.mjs"
import {basicPromotionApi,grantBasicPromotion} from "./basic-promotion.mjs"
import {assertNoUnsettledPackageChange} from "./proration.mjs"
import {villaPage,villaPagesApi,saveVillaDescription} from "./villa-pages.mjs";
import {presentationMedia} from "./cms-presentation.mjs"
import {accountManagement} from "./account-management.mjs"
import { ownerVerificationApi, publicOwnerVerification } from "./owner-verification.mjs"
import { basicVerificationNotice } from "./package-content.mjs"
import { loadTrustContext, selectByIds } from "./villa-read-context.mjs"
import { readContextPlan } from "./catalog.mjs"
import { shortcutMediaUrls } from "./cms-home-config.mjs"
import {propertyMediaApi,propertyMediaFile,storePropertyMedia} from "./property-media.mjs";
import {advertisingApi} from "./advertising.mjs";
import {socialMaterialsApi,socialMaterialFile,cleanupSocialUploads} from "./social-materials.mjs";
import {reviewsApi} from "./reviews.mjs";
import { createInvoice } from "./database.mjs";
import { mediaDate } from "./media-date.mjs";
import {smtpDiagnostic} from "./smtp-diagnostics.mjs"
import {acceptanceApi} from "./acceptance.mjs"
import {promotionsApi,selectCoupon} from "./promotions.mjs"
import { changeApprovals } from "./change-approvals.mjs"
import { receivingBank,bankInstructions } from "./payment-account.mjs"
import { adminReceivingBank } from "./bank-receiving.mjs"
import {scope,actorAllowed,beforeRequest,authorizeRequest} from './staging-interactive-policy.mjs';
import {villaReview,recordVillaReview} from './villa-review.mjs'
import {dummyPdf} from './demo-seed.mjs'
import { cmsLoginConfig } from "./cms-business.mjs"
import {createLoginOtp,otpChannels,probeSmsCredit} from './login-otp.mjs'
import {merchantRegistrationApplication,sendMerchantRegistrationDocument} from './merchant-registration-application.mjs';
import { guestCapacity } from './guest-capacity.mjs'
import {saveVillaPhoto} from './villa-photo.mjs'
import {demoSlip,demoMode} from "./demo-payment.mjs"
import {createReport, recordEvent, operations} from "./operations.mjs"
import { adminBusiness } from "./admin-business.mjs"
import { readiness } from "./readiness.mjs"
import { adminCms, publishedCms, cmsPaymentInstructions } from "./cms.mjs"
import { generatePaymentQr, paymentQrDto } from "./payment-qr.mjs"
import {
  getPlan,
  listPlans,
  trustDto as catalogTrustDto,
  getVerificationMode,
  levels,
} from "./catalog.mjs"
import { PaymentVerificationService } from "./payment-verification.mjs"
import { confirmPayment } from "./payment-service.mjs"
import {
  getSubscription,
  subscriptionDto,
  activateVilla,
} from "./subscriptions.mjs"
import { createOAuth, oauthProviders } from "./oauth.mjs"
import { createServer } from "node:http"
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import { resolve, sep } from "node:path"
import {
  audit,
  transaction,
  verifyPasswordAsync,
} from "./database.mjs"
import { createMailWorker } from "./mail.mjs"
class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const fail = (status, message, code) => {
  const error=new ApiError(status,message);if(code)error.code=code;throw error
}
const hash = (value) => createHash("sha256").update(value).digest("hex")
const text = (value, label, max = 200) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ||
    (max < 2000 && /[\t\r\n]/.test(value))
  )
    fail(400, `กรุณาระบุ ${label} ให้ถูกต้อง`)
  return value.trim()
}
function email(value) {
  const normalized = text(value, "อีเมล", 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) fail(400, "อีเมลไม่ถูกต้อง")
  return normalized
}
function password(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128)
    fail(400, "รหัสผ่านต้องมี 10–128 ตัวอักษร")
  return value
}
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    fail(415, "ต้องส่งข้อมูล JSON")
  if (req.body !== undefined) {
    const encoded =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(encoded) > 3 * 1024 * 1024)
      fail(413, "ไฟล์มีขนาดใหญ่เกินไป")
    try {
      const data =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body
      if (!data || Array.isArray(data) || typeof data !== "object")
        throw Error()
      return data
    } catch {
      fail(400, "ข้อมูล JSON ไม่ถูกต้อง")
    }
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    // Drain an oversized request without retaining more bytes. Throwing inside
    // for-await destroys IncomingMessage and can reset the connection before 413.
    if (size <= 3 * 1024 * 1024) chunks.push(chunk)
  }
  if (size > 3 * 1024 * 1024) fail(413, "ไฟล์มีขนาดใหญ่เกินไป")
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString())
    if (!data || Array.isArray(data) || typeof data !== "object") throw Error()
    return data
  } catch {
    fail(400, "ข้อมูล JSON ไม่ถูกต้อง")
  }
}
function document(value, options = {}) {
  if (!value || typeof value !== "object") fail(400, "ต้องแนบเอกสาร")
  const name = text(value.name, "ชื่อไฟล์", 180).replace(/[\\/]/g, "_")
  if (/^(cms-image:|receiving-bank-qr:|villa-photo(?::|$)|property-media$|social-material:)/i.test(name))
    fail(400, "ชื่อไฟล์สงวนสำหรับระบบ กรุณาเปลี่ยนชื่อไฟล์")
  const match =
    typeof value.data === "string" &&
    value.data.match(
      /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/,
    )
  if (!match) fail(400, "รับเฉพาะ PDF, JPG, PNG")
  const bytes = Buffer.from(match[2], "base64")
  const maxBytes = [4 * 1024 * 1024, 5 * 1024 * 1024].includes(options.maxBytes) ? options.maxBytes : 2 * 1024 * 1024
  if (bytes.length === 0 || bytes.length > maxBytes)
    fail(400, maxBytes === 5 * 1024 * 1024 ? "ไฟล์ต้องมีข้อมูลและขนาดไม่เกิน 5 MB" : maxBytes === 4 * 1024 * 1024 ? "ไฟล์ต้องมีข้อมูลและขนาดไม่เกิน 4 MB" : "ไฟล์ต้องมีขนาดไม่เกิน 2 MB")
  const mime = match[1]
  const valid =
    mime === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : mime === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!valid) fail(400, "เนื้อหาไฟล์ไม่ตรงกับชนิดเอกสาร")
  return { name, mime, bytes }
}
async function insertDocument(db, owner, file) {
  const id = randomUUID()
  await db
    .prepare("INSERT INTO documents VALUES (?,?,?,?,?)")
    .run(id, owner, file.name, file.mime, file.bytes)
  return id
}
export function createApp(db, config, transport) {
  const releaseMode=config.productionReleaseMode||(config.productionPrelaunch?'PRELAUNCH':null)
  const phase1=['PHASE1','PHASE1_PUBLIC'].includes(releaseMode)
  const membershipTrustOptions={phase2Config:config,publicPublicationDisabled:config.publicPublicationDisabled===true,privateRegistryDetails:false,propertyMediaWorkflowEnabled:config.propertyMediaWorkflowEnabled===true||config.interactiveDemo===true,demoImages:config.appEnvironment==='staging',requireFiniteExpiry:config.appEnvironment==='production'||phase1}
  const trustDto=(database,villa,context)=>catalogTrustDto(database,villa,context,membershipTrustOptions)
  if((config.productionRuntime||releaseMode)&&(!['PRELAUNCH','PHASE1','MEMBER_PREVIEW','PRODUCTION','PHASE1_PUBLIC'].includes(releaseMode)||config.paymentAccessMode!=='DISABLED'||config.demoMode||config.seedDemo||config.omiseTestEnabled))throw Error('Unsafe production application configuration')
  if(phase1&&((config.otpSecret||'').length<32||!config.phase1RequirementsRevision||!(config.phase1ActivationMode==='BLOCKED'||(config.phase1ActivationMode==='APPROVED_EXPLICIT_GRANTS'&&/^[a-zA-Z0-9_.:-]{3,120}$/.test(config.phase1InitialGrantPolicy||'')))||!['DISABLED','SMTP'].includes(config.phase1EmailOtpDelivery)||(transport&&!(config.phase1EmailOtpDelivery==='SMTP'&&config.phase1EmailOtpApproval))||config.thaiBulkSmsApiKey||config.thaiBulkSmsOtpKey||config.lineClientSecret&&!config.phase1LineOAuthEnabled||config.googleClientSecret&&!config.phase1CustomerOAuthEnabled||config.facebookClientSecret))throw Error('Unsafe production application configuration')
  if(config.productionPrelaunch && (config.paymentAccessMode!=="DISABLED"||config.demoMode||config.seedDemo||config.omiseTestEnabled||transport))throw Error("Unsafe production application configuration")
  if(config.phase2Enabled&&config.phase2SandboxEnabled&&['development','phase2-local','phase2-preview'].includes(config.appEnvironment)){
    if(config.phase2PaymentProvider==='LOCAL_SIMULATOR'&&!config.phase2SandboxGateway)config.phase2SandboxGateway=new LocalPhase2Sandbox();
    if(config.phase2PaymentProvider==='OMISE_TEST'&&(config.phase2OmiseTestSecretKey||config.phase2OmiseGateway)){
      config.phase2SandboxGateway=new OmisePhase2Proof();config.phase2PaymentService=createPhase2Omise(db,config,config.phase2OmiseGateway);
    }
  }
  if(config.phase1CustomerOAuthEnabled&&(releaseMode!=='PHASE1_PUBLIC'||config.internalAdminSetup||config.publicPublicationDisabled||!config.googleClientId||!config.googleClientSecret||config.lineClientSecret&&!config.phase1LineOAuthEnabled||config.facebookClientSecret))throw Error('Phase1 Google configuration rejected');
  if(config.phase1LineOAuthEnabled&&(releaseMode!=='PHASE1_PUBLIC'||config.internalAdminSetup||config.publicPublicationDisabled||!config.lineClientId||!config.lineClientSecret||config.googleClientSecret&&!config.phase1CustomerOAuthEnabled||config.facebookClientSecret))throw Error('Phase1 LINE configuration rejected');
  if(config.publicUserAccessEnabled&&(releaseMode!=='PHASE1_PUBLIC'||!config.internalAdminSetup||!config.unifiedAuthEnabled||!config.publicPublicationDisabled))throw Error('Public User isolation configuration rejected');
  if(config.internalAdminSetup&&(releaseMode!=='PHASE1_PUBLIC'||!config.publicPublicationDisabled||config.otpLoginEnabled&&!config.publicUserAccessEnabled))throw Error('Admin-only isolation configuration rejected');
  const worker = createMailWorker(db, config, transport)
  if(config.phase2EmailEnabled&&transport)config.phase2NoticeTransport=transport;
  const omiseGateway = config.omiseTestEnabled ? (config.omiseGateway || new OmiseTestGateway({secretKey:config.omiseTestSecretKey})) : null
  const omise = createOmisePayments(db,omiseGateway,{appUrl:config.appUrl,methods:config.omiseTestMethods})
  const attempts = new Map()
  async function rateLimit(req, bucket = "auth") {
    // Vercel overwrites this header. Other hosts use only the direct socket IP.
    const address = config.trustVercelProxy === true
      ? req.headers["x-vercel-forwarded-for"] || req.socket.remoteAddress
      : req.socket.remoteAddress
    const key = hash(/^(checks|omise):/.test(bucket) ? bucket : String(address) + ":" + bucket)
    const limit = ["events", "public", "webhooks"].includes(bucket) ? 300 : 30
    const now = Date.now()
    if (config.serverless) {
      const quotaWork = async () => {
        // No shared cleanup
        return db
          .prepare(
            "INSERT INTO rate_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires<=? THEN 1 ELSE rate_limits.count+1 END,expires=CASE WHEN rate_limits.expires<=? THEN excluded.expires ELSE rate_limits.expires END RETURNING count,expires",
          )
          .get(key, now + 15 * 60000, now, now)
      };
            const directPublicQuota = bucket === "public" && req.method === "GET" && new URL(req.url,"http://localhost").pathname === "/api/public/villas";
      const entry = await timed("rateLimit",()=>directPublicQuota?quotaWork():db.transaction(quotaWork));
      if (entry.count > limit) throw Object.assign(new ApiError(429,"คำขอถี่เกินไป กรุณารอ 15 นาที"),{retryAfter:Math.max(1,Math.ceil((Number(entry.expires)-now)/1000))})
      return
    }
    if (attempts.size > 10000)
      for (const [id, entry] of attempts)
        if (entry.until <= now) attempts.delete(id)
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 }
    if (entry.until <= now) {
      entry.count = 0
      entry.until = now + 15 * 60000
    }
    entry.count++
    attempts.set(key, entry)
    if (entry.count > limit) throw Object.assign(new ApiError(429,"คำขอถี่เกินไป กรุณารอ 15 นาที"),{retryAfter:Math.max(1,Math.ceil((entry.until-now)/1000))})
  }
  const cookie = (token, age = 28800, admin = false) =>
    `${admin ? "vc_admin_session" : "vc_session"}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${age}${
      config.secureCookies ? "; Secure" : ""
    }`
  async function issueSession(req, user, options={}) {
    const issued=await db.transaction(async()=>{
    const current=await db.prepare("SELECT id,email,role,password_hash FROM users WHERE id=?").get(user.id)
    if(!current||current.role!==user.role||current.email!==user.email)fail(401,"ข้อมูลบัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่")
    if(options.expectedPasswordHash&&current.role==="user"&&!await roleOtpContactVerified(db,current,"email",current.email))fail(403,"กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ","EMAIL_VERIFICATION_REQUIRED");
    if(options.expectedPasswordHash&&current.password_hash!==options.expectedPasswordHash)fail(401,"ข้อมูลเข้าสู่ระบบเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่")
    if(options.expectedOAuthIdentity){const identity=await db.prepare("SELECT user_id FROM oauth_identities WHERE provider=? AND subject=?").get(options.expectedOAuthIdentity.provider,options.expectedOAuthIdentity.subject);if(identity?.user_id!==user.id)fail(401,"ช่องทางเข้าสู่ระบบเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่")}
    const admin=new URL(req.url,"http://localhost").pathname === "/api/auth/admin-login";
    if(admin&&!await hasAdminAccess(db,current))fail(403,"Admin access denied");
    if(!admin&&current.role==="admin")fail(403,"Use Admin login","ADMIN_LOGIN_REQUIRED");
    if(admin && new URL(req.url,"http://localhost").pathname !== "/api/auth/admin-login")fail(403,"บัญชี Admin ต้องเข้าสู่ระบบที่ /admin/login เท่านั้น");
    const access=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("account_status:"+user.id);
    if(access && JSON.parse(access.value).status === "suspended")fail(403,"บัญชีถูกระงับการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแล");
    const old = req.headers.cookie?.match(new RegExp("(?:^|;\\s*)"+(admin?"vc_admin_session":"vc_session")+"=([a-f0-9]{64})(?:;|$)"))?.[1]
    if (old)
      await db.prepare("UPDATE sessions SET expires=0 WHERE token_hash=?").run(hash(old))
    // No global session cleanup during authentication.
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex")
    await db
      .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
      .run(hash(token), user.id, csrf, Date.now() + 28800000)
    if(admin&&current.role!=="admin")await bindAdminSession(db,current,hash(token),Date.now()+28800000);
    await db
      .prepare("UPDATE users SET last_login=? WHERE id=?")
      .run(new Date().toISOString(), user.id)
    if(!options.deferSecurityEvent)securityEvent('authentication.succeeded',{actorId:user.id})
    return { csrf, cookie: cookie(token,28800,admin) }
    })
    return issued
  }
  const loginOtp=createLoginOtp(db,config,transport,config.smsFetch||fetch)
  async function session(req) {
    const path=new URL(req.url,"http://localhost").pathname;
    const adminAsset=/^\/api\/public\/(cms-media|property-media-file|villa-photo|review-media)\//.test(path);
    const publicOnly=(!adminAsset && path.startsWith("/api/public/")) || ["/api/auth/me","/api/auth/logout"].includes(path);
    const adminContext=adminAsset || path.startsWith("/api/admin/") || path.startsWith("/api/auth/admin-") || (!publicOnly && req.headers["x-villacheck-portal"] === "admin");
    const names=publicOnly?["vc_session"]:adminContext?["vc_admin_session","vc_session"]:["vc_session","vc_admin_session"];
    let token,name;
    for(const candidate of names){const value=req.headers.cookie?.match(new RegExp("(?:^|;\\s*)"+candidate+"=([a-f0-9]{64})(?:;|$)"))?.[1];if(value){token=value;name=candidate;break}}
    if(!token)fail(401,"กรุณาเข้าสู่ระบบ");
    const row=await db.prepare("SELECT s.*,u.id,u.email,u.name,u.role,a.value AS account_access,m.value AS merchant_capability,EXISTS(SELECT 1 FROM villas owned WHERE owned.owner_id=u.id) AS merchant_existing_owner FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN system_settings a ON a.key='account_status:'||u.id LEFT JOIN system_settings m ON m.key='merchant_profile:'||u.id WHERE token_hash=? AND expires>?").get(hash(token),Date.now());
    if(!row || (row.role === "admin" && name !== "vc_admin_session") || (name === "vc_admin_session" && row.role !== "admin"&&!await validAdminBinding(db,row,hash(token))))fail(401,"Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    if(name==="vc_admin_session"&&row.role!=="admin"){row.primaryRole=row.role;row.role="admin";row.adminSession=true;}
    const business=await businessPermissions(db,row,config);
    row.businessPermissions=business.permissions;row.businessOwner=business.owner;
    if(business.owner&&adminContext&&row.role!=='admin'){row.primaryRole=row.role;row.role='admin';row.adminSession=true;}
    Object.assign(row,withPermissionContext(row,config,null,business.owner,requestCorrelation(req)));
    if(row.account_access && JSON.parse(row.account_access).status === "suspended")fail(403,"บัญชีถูกระงับการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแล");
    if(path.startsWith("/api/auth/admin-") && row.role !== "admin")fail(403,"เฉพาะ Admin");
    if(config.interactiveDemo){row.basicPasswordAccount=await hasBasicPasswordAccount(db,row);row.oauthPublicUser=await publicOAuthUser(db,row,config);row.publicOtpAccount=await hasPublicOtpAccount(db,row);actorAllowed(row,config);}
    row.capabilities=accountCapabilities(row);
    return row;
  }
  async function publicAccount(user){const value=await merchantProfile(db,user);return{unifiedAuthEnabled:config.unifiedAuthEnabled===true,id:user.id,email:await publicOtpEmail(db,user),name:user.name,role:user.primaryRole||user.role,primaryRole:user.primaryRole||user.role,capabilities:accountCapabilities(user,value)};}
  function checkOrigin(req) {
    const origin = req.headers.origin
    if (origin && !config.allowedOrigins.includes(origin))
      fail(403, "Origin ไม่ได้รับอนุญาต")
    if (req.headers["sec-fetch-site"] === "cross-site")
      fail(403, "ไม่อนุญาตคำขอข้ามเว็บไซต์")
  }
  async function auth(req, role) {
    const principal=await session(req)
    let user = config.unifiedAuthEnabled||principal.role==='user'&&principal.capabilities.merchant?actorForRequest(principal,req,role):principal
    if (role && user.role !== role) fail(403, "ไม่มีสิทธิ์ดำเนินการ")
    if (!["GET", "HEAD"].includes(req.method)) {
      checkOrigin(req)
      if (req.headers["x-csrf-token"] !== user.csrf)
        fail(403, "CSRF token ไม่ถูกต้อง กรุณาโหลดหน้าใหม่")
    }
    if(config.interactiveDemo)await authorizeRequest(db,user,req,new URL(req.url,"http://localhost").pathname,new URL(req.url,"http://localhost"),body,config);
    const permission=permissionForRequest(req.method,new URL(req.url,'http://localhost').pathname,user);
    if(permission){const access=await requireBusinessPermission(db,user,config,permission);user=withPermissionContext(user,config,permission,access.owner);}
    return user
  }
  async function villaFor(user, id) {
    const villa = await db.prepare("SELECT * FROM villas WHERE id=?").get(id)
    if (!villa || (user.role !== "admin" && villa.owner_id !== user.id))
      fail(404, "ไม่พบ Villa")
    return villa
  }
  async function invoiceFor(user, id) {
    const invoice = await db
      .prepare("SELECT * FROM invoices WHERE id=?")
      .get(id)
    if (!invoice) fail(404, "ไม่พบใบแจ้งชำระ")
    const villa = await villaFor(user, invoice.villa_id)
    return { invoice, villa }
  }
  async function invoiceDto(invoice,context) {
    const file =
      invoice.proof_id &&
      (context ? context.documents.get(invoice.proof_id) : await db
        .prepare("SELECT name,mime FROM documents WHERE id=?")
        .get(invoice.proof_id))
    return {
      id: invoice.id,
      paymentAccessMode: paymentAccess(config),
      gateway: invoice.external_provider === "OMISE" ? "OMISE" : "MANUAL",
      packageName: (await readContextPlan(db,invoice.package_id || (context?.villas.get(invoice.villa_id) || await db.prepare("SELECT package_id FROM villas WHERE id=?").get(invoice.villa_id)).package_id,context)).name,
      bankQrImage: ["DISABLED","OMISE_TEST"].includes(paymentAccess(config))?"":JSON.parse((await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`invoice_bank_qr:${invoice.id}`))?.value || '""'),
      paymentQr: ["DISABLED","OMISE_TEST"].includes(paymentAccess(config))?null:await paymentQrDto(db, invoice.id),
      scope: invoice.subscription_owner ? "merchant" : "villa",
      villaId: invoice.villa_id,
      amount: invoice.amount / 100,
      months: invoice.months,
      paymentInstructions: ["DISABLED","OMISE_TEST"].includes(paymentAccess(config))?null:(await db.prepare("SELECT payment_instructions FROM mails WHERE invoice_id=?").get(invoice.id))?.payment_instructions ?? null,
      status: invoice.status,
      paymentStatus: invoice.payment_status,
      verificationMode: invoice.verification_mode,
      verifiedByAdminId: invoice.confirmed_by,
      externalTransactionId: invoice.external_transaction_id,
      currency: invoice.currency,
      updatedAt: invoice.updated_at || invoice.created,
      verifiedAt: invoice.paid_at,
      rejectionReason: invoice.reason,
      reference: invoice.reference,
      reason: invoice.reason,
      created: invoice.created,
      paidAt: invoice.paid_at,
      proof: file
        ? {
            name: file.name,
            type: file.mime,
            data: `/api/${context?.documentPortal === "admin" ? "admin/" : ""}documents/${invoice.proof_id}`,
          }
        : null,
    }
  }
  async function villaDto(v,context) {
    const file = context ? context.documents.get(v.document_id) : await db
      .prepare("SELECT name,mime FROM documents WHERE id=?")
      .get(v.document_id)
    const invoices = context ? (context.invoices.get(v.id)||[]) : await db
      .prepare("SELECT * FROM invoices WHERE villa_id=? ORDER BY created DESC")
      .all(v.id)
    const pageRecord=context?context.settings.get("villa_page:"+v.id):await db.prepare("SELECT value FROM system_settings WHERE key=?").get("villa_page:"+v.id);
    const freeTrial=await villaFreeTrial(db,v,Date.now(),context)||(perVillaTrialEnabled(config)&&v.payments===0&&!v.qr&&!v.expires?pendingVillaTrial(v):null);
    const freePeriod=freeTrial||await merchantFreePeriod(db,v.owner_id,Date.now(),context)
    const packagePlan=await readContextPlan(db,freeTrial?"starter":v.package_id,context)
    const ownerLifecycle=context?.subscriptions.get(v.owner_id)?.lifecycle
    const trust=await trustDto(db,v,context)
    return {
      id: v.id,
      ...(context?.qrScanCounts?{qrScans:context.qrScanCounts.get(v.id)||{total:0,last30Days:0}}:{}),
      freeTrial,
      name: v.name,
      nameEn: v.name_en,
      propertyDescription:pageRecord?JSON.parse(pageRecord.value).details?.description||"":"",
      trialUnlimited: phase1||freePeriod ? false : v.payments === 0,
      createdAt: v.created,
      photoUrl: v.photo_url,
      demoImage: config.appEnvironment==='staging'&&isDemoVilla(v),
      photoUploadedAt: v.photo_uploaded_at, photoTakenAt: v.photo_taken_at, photoReviewedAt: v.photo_reviewed_at,
      guestCapacity: v.guest_capacity,
      reviewRequest: await villaReview(db,v,context ? context.settings.get("villa_review:"+v.id) ?? null : undefined),
      province: v.province,
      merchant: v.merchant,
      email: v.email,
      package: freePeriod ? `${packagePlan.name} · ใช้งานฟรี` : phase1 ? packagePlan.name : `${packagePlan.name} · ฿${packagePlan.amount / 100} / เดือน`,
      documentReviewStatus: {
        pending: "PENDING_REVIEW",
        approved: "APPROVED",
        changes: "CHANGE_REQUESTED",
        rejected: "REJECTED",
      }[v.status],
      reviewedAt: v.reviewed_at,
      reviewedByAdminId: v.reviewed_by,
      ...trust,
      ...(config.phase2Enabled?{phase2Access:await phase2VillaAccess(db,v,config)}:{}),
      packageId: freeTrial?"starter":v.package_id,
      phone: v.phone,
      bankName: v.bank_name,
      accountName: v.account_name,
      accountNumber: v.account_number,
      status: v.status,
      reason: v.reason,
      qr: v.qr || "",
      expires: v.expires || "",
      payments: v.payments,
      paymentPending: invoices.some((i) => i.status !== "paid"),
      approvalStatus: v.status === "approved" ? "APPROVED" : v.status === "rejected" ? "REJECTED" : v.status === "changes" ? "CHANGE_REQUESTED" : "PENDING_APPROVAL",
      paymentStatus: invoices.some(i=>i.status==="paid"&&i.payment_status==="FAILED") ? "RECONCILIATION_REQUIRED" : invoices.some(i=>i.status==="submitted") ? "PENDING_REVIEW" : invoices.some(i=>i.status==="pending"&&i.payment_status==="FAILED") ? "FAILED" : invoices.some(i=>i.status==="pending") ? "UNPAID" : invoices.some(i=>i.status==="paid") ? "PAID" : "NO_PAYMENT_REQUIRED",
      subscriptionStatus: trust.membershipState==="GRACE_PERIOD"?"GRACE_PERIOD":["SUSPENDED","CANCELLED"].includes(ownerLifecycle) ? ownerLifecycle : v.expires ? new Date(v.expires)>new Date() ? "ACTIVE" : "EXPIRED" : v.payments===0 ? "PROMOTIONAL" : "EXPIRED",
      document: {
        name: file.name,
        type: file.mime,
        data: `/api/${context?.documentPortal === "admin" ? "admin/" : ""}documents/${v.document_id}`,
      },
      invoices: await Promise.all(invoices.map(invoice=>invoiceDto(invoice,context))),
    }
  }
  async function state(user) {
    const freePeriodRead=merchantFreePeriod(db,user.id)
    const [villas,mails,isDemo,subscription,paymentVerificationMode,freePeriod] = await Promise.all([
      user.role === "admin"
        ? config.interactiveDemo?stagingAdminVillas(db):db.prepare("SELECT * FROM villas ORDER BY created DESC").all()
        : db
            .prepare(
              "SELECT * FROM villas WHERE owner_id=? ORDER BY created DESC",
            )
            .all(user.id),
      user.role === "admin"
        ? []
        : db.prepare("SELECT m.* FROM mails m JOIN villas v ON v.id=m.villa_id WHERE v.owner_id=? ORDER BY m.created DESC").all(user.id),
      demoMode(db,config),
      subscriptionDto(db,user.id,freePeriodRead),
      getVerificationMode(db,config.paymentVerificationMode||"MANUAL"),
      freePeriodRead,
    ])
    const [context,invoiceRows,bank,cms,qrScanCounts]=await Promise.all([
      loadTrustContext(db,villas,{reviews:true}),
      selectByIds(db,"SELECT * FROM invoices WHERE villa_id",villas.map(v=>v.id)," ORDER BY created DESC"),
      isDemo||paymentAccess(config)==="DISABLED"?null:receivingBank(db),
      isDemo||paymentAccess(config)==="DISABLED"?null:publishedCms(db),
      user.role==='merchant'?merchantQrScanCounts(db,user.id):null,
    ]);
    if(user.role==='merchant')context.qrScanCounts=qrScanCounts;
    const documents=await selectByIds(db,"SELECT id,name,mime FROM documents WHERE id",[...villas.map(v=>v.document_id),...invoiceRows.map(i=>i.proof_id)]);
    context.documentPortal=user.role;
    context.documents=new Map(documents.map(row=>[row.id,row]));
    context.villas=new Map(villas.map(v=>[v.id,v]));
    context.invoices=new Map();
    for(const invoice of invoiceRows){const rows=context.invoices.get(invoice.villa_id)||[];rows.push(invoice);context.invoices.set(invoice.villa_id,rows);}
    const instructions=paymentAccess(config)==="DISABLED"?"ปิดรับชำระชั่วคราว":isDemo ? "DEMO: test payment only. Do not transfer real money. Generate a dummy slip for Admin manual review." : bank?bankInstructions(bank):cms.content.site.paymentInstructions||config.paymentInstructions;
    return {
      merchantActions:user.role==='merchant'?await merchantActionItems(db,user):undefined,
      villas: await Promise.all(villas.map(v=>villaDto(v,context))),
      mails: mails.map((m) => ({
        id: m.id,
        villaId: m.villa_id,
        to: m.recipient,
        subject: m.subject,
        body: m.body,
        created: m.created,
        status: m.status === "demo" ? "demo" : !transport && m.status !== "sent" ? "waiting_config" : m.status,
        error: m.last_error,
      })),
      user: {
        id: user.id,
        name: user.name,
        email: await publicOtpEmail(db,user),
        role: user.role,
        primaryRole:user.primaryRole||user.role,
        capabilities:user.capabilities,
      },
      freePeriod,
      perVillaTrial:perVillaTrialEnabled(config),
      subscription:phase1&&subscription?{...subscription,billingCycle:null,billingMonths:null,renewalDate:null}:subscription,
      releaseMode:config.productionReleaseMode||(config.interactiveDemo?"STAGING_INTERACTIVE":"STAGING"),
      packageModel: "PER_VILLA",
      demoMode:isDemo,
      paymentBankQrImage: ["DISABLED","OMISE_TEST"].includes(paymentAccess(config))||isDemo ? "" : (bank?.qrImage || cms.content.site.paymentQrImage || ""),
      paymentInstructions:
        ["DISABLED","OMISE_TEST"].includes(paymentAccess(config))?"ปิดรับชำระชั่วคราว":instructions ||
        "ยังไม่ได้ตั้งค่าบัญชีรับชำระ กรุณาติดต่อทีมงานก่อนโอนเงิน",
      paymentVerificationMode,
      paymentAccessMode:paymentAccess(config),
      paymentConfigured: paymentAccess(config)!=="DISABLED" && (isDemo || Boolean(bank) || config.omiseTestEnabled === true),
      smtpConfigured: Boolean(transport),
    }
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Referrer-Policy", "same-origin")
    res.setHeader("Cache-Control", "no-store")
    const json = (value, status = 200) => {
      res.setHeader("Content-Language",/^en(?:-|,|;|$)/i.test(String(req.headers["accept-language"]||""))?"en":"th");
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      })
      res.end(timedSync("serialize",()=>JSON.stringify(value)))
    }
    try {
      res.setHeader("X-Request-ID",requestCorrelation(req));
      const url = new URL(req.url, "http://localhost")
      let path = url.pathname
      if(config.phase2Enabled&&path==='/api/webhooks/omise'&&req.method==='POST'){requirePhase2(config);await rateLimit(req,'phase2-webhook');if(!config.phase2PaymentService)fail(503,'Omise Sandbox not configured');await config.phase2PaymentService.webhook(await body(req));return json({received:true});}
      if(path.startsWith('/api/phase2/')){if(!knownApiPath(path))return json({error:'ไม่พบ API'},404);requirePhase2(config);await rateLimit(req,['GET','HEAD'].includes(req.method)?'public':'phase2');const actor=path==='/api/phase2/public'?null:await auth(req);const workspaceSessionClaims=[];if(path==='/api/phase2/workspaces'&&actor){for(const [portal,sessionUrl]of [['user','/api/auth/me'],['admin','/api/auth/admin-me']]){try{const current=await session({url:sessionUrl,headers:req.headers});if(current.id===actor.id)workspaceSessionClaims.push({id:current.id,portal,merchant:current.capabilities?.merchant===true});}catch(error){if(![401,403].includes(error.status))throw error;}}}return json(await phase2Api(db,actor,req,path,url,body,{...config,phase2WorkspaceSessionClaims:workspaceSessionClaims}));}
      if(config.interactiveDemo)await beforeRequest(req,path,body,config,db)
      if(knownApiPath(path)&&phase2LegacyWriteBlocked(config,req.method,path))fail(503,'Legacy package/payment writes disabled in Phase2; use the isolated Sandbox');
      if(path.startsWith("/api/")&&!knownApiPath(path))return json({error:"ไม่พบ API"},404);
      if(req.method==="HEAD")req.method="GET";
      if(config.appEnvironment==='production'&&path==='/api/public/cms'&&req.method==='GET'){const release=await publishedCms(db);return json({...publicFrontendCms(release,await publishedCmsMedia(db,release)),publicFrontendReadOnly:config.publicPublicationDisabled===true});}
      if(config.internalAdminSetup&&path.startsWith('/api/public/')){
        if(req.method!=='GET')fail(503,'ข้อมูลที่พักยังไม่พร้อมเผยแพร่ / Property information is not available yet');
        if(path==='/api/public/cms'){const release=await publishedCms(db);return json(publicFrontendCms(release,await publishedCmsMedia(db,release)));}
        if(['/api/public/villas','/api/public/advertisements','/api/public/reviews'].includes(path))return json({villas:[],advertisements:[],reviews:[],deferred:true,internalAdminSetup:true});
        if(path.startsWith('/api/public/cms-media/')){/* Published CMS-only references are checked by the media handler below. */}
        else if(['/api/public/property-media-file/','/api/public/villa-photo/','/api/public/review-media/'].some(prefix=>path.startsWith(prefix))){const viewer=await session(req).catch(e=>{if(e.status===401)return null;throw e});if(!viewer||path.startsWith('/api/public/cms-media/')&&viewer.role!=='admin')fail(404,'ไม่พบไฟล์')}else fail(503,'ข้อมูลที่พักยังไม่พร้อมเผยแพร่ / Property information is not available yet');
      }
      if(releaseMode && path.startsWith('/api/') && !productionRequestAllowed(req.method,path,releaseMode,{businessInitializationDisabled:config.businessInitializationDisabled===true,propertyMediaWorkflowEnabled:config.propertyMediaWorkflowEnabled===true,otpLoginEnabled:config.otpLoginEnabled===true,unifiedAuthEnabled:config.unifiedAuthEnabled===true,adminPasswordSetupEnabled:config.adminPasswordSetupEnabled===true,adminOnly:config.internalAdminSetup===true,publicUserAccessEnabled:config.publicUserAccessEnabled===true,googleOAuthEnabled:config.phase1CustomerOAuthEnabled===true,lineOAuthEnabled:config.phase1LineOAuthEnabled===true}))fail(503,'Production '+(phase1?'Phase1':'prelaunch')+': action disabled')
      if(config.appEnvironment==='production'&&path.startsWith('/api/')){try{await verifyProductionDemoGate(db)}catch{fail(503,'Production demo data is not authorized; access is blocked')}}
      if(phase1&&!config.otpLoginEnabled&&config.phase1EmailOtpDelivery==='DISABLED'&&['/api/auth/register','/api/auth/registration/verify'].includes(path))fail(503,'Phase1 registration email delivery is not approved')
      if(['/api/auth/admin-password/request','/api/auth/admin-password/complete','/api/admin/password-invitation'].includes(path)){
        if(req.method!=='POST')fail(405,'POST required');checkOrigin(req);await rateLimit(req,'admin-password');const data=await body(req);
        res.setHeader('Cache-Control','no-store');
        if(path==='/api/auth/admin-password/request')return json(await requestAdminSetup(db,config,config.adminPasswordSetupTransport||config.otpLoginTransport||transport,data.email),202);
        if(path==='/api/auth/admin-password/complete')return json(await completeAdminSetup(db,config,data));
        const actor=await auth(req,'admin');
        if(data.action==='revoke')return json(await revokeAdminSetup(db,config,actor,data.email));
        return json(await requestAdminSetup(db,config,config.adminPasswordSetupTransport||config.otpLoginTransport||transport,data.email,{actor,purpose:'setup'}),202);
      }
      if(path==="/api/public/privacy-notice"&&req.method==="GET")return json(await privacyNoticeVersion(db))
      if (path === "/api/public/cms" && req.method === "GET") {
        const release = await publishedCms(db)
        const content = structuredClone(release.content)
        content.site.paymentInstructions = ""
        content.site.paymentQrImage = ""
        content.business.paymentEmailSubject = ""
        content.business.paymentEmailIntro = ""
        for(const key of ["emailOtpSubject","emailOtpBody","smsOtpBody","emailOtpTemplateId"])content.business[key]=""
        content.articles = content.articles.filter(x => x.visible)
        content.faqs = content.faqs.filter(x => x.visible)
        content.home.blocks = content.home.blocks.filter(x => x.visible)
        content.pages = content.pages.map(p => ({...p, blocks:p.blocks.filter(x => x.visible)}))
        return json({revision:release.revision,carouselTimingVersion:release.carouselTimingVersion??0,content})
      }
      if(path === "/api/public/property-media" && req.method === "GET") return json(await propertyMediaApi(db,null,req,path,url,body,membershipTrustOptions));
      const mediaFile=path.match(/^\/api\/public\/property-media-file\/([a-f0-9-]{36})$/)
      if(mediaFile && req.method === "GET") {
        const viewer=await session(req).catch(e=>{if(e.status===401)return null;throw e})
        const file=await propertyMediaFile(db,mediaFile[1],viewer,membershipTrustOptions)
        return await sendPropertyFile(file,req,res)
      }
      if(path === "/api/public/advertisements" && req.method === "GET") return json(phase1?{advertisements:[],deferred:true}:await advertisingApi(db,null,req,path,url,body));
      if(path === "/api/public/reviews" && req.method === "GET") return json(await reviewsApi(db,null,req,path,url,body,config));
      const reviewFile = path.match(/^\/api\/public\/review-media\/([a-f0-9-]{36})$/)
      if(reviewFile&&["GET","HEAD"].includes(req.method)){
        const viewer=await session(req).catch(error=>{if(error.status===401)return null;throw error})
        return await sendReviewMedia(db,viewer,reviewFile[1],req,res,config)
      }
      const cmsMedia = path.match(/^\/api\/public\/cms-media\/([a-f0-9-]+)$/)
      if (cmsMedia && req.method === "GET") {
        const rawRelease = await publishedCms(db)
        const release=config.appEnvironment==='production'||config.internalAdminSetup?{...rawRelease,content:publicFrontendCms(rawRelease,await publishedCmsMedia(db,rawRelease)).content}:rawRelease;
        const imageUrls = [...(release.content.home.introVisible!==false?[release.content.home.introImage||"",release.content.home.introMobileImage||""]:[]),...release.content.home.sections.filter(s=>s.visible).map(s=>s.image||""),release.content.site.logo,...bannerMedia({en:release.content.home.en}),...shortcutMediaUrls(release.content,true),...presentationMedia(release.content,true),...release.content.home.images,...(release.content.home.banners || []).filter(b=>b.visible && (!b.startsAt || Date.parse(b.startsAt)<=Date.now()) && (!b.endsAt || Date.parse(b.endsAt)>Date.now())).flatMap(b=>bannerMedia(b)), ...release.content.home.blocks.filter(x=>x.visible).map(x=>x.image), ...release.content.pages.flatMap(p=>p.blocks.filter(x=>x.visible).map(x=>x.image)), ...release.content.articles.filter(x=>x.visible).flatMap(x=>[x.image,x.detailImage,x.en?.image,x.en?.detailImage,...(x.blocks||[]).filter(b=>b.visible).map(b=>b.image),...(x.en?.blocks||[]).filter(b=>b.visible).map(b=>b.image)])]
        if (!imageUrls.includes(path)&&!config.internalAdminSetup&&!(config.appEnvironment==='production'&&phase1)) {
          for(const placement of ["home","detail","footer"]) {
            const result=await advertisingApi(db,null,{method:"GET"},"/api/public/advertisements",new URL("http://localhost?placement="+placement),body)
            imageUrls.push(...result.advertisements.flatMap(a=>bannerMedia(a)))
          }
        }
        if (!imageUrls.includes(path)) {
          const viewer = await session(req).catch(error => { if (error.status === 401) return null; throw error })
          const merchantQr = ["LEGACY_MANUAL","DEMO"].includes(paymentAccess(config)) && viewer?.role === "merchant" && (release.content.site.paymentQrImage === path || await db.prepare("SELECT i.id FROM invoices i JOIN villas v ON v.id=i.villa_id JOIN system_settings s ON s.key='invoice_bank_qr:' || i.id WHERE v.owner_id=? AND s.value=?").get(viewer.id,JSON.stringify(path)))
          if (viewer?.role !== "admin" && !merchantQr) fail(404, "ไม่พบรูปภาพ")
        }
        const image = await db.prepare("SELECT mime,bytes FROM documents WHERE id=? AND name LIKE 'cms-image:%'").get(cmsMedia[1])
        if (!image) fail(404, "ไม่พบรูปภาพ")
        const variantWidth=bannerVariantWidth(url.searchParams);
        const bytes=variantWidth?await cmsImageVariant(Buffer.from(image.bytes),variantWidth):Buffer.from(image.bytes);
        res.writeHead(200, {"Content-Type": variantWidth?"image/webp":image.mime,"Cache-Control":"private, no-store","Content-Length":bytes.length})
        // Stream image responses as well as uploading in parts, so 5 MB images
        // do not require a buffered serverless response of the same size.
        res.flushHeaders()
        return await pipeline(Readable.from((function* () {
          for (let offset = 0; offset < bytes.length; offset += 64 * 1024)
            yield bytes.subarray(offset, offset + 64 * 1024)
        })()), res)
      }
      const adminPaymentAction = path.match(
        /^\/api\/admin\/payments\/([a-f0-9-]+)\/(approve|reject)$/,
      )
      if (req.method === "PATCH" && adminPaymentAction)
        path = `/api/invoices/${adminPaymentAction[1]}/${
          adminPaymentAction[2] === "approve" ? "confirm" : "reject"
        }`
      const slipAction = path.match(/^\/api\/payments\/([a-f0-9-]+)\/slip$/)
      if (slipAction) path = `/api/invoices/${slipAction[1]}/proof`
      const publicPhoto=path.match(/^\/api\/public\/villa-photo\/([a-f0-9-]+)$/)
      if(req.method==='GET'&&publicPhoto){
        const photo=await db.prepare("SELECT d.mime,d.bytes,d.owner_id FROM documents d WHERE d.id=? AND d.name='villa-photo' AND NOT EXISTS(SELECT 1 FROM villas v WHERE v.document_id=d.id) AND NOT EXISTS(SELECT 1 FROM system_settings p WHERE p.key='private_document:'||d.id)").get(publicPhoto[1])
        if(!photo||!['image/jpeg','image/png'].includes(photo.mime))fail(404,'ไม่พบรูป Villa')
        const villas=await db.prepare("SELECT * FROM villas WHERE owner_id=?").all(photo.owner_id)
        const published=await Promise.all(villas.map(v=>publicRevision(db,v,undefined,membershipTrustOptions)))
        if(config.publicPublicationDisabled||!(await Promise.all(published.filter(v=>v?.status==='approved'&&v.photo_url===path).map(v=>trustDto(db,v)))).some(v=>(v.publicQrStatus||v.qrStatus)==='ACTIVE')){
          const viewer=await session(req).catch(error=>{if(error.status===401)return null;throw error})
          if(viewer?.role!=='admin'&&viewer?.id!==photo.owner_id)fail(404,'ไม่พบรูป Villa')
        }
        res.setHeader('Cache-Control','private, no-store')
        return await sendPropertyFile(photo,req,res)
      }
      const publicReport=path.match(/^\/api\/public\/reports\/(RPT-[A-Za-z0-9-]{1,64})$/)
      if(req.method === "GET" && publicReport){
        const report=await db.prepare("SELECT reference,status,public_note,user_id FROM support_reports WHERE reference=?").get(publicReport[1])
        if(!report)fail(404,"ไม่พบ Report")
        let viewer;try{viewer=await session(req)}catch(error){if(error.status!==401)throw error}
        return json({reference:report.reference,status:report.status,publicNote:report.public_note,linkedToUser:Boolean(viewer && viewer.id===report.user_id)})
      }
      if (req.method === "POST" && ["/api/public/reports","/api/public/events"].includes(path)) {
        checkOrigin(req); await rateLimit(req,path==="/api/public/events"?"events":"auth")
        const data=await body(req)
        if(path==="/api/public/events"){
          if(releaseMode==='PHASE1_PUBLIC'&&data.kind!=='QR_SCAN')fail(400,'Only QR scan events are supported');
          let viewer=await session(req).catch(error=>{if(error.status===401)return null;throw error});
          if(req.headers.cookie?.includes('vc_admin_session=')){const adminViewer=await session({url:'/api/auth/admin-me',headers:req.headers}).catch(error=>{if(error.status===401)return null;throw error});if(adminViewer?.role==='admin')viewer=adminViewer;}
          return json(await recordEvent(db,data.qr,data.kind,{eventId:data.eventId,viewer,trustOptions:membershipTrustOptions}));
        }
        let viewer
        try {viewer=await session(req)} catch(error){if(error.status!==401)throw error}
        if(viewer && req.headers["x-csrf-token"]!==viewer.csrf)fail(403,"CSRF token ไม่ถูกต้อง")
        if(config.unifiedAuthEnabled&&viewer?.capabilities?.user===true)viewer=actorForRequest(viewer,req,'user');
        req.body=data;if(config.interactiveDemo)await authorizeRequest(db,viewer,req,'/api/user/scoped-report',url,body,config);
        return json(await createReport(db,data,viewer))
      }
      if (req.method === "POST" && path === "/api/leads") {
        await rateLimit(req)
        checkOrigin(req)
        const data = await body(req)
        if (!["USER", "MERCHANT"].includes(data.type))
          fail(400, "ประเภท Lead ไม่ถูกต้อง")
        const name = text(data.name, "ชื่อ"),
          address = email(data.email),
          phone = typeof data.phone === "string" ? data.phone.trim() : ""
        if (phone.length > 30) fail(400, "เบอร์โทรไม่ถูกต้อง")
        const now = new Date().toISOString()
        const inserted=await db.prepare("INSERT INTO leads(id,type,name,email,phone,source,created,updated) VALUES (?,?,?,?,?,'CONTACT',?,?) ON CONFLICT(id) DO NOTHING RETURNING id").get(config.interactiveDemo?(scope.leadIds?.[data.email]||scope.leadId):randomUUID(),data.type,name,address,phone,now,now);if(!inserted)fail(409,'บันทึกข้อมูลติดต่อ E2E นี้แล้ว')
        return json({ ok: true })
      }
      if (req.method === "GET" && path === "/api/packages") {
        const viewer=await auth(req)
        if(!["merchant","admin"].includes(viewer.role))fail(403,"แพ็กเกจสำหรับ Merchant ใน Member Room")
        return json({ packages: (await listPlans(db)).map(p=>(phase1||config.interactiveDemo)?phase1PackageDisplay(p):p) })
      }
      if (req.method === "GET" && path === "/api/health")
        return json({ ok: true })
      if (req.method === "GET" && path === "/api/config") {
        const [loginConfig,isDemo]=await Promise.all([cmsLoginConfig(db,config),demoMode(db,config)])
        const publicOtpConfig=config.otpLoginEnabled===true?{...loginConfig,...config.otpLoginProviderConfig,otpSecret:config.otpSecret,otpLoginOnly:true}:loginConfig
        return json({
          internalAdminSetup:config.internalAdminSetup===true,
          publicFrontendReadOnly:config.internalAdminSetup===true,
          publicRegistrationEnabled:config.internalAdminSetup!==true||config.publicUserAccessEnabled===true,
          publicUserAccessEnabled:config.publicUserAccessEnabled===true,
          publicPublicationEnabled:config.publicPublicationDisabled!==true,
          accountSecurityAvailable:true,
          unifiedAuthEnabled:config.unifiedAuthEnabled===true,
          passwordRecoveryAvailable:config.unifiedAuthEnabled===true?otpChannels(publicOtpConfig,config.otpLoginTransport||transport).email:Boolean(otpChannels(config,transport).email&&(!releaseMode||config.currentPhaseFeaturesEnabled===true)), 
          publicSiteUrl: config.appUrl,
          localAccounts: Boolean(config.seedDemo),
          paymentAccessMode:paymentAccess(config),
          paymentConfigured: paymentAccess(config)!=="DISABLED" && ((isDemo) || Boolean(await receivingBank(db)) || config.omiseTestEnabled === true),
          productionDemoDataApproval:config.appEnvironment==='production'?'ZERO_DEMO_DATA':undefined,
          releaseMode:config.productionReleaseMode||(config.interactiveDemo?'STAGING_INTERACTIVE':'STAGING'),
          phoneRegistrationEnabled:config.interactiveDemo?config.phoneRegistrationEnabled===true:!releaseMode&&!config.businessInitializationDisabled,
          scopedPhoneRegistration:config.interactiveDemo&&config.phoneRegistrationEnabled===true,
          businessFeaturesEnabled:!config.businessInitializationDisabled,
          propertyMediaWorkflowEnabled:config.propertyMediaWorkflowEnabled===true,
          activationBlocked:!perVillaTrialEnabled(config)&&(phase1||config.businessInitializationDisabled===true),
          trialPolicy:perVillaTrialEnabled(config)?{days:90,amount:0,packageId:"starter",scope:"VILLA",startTrigger:"PROPERTY_AND_DOCUMENTS_APPROVED"}:null,
          oauth: phase1&&!config.phase1CustomerOAuthEnabled&&!config.phase1LineOAuthEnabled?{google:false,line:false,facebook:false}:oauthProviders(loginConfig),
          oauthExistingAccountsOnly:config.oauthExistingAccountsOnly===true,
          oauthPublicUserRegistration:config.oauthPublicUserRegistration===true,
          oauthPublicMerchantRegistration:!config.unifiedAuthEnabled&&config.oauthPublicMerchantRegistration===true,
          oauthStatus:{facebook:(loginConfig).facebookLoginEnabled?"enabled":"pending_approval"},
          otpLoginEnabled:config.otpLoginEnabled===true,
          publicOtpRegistrationEnabled:config.otpLoginEnabled===true,
          merchantRegistrationDocumentsEnabled:!config.unifiedAuthEnabled&&config.otpLoginEnabled===true&&config.merchantRegistrationDocumentsEnabled!==false,
          otp: (config.interactiveDemo||releaseMode)?config.otpLoginEnabled===true?otpChannels(publicOtpConfig,config.otpLoginEnabled===true?(config.otpLoginTransport||transport):transport):{email:false,sms:false}:otpChannels(publicOtpConfig,config.otpLoginEnabled===true?(config.otpLoginTransport||transport):transport),
          demoMode: isDemo,
        })
      }
      if (
        req.method === "GET" &&
        /^\/api\/auth\/oauth\/(google|facebook|line)\/start$/.test(path)
      )
        await rateLimit(req)
      if (/^\/api\/auth\/oauth\/facebook\/(start|callback)$/.test(path) && !(await cmsLoginConfig(db,config)).facebookLoginEnabled){res.writeHead(302,{Location:`${config.appUrl}/#page=login&oauth_error=pending_approval`});res.end();return}
      if(req.method==='GET'&&path==='/api/auth/oauth/status'){const actor=await auth(req);if(!['user','merchant'].includes(actor.role))fail(403,'เฉพาะ User หรือ Merchant');return json(await db.transaction(()=>customerOAuthStatus(db,actor)))}
      if(['/api/merchant/media-upload','/api/admin/media-upload'].includes(path)){
        const actor=await auth(req,path.includes('/admin/')?'admin':'merchant');if(req.method!=='POST')fail(405,'ไม่รองรับคำขอ');const uploadData=await body(req);if(uploadData.action==='start')await rateLimit(req,'checks:property-upload:'+actor.id);return json(await propertyUpload(db,actor,uploadData));
      }
      if (path.startsWith("/api/auth/oauth/")) {
        const linking=req.method==='POST'&&/^\/api\/auth\/oauth\/(google|facebook|line)\/link$/.test(path)
        const reauthenticating=req.method==='POST'&&/^\/api\/auth\/oauth\/(google|line)\/reauth$/.test(path)
        let linkUser=linking||reauthenticating?await auth(req):null
        if(linking||reauthenticating){if(!['user','merchant'].includes(linkUser.role))fail(403,'บัญชีนี้ไม่สามารถเชื่อม OAuth');await rateLimit(req);const data=await body(req);if(reauthenticating){const purpose=data.purpose===undefined?'link-provider':data.purpose;if(!['link-provider','password','logout-all','phone-change'].includes(purpose))fail(400,'รายการยืนยันบัญชีไม่ถูกต้อง');linkUser={...linkUser,oauthReauthPurpose:purpose}}if(linking&&typeof data.currentPassword==='string'&&data.currentPassword.length){const credential=await db.prepare('SELECT password_hash FROM users WHERE id=?').get(linkUser.id);if(data.currentPassword.length>128||!credential||!await verifyPasswordAsync(data.currentPassword,credential.password_hash))fail(403,'กรุณายืนยันรหัสผ่านปัจจุบัน');linkUser={...linkUser,oauthCredentialHash:credential.password_hash}}}
        if(req.method==='GET'&&path.endsWith('/callback')&&/^[a-f0-9]{64}$/.test(url.searchParams.get('state')||'')){
          const pending=await db.prepare('SELECT return_to FROM oauth_states WHERE state_hash=?').get(hash(url.searchParams.get('state')))
          const bindingId=pending?new URLSearchParams(pending.return_to.slice(1)).get('linkAccount')||new URLSearchParams(pending.return_to.slice(1)).get('reauthAccount'):null
          if(bindingId){linkUser=await auth(req);if(linkUser.id!==bindingId||!['user','merchant'].includes(linkUser.role))fail(403,'ใช้บัญชีที่เริ่มยืนยันช่องทางนี้')}
        }
        if(await createOAuth(db,{...await cmsLoginConfig(db,config),oauthAccountAllowed:config.interactiveDemo?async user=>{user.oauthPublicUser=await publicOAuthUser(db,user,config);actorAllowed(user,config)}:undefined},issueSession,config.oauthFetch||fetch)(req,res,url,linkUser))return
      }
      if(/^\/api\/(?:merchant\/registration(?:$|-documents\/)|admin\/(?:merchant-registrations(?:$|\/)|registration-documents\/))/.test(path)){
        const actor=await auth(req,path.startsWith('/api/admin/')?'admin':'merchant');
        const result=await merchantRegistrationApplication(db,actor,req,path,url,body,document);
        if(result===undefined)fail(404,"ไม่พบคำขอ");
        if(result?.privateDocument){await sendMerchantRegistrationDocument(result.privateDocument,req,res,url);return;}
        return json(result);
      }
      if(config.unifiedAuthEnabled&&path==='/api/user/merchant-registration'){
        const actor=await auth(req,'user');
        if(req.method==='GET')return json({registered:actor.capabilities.merchant,registrationRequired:!actor.capabilities.merchant,profile:await merchantProfile(db,actor),draft:actor.capabilities.merchant?null:await merchantEnrollmentDraft(db,actor)});
        if(req.method!=='POST')fail(405,'ไม่รองรับคำขอ');
        await rateLimit(req);
        const enrollment=await body(req);
        if(enrollment?.action==='saveDraft'){if(Object.keys(enrollment).some(k=>!['action','fields'].includes(k)))fail(400,'Invalid draft request');return json({draft:await merchantEnrollmentDraft(db,actor,enrollment.fields)});}
        const result=await registerMerchantCapability(db,actor,enrollment,user=>issueSession(req,user),{deferInitialGrant:config.phase2Enabled===true});
        res.setHeader('Set-Cookie',result.issued.cookie);
        return json({user:await publicAccount(result.user),csrf:result.issued.csrf,alreadyRegistered:result.alreadyRegistered});
      }
      if(config.unifiedAuthEnabled&&req.method==='GET'&&path==='/api/auth/otp/status'){
        if(url.searchParams.get('profile')==='true'){const actor=await auth(req);if([...url.searchParams.keys()].some(k=>k!=='profile'))fail(400,'คำขอไม่ถูกต้อง');return json(await phoneProfileStatus(db,actor));}
        const id=url.searchParams.get('challengeId');
        const credential=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('unified_credentials:'+id);
        let kind;try{kind=JSON.parse(credential?.value).kind}catch{}
        const name=kind==='register'?'vc_registration':kind==='recovery'?'vc_recovery':'vc_otp_login';
        const nonce=req.headers.cookie?.match(new RegExp('(?:^|;\\s*)'+name+'=([a-f0-9]{64})(?:;|$)'))?.[1];
        return json(await loginOtp.status(id,nonce));
      }
      if(config.unifiedAuthEnabled&&req.method==='POST'&&['/api/auth/register-user','/api/auth/registration/verify','/api/auth/recovery/request','/api/auth/recovery/verify'].includes(path)){
        checkOrigin(req);await rateLimit(req);const data=await body(req),kind=path.startsWith('/api/auth/recovery/')?'recovery':'register',name=kind==='register'?'vc_registration':'vc_recovery';
        if(path==='/api/auth/register-user'||path.endsWith('/request')){
          const {nonce,...result}=await beginUnifiedCredentials(db,loginOtp,kind,data);
          res.setHeader('Set-Cookie',`${name}=${nonce}; HttpOnly; Path=/; SameSite=Lax; Max-Age=300${config.secureCookies?'; Secure':''}`);
          return json(result,202);
        }
        const nonce=req.headers.cookie?.match(new RegExp('(?:^|;\\s*)'+name+'=([a-f0-9]{64})(?:;|$)'))?.[1];
        const result=await finishUnifiedCredentials(db,loginOtp,kind,data,nonce,kind==='register'?user=>issueSession(req,user):undefined);
        res.setHeader('Set-Cookie',[`${name}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${config.secureCookies?'; Secure':''}`,kind==='register'?result.issued.cookie:cookie('',0,false)]);
        return json(kind==='register'?{user:await publicAccount(result.user),csrf:result.issued.csrf}:{ok:true});
      }
      if(req.method === "POST" && path === "/api/auth/registration/verify") {
        checkOrigin(req);await rateLimit(req)
        const nonce=req.headers.cookie?.match(/(?:^|;\s*)vc_registration=([a-f0-9]{64})(?:;|$)/)?.[1]
        let user;try{user=await finishPasswordRegistration(db,loginOtp,await body(req),nonce)}catch(error){if(error.status===503)fail(503,error.message);throw error}
        const issued=await issueSession(req,user)
        res.setHeader("Set-Cookie",[issued.cookie,`vc_registration=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${config.secureCookies?"; Secure":""}`])
        return json({user:{id:user.id,email:user.email,name:user.name,role:user.role},csrf:issued.csrf})
      }
      if(req.method==='POST'&&['/api/auth/recovery/request','/api/auth/recovery/verify'].includes(path)){
        checkOrigin(req);await rateLimit(req)
        const data=await body(req)
        if(path.endsWith('/request')){
          const pending=await beginRoleSafePasswordRecovery(db,loginOtp,data,beginPasswordRecovery)
          res.setHeader('Set-Cookie',`vc_recovery=${pending.nonce}; HttpOnly; Path=/; SameSite=Lax; Max-Age=300${config.secureCookies?'; Secure':''}`)
          const {nonce:_,...publicResult}=pending
          void _
          return json(publicResult,202)
        }
        const nonce=req.headers.cookie?.match(/(?:^|;\s*)vc_recovery=([a-f0-9]{64})(?:;|$)/)?.[1]
        await assertRoleSafePasswordRecovery(db,data)
        const result=await finishPasswordRecovery(db,loginOtp,data,nonce)
        res.setHeader('Set-Cookie',[`vc_recovery=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${config.secureCookies?'; Secure':''}`,cookie('',0,false)])
        return json(result)
      }
      if(req.method==='POST'&&['/api/auth/otp/request','/api/auth/otp/verify'].includes(path)){
        checkOrigin(req);await rateLimit(req);const data=await body(req)
        if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'คำขอ OTP ไม่ถูกต้อง')
        const loginOnly=config.otpLoginEnabled===true
        const existingNonce=req.headers.cookie?.match(/(?:^|;\s*)vc_otp_login=([a-f0-9]{64})(?:;|$)/)?.[1]
        if(path.endsWith('/request')){
          if(loginOnly){const bindingUser=data.purpose==='link_identity'?await auth(req):null;const nonce=existingNonce||createOtpLoginNonce(),challenge=await loginOtp.request(data,bindingUser,{existingAccountLogin:true,browserNonce:nonce,bindingUser});res.setHeader('Set-Cookie',`vc_otp_login=${nonce}; HttpOnly; Path=/; SameSite=Lax; Max-Age=300${config.secureCookies?'; Secure':''}`);return json(challenge,202)}
          const bindingUser=data.purpose==='link_identity'?await auth(req,'merchant'):null
          try{return json(await loginOtp.request(data,bindingUser))}catch(error){if(error.status===503)fail(503,error.message);throw error}
        }
        const loginMarker=typeof data.challengeId==='string'?await db.prepare('SELECT key FROM system_settings WHERE key=?').get('otp_login_identity:'+data.challengeId):null
        if(loginMarker&&!loginOnly)fail(503,'บริการ OTP ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
        if(loginOnly){
          if(await db.prepare('SELECT key FROM system_settings WHERE key=?').get('unified_credentials:'+data.challengeId))fail(401,'ยืนยันผ่านหน้าสมัครหรือกู้คืนบัญชีที่เริ่มคำขอนี้');
          const pending=typeof data.challengeId==='string'?await db.prepare('SELECT binding_user_id FROM login_otps WHERE id=?').get(data.challengeId):null
          const bindingUser=pending?.binding_user_id?await auth(req):null
          const verified=await loginOtp.verify(data,bindingUser,{existingAccountLogin:true,browserNonce:existingNonce,bindingUser,onVerified:async user=>{if(bindingUser)await assertWriteSession(db,bindingUser);if(user.phoneChangedDuringOtp)await db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(user.id);if(config.interactiveDemo)actorAllowed(user,config);return issueSession(req,user,{deferSecurityEvent:true})}})
          securityEvent('authentication.succeeded',{actorId:verified.user.id})
          res.setHeader('Set-Cookie',[verified.issued.cookie,`vc_otp_login=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${config.secureCookies?'; Secure':''}`])
          return json({user:await publicAccount(verified.user),csrf:verified.issued.csrf})
        }
        const challenge=typeof data.challengeId==='string'?await db.prepare('SELECT binding_user_id,purpose FROM login_otps WHERE id=?').get(data.challengeId):null
        const bindingUser=challenge?.binding_user_id?await auth(req,'merchant'):null
        let user;try{user=await loginOtp.verify(data,bindingUser)}catch(error){if(error.status===503)fail(503,error.message);throw error};await db.prepare('DELETE FROM system_settings WHERE key=?').run('password_registration:'+data.challengeId);const issued=await issueSession(req,user)
        res.setHeader('Set-Cookie',issued.cookie);return json({user:{id:user.id,email:user.email,name:user.name,role:user.role},csrf:issued.csrf})
      }
      if (
        req.method === "POST" &&
        [
          "/api/auth/login",
          "/api/auth/admin-login",
          "/api/auth/register",
          "/api/auth/register-user",
          "/api/auth/register-phone",
          "/api/auth/register-user-phone",
        ].includes(path)
      ) {
        checkOrigin(req)
        await rateLimit(req)
        if(path === "/api/auth/admin-login" && config.trustVercelProxy === true && req.headers.host !== new URL(config.appUrl).host)fail(403,"เข้าสู่ระบบ Admin ผ่าน origin ที่กำหนดใน APP_URL เท่านั้น");
        const data = await body(req)
        let user
        if(config.unifiedAuthEnabled&&path.includes("/register"))fail(400,"สมัครบัญชี User ก่อน แล้วสมัคร Merchant หลังเข้าสู่ระบบ");
        if (["/api/auth/register","/api/auth/register-user","/api/auth/register-phone","/api/auth/register-user-phone"].includes(path)) {
          const address = email(data.email)
          const pass = password(data.password)
          const name = text(data.name, "ชื่อผู้สมัคร")
          if (
            await db.prepare("SELECT id FROM users WHERE email=?").get(address)
          )
            fail(409, "อีเมลนี้ถูกใช้งานแล้ว")
          if (["/api/auth/register","/api/auth/register-phone"].includes(path)) text(data.businessNameEn, "ชื่อ Merchant ภาษาอังกฤษ");
          let registration;try{registration=await beginPasswordRegistration(db,loginOtp,{email:address,password:pass,name,...(config.interactiveDemo&&path.endsWith("-phone")?{allocatedUserId:[...scope.users,...scope.merchants].find(a=>a.pendingRegistration&&a.email===address&&a.role===(path.includes("register-user")?"user":"merchant"))?.id}:{}),...(path.endsWith("-phone")?{phone:text(data.phone,"หมายเลขโทรศัพท์",30)}:{}),businessNameEn:["/api/auth/register","/api/auth/register-phone"].includes(path)?text(data.businessNameEn,"ชื่อ Merchant ภาษาอังกฤษ"):"",role:path.includes("register-user")?"user":"merchant"})}catch(error){if(error.status===503)fail(503,error.message);throw error}
          res.setHeader("Set-Cookie",`vc_registration=${registration.nonce}; HttpOnly; Path=/; SameSite=Lax; Max-Age=300${config.secureCookies?"; Secure":""}`)
          return json({verificationRequired:true,challengeId:registration.challengeId,expiresAt:registration.expiresAt,resendAfter:registration.resendAfter},202)
        } else {
          const address = email(data.email)
          if (typeof data.password !== "string" || data.password.length > 128)
            fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
          user = await db
            .prepare("SELECT * FROM users WHERE email=?")
            .get(address)
          if(config.unifiedAuthEnabled&&path==='/api/auth/login'&&!user){const contacts=(await Promise.all(['user','merchant'].map(role=>findRoleOtpContact(db,role,'email',address)))).filter(Boolean);if(contacts.length===1&&await roleOtpContactVerified(db,contacts[0],'email',address))user=contacts[0];}
          // Equal-cost verification for unknown accounts.
          const fakeHash = config.fakeHash
          if (
            !await verifyPasswordAsync(data.password, user?.password_hash || fakeHash) ||
            !user
          ){
            fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
          }
        }
        if(path === "/api/auth/admin-login" && !await hasAdminAccess(db,user))fail(403,"เฉพาะบัญชี Admin เท่านั้น");
        const { csrf, cookie: sessionCookie } = await issueSession(req, user,{expectedPasswordHash:user.password_hash})
        res.setHeader("Set-Cookie", sessionCookie)
        return json({
          user: {
            id: user.id,
            email: await publicOtpEmail(db,user),
            name: user.name,
            role: path === "/api/auth/admin-login"?"admin":user.role,
            unifiedAuthEnabled:config.unifiedAuthEnabled===true,
            primaryRole:user.primaryRole||user.role,
            capabilities:accountCapabilities(user,await merchantProfile(db,user)),
          },
          csrf,
        })
      }
      if (req.method === "GET" && ["/api/auth/me","/api/auth/admin-me"].includes(path)) {
        const user = await session(req)
        return json({
          user: {
            id: user.id,
            email: await publicOtpEmail(db,user),
            name: user.name,
            role: user.role,
            businessPermissions:user.businessPermissions,
            businessOwner:user.businessOwner,
            unifiedAuthEnabled:config.unifiedAuthEnabled===true,
            primaryRole:user.primaryRole||user.role,
            capabilities:accountCapabilities(user,await merchantProfile(db,user)),
          },
          csrf: user.csrf,
        })
      }
      if(req.method==='POST'&&['/api/auth/password','/api/auth/logout-all'].includes(path)){
        const actor=await auth(req)
        await rateLimit(req)
        const result=await secureAccountOperation(db,actor,path.endsWith('/password')?'password':'logout-all',await body(req))
        res.setHeader('Set-Cookie',[cookie('',0,false),cookie('',0,true)])
        return json(result)
      }
      if (req.method === "POST" && ["/api/auth/logout","/api/auth/admin-logout"].includes(path)) {
        const user = await auth(req)
        const managed = await adminBusiness(
          db,
          user,
          req,
          path,
          url,
          body,
          config,
        )
        if (managed !== undefined) return json((phase1||config.interactiveDemo)&&path==="/api/admin/packages"?{...managed,packages:managed.packages.map(phase1PackageDisplay)}:managed)
        await db
          .prepare("UPDATE sessions SET expires=0 WHERE token_hash=?")
          .run(user.token_hash)
        res.setHeader("Set-Cookie", cookie("", 0,user.role === "admin"))
        return json({ ok: true })
      }
      if (req.method === "GET" && path === "/api/public/villas") {
        await rateLimit(req, "public")
        const requestedLimit=url.searchParams.get("limit");
        const limit=requestedLimit===null?null:Number(requestedLimit);
        if(requestedLimit!==null&&(!/^\d+$/.test(requestedLimit)||!Number.isInteger(limit)||limit<1||limit>100))fail(400,"จำนวนที่พักต้องเป็นจำนวนเต็ม 1–100");
        const province=(url.searchParams.get("province")||"").trim();
        if(province.length>100||/[\x00-\x1f]/.test(province))fail(400,"จังหวัดไม่ถูกต้อง");
        const published=(await publishedVillas(db,membershipTrustOptions)).filter(v=>!province||v.province===province);
        const rows=published;
        const context=await loadTrustContext(db,rows)
        return json({
          villas: (await Promise.all(
            rows.map(async (v) => ({
              id: v.id,
              isDemo: isDemoVilla(v),
              name: v.name,
              nameEn: v.name_en,
              province: v.province,
              qr: v.qr,
              photoUrl: v.photo_url,
      demoImage: config.appEnvironment==='staging'&&isDemoVilla(v),
      photoUploadedAt: v.photo_uploaded_at, photoTakenAt: v.photo_taken_at, photoReviewedAt: v.photo_reviewed_at,
              guestCapacity: v.guest_capacity,
              updated: v.reviewed_at || null,
              createdAt: v.created,
              ...(await trustDto(db, v, context, membershipTrustOptions)),
            })),
          )).filter(v=>(v.publicQrStatus||v.qrStatus)==="ACTIVE").slice(0,limit??undefined),
        })
      }
      const adminQrVerification=path.startsWith("/api/admin/qr-verification/")
      if (req.method === "GET" && (path.startsWith("/api/public/qr/") || adminQrVerification)) {
        if (!adminQrVerification) await rateLimit(req, "public")
        let viewer
        if(adminQrVerification){viewer=await auth(req);if(viewer.role!=="admin")fail(403,"เฉพาะ Admin")}
        const reference=decodeURIComponent(path.slice(adminQrVerification?"/api/admin/qr-verification/".length:15))
        const v=adminQrVerification?await db.prepare("SELECT * FROM villas WHERE qr=?").get(reference):await resolvePublicQr(db,reference,{...membershipTrustOptions,includeInactive:!config.phase2Enabled})
        const qrContext=v?await loadTrustContext(db,[v]):null
        const qrTrust=v?await trustDto(db,v,qrContext):null
        const qrFreePeriod=v?await merchantFreePeriod(db,v.owner_id,Date.now(),qrContext):null
        const publicTrust=!adminQrVerification?qrTrust:null
        if(!adminQrVerification&&(publicTrust?.publicQrStatus||publicTrust?.qrStatus)==="ACTIVE"&&v?.status==="approved"&&v.qr!==reference){res.writeHead(307,{Location:"/api/public/qr/"+encodeURIComponent(v.qr),"Cache-Control":"no-store"});res.end();return}
        if (!v) fail(404, "ไม่พบ QR ในระบบ")
        try {
          if(!viewer)viewer = await session(req)
        } catch (error) {
          if (error.status !== 401) throw error
        }
        if (!adminQrVerification && (v.status !== "approved"||(publicTrust.publicQrStatus||publicTrust.qrStatus)!=="ACTIVE")) {const trust=publicTrust;return json({qr:v.qr,status:v.status,ownerVerification:null,valid:false,locked:true,premiumBanner:false,qrStatus:trust.qrStatus,verificationLevel:"REGISTERED",verificationStatus:trust.verificationStatus})}
        const unlocked = adminQrVerification && viewer?.role === "admin";
        const disclosedBank=unlocked?await registryAccount(db,v):null,disclosedPhone=unlocked?await registryContactPhone(db,v):null;
        res.setHeader("Cache-Control","private, no-store");res.setHeader("Vary","Cookie")
        return json({
          name: v.name,
          nameEn: v.name_en,
          ...(adminQrVerification?{villaId:v.id}:{}),
          propertyDetails: v._approvedSnapshot?.propertyDetails?.details??await villaPage(db,v),
          guestCapacity:v.guest_capacity,
          ...(unlocked?{bankName:disclosedBank.bankName,accountName:disclosedBank.accountName}:{}),
          ownerVerification: await publicOwnerVerification(db,v),
          ownerVerificationRequired: ["starter","pro","premium"].includes(v.package_id),
          basicVerificationNotice: v.package_id === "basic" ? basicVerificationNotice : null,
          trialUnlimited: phase1||qrFreePeriod ? false : v.payments === 0,
          photoUrl: v.photo_url,
      demoImage: config.appEnvironment==='staging'&&isDemoVilla(v),
      photoUploadedAt: v.photo_uploaded_at, photoTakenAt: v.photo_taken_at, photoReviewedAt: v.photo_reviewed_at,
          province: v.province,
          status: v.status,
          qr: v.qr,
          expires: v.expires,
          valid: (adminQrVerification?qrTrust.qrStatus:qrTrust.publicQrStatus||qrTrust.qrStatus) === "ACTIVE",
          locked: !unlocked,
          viewerRole: viewer?.role || "guest",
          maskedPhone: v.phone ? (releaseMode==='PHASE1_PUBLIC'?"08X-XXX-XXXX":"••••••"+v.phone.slice(-4)) : null,
          maskedBankAccount: v.account_number ? (releaseMode==='PHASE1_PUBLIC'?"xxx-x-xxxxx-x":"••••••"+v.account_number.slice(-4)) : null,
          documentReviewStatus: {
            pending: "PENDING_REVIEW",
            approved: "APPROVED",
            changes: "CHANGE_REQUESTED",
            rejected: "REJECTED",
          }[v.status],
          reviewedAt: v.reviewed_at,
          ...(adminQrVerification ? { reviewedByAdminId: v.reviewed_by } : {}),
          ...qrTrust,
          qrStatus:adminQrVerification?qrTrust.qrStatus:qrTrust.publicQrStatus||qrTrust.qrStatus,
          ...(unlocked
            ? {
                phone: disclosedPhone,
                accountNumber: disclosedBank.accountNumber,
              }
            : {}),
        })
      }
      if(path==="/api/ops/cron"&&req.method==="GET"){
        const expected=config.cronSecret?Buffer.from("Bearer "+config.cronSecret):null,actual=Buffer.from(req.headers.authorization||"")
        if(!expected)fail(503,"Scheduled worker ยังไม่ได้ตั้งค่า")
        if(actual.length!==expected.length||!timingSafeEqual(actual,expected))fail(401,"Unauthorized")
        await worker.run()
        await cleanupSocialUploads(db)
        await db.prepare("INSERT INTO system_settings(key,value) VALUES ('ops:last_cron',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(new Date().toISOString())
        return json({ok:true})
      }
      if(path === "/api/webhooks/omise" && req.method === "POST") {
        await rateLimit(req,"webhooks")
        await omise.webhook(await body(req))
        return json({ok:true})
      }
      if (path.startsWith("/api/")) {
        if(registryPrecheckRoute(req.method,path))await rateLimit(req,"public")
        const user = await auth(req)
        const roleResult=await businessRoleManagement(db,user,req,path,body,config);if(roleResult!==undefined)return json(roleResult);
        if(path==='/api/admin/audit-log'&&req.method==='GET')return json({audits:await db.prepare('SELECT id,actor_id,action,target_id,created FROM audits ORDER BY created DESC LIMIT 100').all(),decisions:(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'decision_audit:%' ORDER BY value::jsonb->>'at' DESC LIMIT 100").all()).map(r=>JSON.parse(r.value))});
        if(['/api/admin/villa-archive','/api/merchant/villa-archive'].includes(path)){if(path.includes('/admin/')&&user.role!=='admin')fail(403,'Admin required');return json(await villaArchive(db,user,req.method,req.method==='GET'?{id:url.searchParams.get('id')}:await body(req),config));}
        if(registryPrecheckRoute(req.method,path))return json(await registryPrecheckApi(db,user,req,path,url,body,document,membershipTrustOptions))
        if(path==='/api/account/privacy-requests'){
          if(req.method==='POST')await rateLimit(req)
          return json(await privacyRequests(db,user,req.method,req.method==='GET'?{}:await body(req)))
        }
        if(path==='/api/admin/privacy-requests')return json(await adminPrivacyRequests(db,user,req.method,req.method==='POST'?await body(req):{}))
        if (path === "/api/user/checks" && req.method === "POST")
          await rateLimit(req, "checks:" + user.id)
        if(path==="/api/admin/email-test"&&req.method==="POST"){
          if(user.role!=="admin")fail(403,"เฉพาะ Admin")
          const data=await body(req)
          const testTransport=data.verifyOnly===true?(config.adminPasswordSetupTransport||transport):transport;
          if(config.internalAdminSetup&&config.adminPasswordSetupTransport&&(data.verifyOnly!==true||!config.adminPasswordSetupScope?.some(a=>a.email===data.recipient)))fail(403,"Approved Admin SMTP verification only");
          if(!testTransport)fail(409,"SMTP ยังไม่พร้อม ต้องตั้งค่าบริการก่อน")
          if(data.confirmed!==true||typeof data.recipient!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.recipient)||data.recipient.length>254)fail(400,"กรุณายืนยันอีเมลทดสอบ")
          if(data.verifyOnly!==undefined&&typeof data.verifyOnly!=="boolean")fail(400,"รูปแบบการตรวจ SMTP ไม่ถูกต้อง")
          if(data.verifyOnly===true&&typeof testTransport.verify!=="function")fail(409,"บริการนี้ไม่รองรับการตรวจเชื่อมต่อแยก")
          const stamp=await db.prepare("SELECT value FROM system_settings WHERE key='smtp:last_test'").get()
          if(stamp&&Date.now()-Date.parse(JSON.parse(stamp.value).at)<60000)fail(429,"รออย่างน้อย 1 นาทีก่อนทดสอบซ้ำ")
          // Reserve before delivery so a failed request is also rate-limited.
          await db.transaction(async()=>{
            const current=await db.prepare("SELECT value FROM system_settings WHERE key='smtp:last_test'").get()
            if(current&&Date.now()-Date.parse(JSON.parse(current.value).at)<60000)fail(429,"รออย่างน้อย 1 นาที")
            await db.prepare("INSERT INTO system_settings(key,value) VALUES ('smtp:last_test',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify({at:new Date().toISOString(),status:"testing"}))
          })
          try{if(data.verifyOnly===true)await testTransport.verify();else await testTransport.sendMail({from:config.smtpFrom,to:data.recipient,subject:"VillaCheck UAT: ทดสอบ SMTP เท่านั้น",text:"ข้อความทดสอบบริการอีเมล VillaCheck ไม่มีการเรียกเก็บเงินและไม่ใช่การยืนยันชำระเงิน กรุณาตอบผู้ตรวจรับว่าได้รับใน Inbox หรือ Spam"})}catch(error){
            const diagnostic=smtpDiagnostic(error)
            await db.prepare("UPDATE system_settings SET value=? WHERE key='smtp:last_test'").run(JSON.stringify({at:new Date().toISOString(),status:"failed",...diagnostic}))
            await audit(db,user,"smtp.test.failed",diagnostic.category)
            fail(502,diagnostic.message)
          }
          await db.prepare("UPDATE system_settings SET value=? WHERE key='smtp:last_test'").run(JSON.stringify({at:new Date().toISOString(),status:data.verifyOnly?"verified":"accepted",category:data.verifyOnly?"CONNECTION_VERIFIED":"SMTP_ACCEPTED",message:data.verifyOnly?"เชื่อมต่อและยืนยัน SMTP ผ่าน ยังไม่ได้ส่งอีเมล":"SMTP รับข้อความแล้ว รอยืนยัน Inbox/Spam จากผู้รับ"}))
          await audit(db,user,"smtp.test",data.recipient)
          return json({ok:true,acceptedBySmtp:!data.verifyOnly,verifiedConnection:true,inboxConfirmationRequired:!data.verifyOnly})
        }
        if(path === "/api/admin/owner-notifications" && req.method === "GET") {
          if(user.role !== "admin") fail(403,"เฉพาะ Admin")
          const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'owner_notification:%'").all()
          return json({notifications:rows.map(row=>JSON.parse(row.value)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})
        }
        if(path==='/api/admin/readiness'&&req.method==='GET'){
          if(user.role!=='admin')fail(403,'เฉพาะ Admin')
          return json(await readiness(db,config,transport))
        }
        const bankImage=path.match(/^\/api\/receiving-bank\/qr\/([a-f0-9-]{36})$/)
        if(bankImage&&req.method==="GET"){
          if(!["admin","merchant"].includes(user.role))fail(403,"เฉพาะ Admin และ Merchant")
          if(user.role!=="admin")requireManualPayment(config)
          const image=await db.prepare("SELECT mime,bytes FROM documents WHERE id=? AND name LIKE 'receiving-bank-qr:%'").get(bankImage[1])
          if(!image)fail(404,"ไม่พบ QR รับเงิน")
          res.writeHead(200,{"Content-Type":image.mime,"Cache-Control":"private, no-store","Content-Disposition":url.searchParams.get("download")==="1"?'attachment; filename="villacheck-bank-qr.png"':"inline"});return res.end(Buffer.from(image.bytes))
        }
        const acceptance=await acceptanceApi(db,user,req,path,body)
        if(acceptance!==undefined)return json(acceptance)
        const entitlementResult=await packageEntitlementsApi(db,user,req,path,body)
        if(entitlementResult!==undefined)return json(entitlementResult)
        const packagePromotion=path.match(/^\/api\/admin\/package-promotions\/([a-z0-9_-]+)$/)
        if(packagePromotion&&req.method==="POST")return json(await savePackagePromotion(db,user,packagePromotion[1],await body(req)))
        const basicPromotion=await basicPromotionApi(db,user,req,path,body)
        if(basicPromotion!==undefined)return json(basicPromotion)
        const promotions=await promotionsApi(db,user,req,path,body)
        if(promotions!==undefined)return json(promotions)
        const approvalResult=await changeApprovals(db,user,req,path,body,async(kind,payload,validateOnly)=>{
          const request={method:"POST"}
          if(kind==="bank")return adminReceivingBank(db,user,request,"/api/admin/receiving-bank",async()=>payload,config,transport,validateOnly)
          fail(410,"ยกเลิกคำขออนุมัติ CMS แล้ว ให้ใช้การเผยแพร่โดยตรง")
        })
        if(approvalResult!==undefined)return json(approvalResult)

        if(path==="/api/admin/receiving-bank/email"&&req.method==="POST")requireManualPayment(config)
        const bankResult=await adminReceivingBank(db,user,req,path,body,config,transport)
        if(bankResult!==undefined){json(bankResult);if(req.method==="POST")void worker.run();return}
        const cms = await adminCms(db, user, req, path, body, config)
        if (cms !== undefined) return json(cms)
        if(req.method==='GET'&&path==='/api/admin/otp/status'){
          if(user.role!=='admin')fail(403,'เฉพาะ Admin')
          const email=await db.prepare("SELECT value FROM system_settings WHERE key='otp_delivery_email'").get()
          const sms=await db.prepare("SELECT value FROM system_settings WHERE key='otp_delivery_sms'").get()
          const verification=await db.prepare("SELECT value FROM system_settings WHERE key='otp_verification_email'").get();
          return json({emailVerification:verification?JSON.parse(verification.value):null,channels:otpChannels(await cmsLoginConfig(db,config),transport),email:email?JSON.parse(email.value):null,sms:sms?JSON.parse(sms.value):null,...(url.searchParams.get('probe')==='sms'?{smsProvider:await probeSmsCredit(config)}:{})})
        }
        if(path==='/api/admin/review-sample-document'&&req.method==='GET'){
          if(user.role!=='admin')fail(403,'เฉพาะ Admin');
          res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="DUMMY-ownership-sample.pdf"','Cache-Control':'private, no-store'});
          return res.end(dummyPdf());
        }
        const socialFile=path.match(/^\/api\/social-material-files\/([a-f0-9-]{36})$/)
        if(socialFile&&req.method==="GET"){
          const file=await socialMaterialFile(db,user,socialFile[1],req.headers.range)
          res.writeHead(file.partial?206:200,{"Content-Type":file.mime,"Content-Length":file.bytes.length,"Accept-Ranges":"bytes",...(file.partial?{"Content-Range":`bytes ${file.start}-${file.end}/${file.size}`} : {}),"Content-Disposition":`inline; filename="social-material"; filename*=UTF-8''${encodeURIComponent(file.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"})
          return res.end(file.bytes)
        }
        const change=await merchantChangeApi(db,user,req,path,url,body);if(change!==undefined)return json(change);
        const accounts=await accountManagement(db,user,req,path,url,body)
        if(accounts!==undefined)return json(accounts)
        const ownership=await ownershipDocuments(db,user,req,path,url,body,document,config)
        if(ownership!==undefined)return json(ownership)
        const ownerVerification=await ownerVerificationApi(db,user,req,path,url,body)
        if(ownerVerification!==undefined)return json(ownerVerification)
        const materials=await socialMaterialsApi(db,user,req,path,url,body)
        if(materials!==undefined)return json(materials)
        const propertyMedia=await propertyMediaApi(db,user,req,path,url,body,membershipTrustOptions)
        if(propertyMedia!==undefined)return json(propertyMedia)
        const villaPages=await villaPagesApi(db,user,req,path,url,body)
        if(villaPages!==undefined)return json(villaPages)
        const advertising=await advertisingApi(db,user,req,path,url,body)
        if(advertising!==undefined)return json(advertising)
        const reviews=await reviewsApi(db,user,req,path,url,body,config)
        if(reviews!==undefined)return json(reviews)
        if(path==="/api/merchant/villa-draft")return json(await villaDraft(db,user,req,body))
        const receivingBankResult=await merchantReceivingBankApi(db,user,req,path,url,body);
        if(receivingBankResult!==undefined)return json(receivingBankResult);
        const operation=await operations(db,user,req,path,url,body,config,{validateDocument:document,insertDocument})
        if(path==="/api/user/profile"&&operation?.profile)operation.profile.email=await publicOtpEmail(db,user)
        if(operation!==undefined)return json((/^\/api\/(?:user|admin)\/checks(?:\/|$)/.test(path)||path==="/api/user/summary")?localizeCheckResponse(operation,req.headers["accept-language"]):operation)
        if (path === "/api/merchant/profile") {
          if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
          if (req.method === "POST" || req.method === "PATCH") {
            const data = await body(req)
            await db.transaction(async () => {
              await assertWriteSession(db,user);
              if(await saveMerchantProfile(db,user,data))return;
              await assertProfileOtpPhoneAvailable(db,user,data.phone);
              await db
                .prepare(
                  "UPDATE users SET name=?,business_name=?,business_name_en=?,phone=?,address=? WHERE id=?",
                )
                .run(
                  text(data.contactName, "ชื่อผู้ติดต่อ"),
                  text(data.businessName, "ชื่อธุรกิจภาษาไทย"),
                  text(data.businessNameEn, "ชื่อธุรกิจภาษาอังกฤษ"),
                  text(data.phone, "เบอร์โทร", 30),
                  text(data.address, "ที่อยู่", 2000),
                  user.id,
                )
              await db
                .prepare(
                  "UPDATE leads SET phone=?,name=?,updated=? WHERE user_id=?",
                )
                .run(
                  data.phone,
                  data.contactName,
                  new Date().toISOString(),
                  user.id,
                )
            })
          }
          const profile = await db
            .prepare(
              "SELECT name,business_name,business_name_en,phone,address,email FROM users WHERE id=?",
            )
            .get(user.id)
          const capabilityProfile=await merchantProfile(db,user);
          if(capabilityProfile)Object.assign(profile,{name:capabilityProfile.fields.contactName,business_name:capabilityProfile.fields.businessName,business_name_en:capabilityProfile.fields.businessNameEn,phone:capabilityProfile.fields.phone,address:capabilityProfile.fields.address});
          return json({
            pendingApproval:["POST","PATCH"].includes(req.method),
            selfServiceMerchant:true,
            primaryRole:user.primaryRole||user.role,
            membershipNotifications:await membershipNotices(db,user.id),
            readOnly:config.businessInitializationDisabled||(config.interactiveDemo&&!(scope.businessWriteMerchantIds||[scope.businessWriteMerchantId]).includes(user.id)&&!selfRegisteredStagingMerchant(user,config)),
            contactName: profile.name,
            businessName: profile.business_name,
            businessNameEn: profile.business_name_en,
            phone: profile.phone,
            address: profile.address,
            email: await publicOtpEmail(db,user),
            loginPhone:await publicOtpPhone(db,user),
          })
        }
        const managed = await adminBusiness(
          db,
          user,
          req,
          path,
          url,
          body,
          config,
        )
        if (managed !== undefined) return json((phase1||config.interactiveDemo)&&path==="/api/admin/packages"?{...managed,packages:managed.packages.map(phase1PackageDisplay)}:managed)
        if (req.method === "GET" && path === "/api/admin/users") {
          if (user.role !== "admin") fail(403, "เฉพาะ Admin")
          const users = await db
            .prepare(
              "SELECT id,name,email,role,created,last_login FROM users WHERE role='user' ORDER BY created DESC",
            )
            .all()
          return json({
            users: await Promise.all(
              users.map(async (u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                created: u.created,
                lastLogin: u.last_login,
                providers: (
                  await db
                    .prepare(
                      "SELECT provider FROM oauth_identities WHERE user_id=?",
                    )
                    .all(u.id)
                ).map((p) => p.provider),
              })),
            ),
          })
        }
        const docMatch = path.match(/^\/api\/(admin\/)?documents\/([a-f0-9-]+)$/)
        if (req.method === "GET" && docMatch) {
          if(docMatch[1]&&user.role!=="admin")fail(403,"เฉพาะ Admin")
          const file = await db
            .prepare("SELECT * FROM documents WHERE id=?")
            .get(docMatch[2])
          if (!file || (user.role !== "admin" && file.owner_id !== user.id))
            fail(404, "ไม่พบเอกสาร")
          await audit(db,user,'document.access',file.id)
          securityEvent('document.accessed',{actorId:user.id,targetId:file.id})
          res.writeHead(200, {
            "Content-Type": file.mime,
            "Content-Disposition": `${url.searchParams.get("preview") === "1" && (user.role === "admin" || file.mime === "application/pdf") ? "inline" : "attachment"}; filename="document"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "private, no-store",
          })
          return res.end(Buffer.from(file.bytes))
        }
        if (!["merchant", "admin"].includes(user.role))
          fail(403, "เฉพาะ Merchant หรือ Admin")
        const assignLevel=path.match(/^\/api\/villas\/([a-f0-9-]+)\/verification-level$/)
        if(req.method === "POST" && assignLevel) {
          if(user.role!=="admin")fail(403,"เฉพาะ Admin")
          const data=await body(req)
          await db.transaction(async()=>{
            const villa=await villaFor(user,assignLevel[1])
            const sub=await getSubscription(db,villa.owner_id)
            const period=await villaFreeTrial(db,villa)||await merchantFreePeriod(db,villa.owner_id)
            if(period&&(period.state!=="ACTIVE"||["SUSPENDED","CANCELLED"].includes(sub?.lifecycle)))fail(409,"สิทธิ์บัญชีไม่พร้อมใช้งาน")
            const plan=await getPlan(db,period?"starter":villa.payments === 0 ? "basic" : villa.package_id)
            if(villa.status!=="approved")fail(409,"เอกสารต้องผ่านการอนุมัติก่อน")
            if(!levels.includes(data.verificationLevel) || levels.indexOf(data.verificationLevel)>levels.indexOf(plan.max_level))fail(400,"ระดับเกินสิทธิ์แพ็กเกจ")
            if(villa.verification_level===data.verificationLevel)fail(409,"ระดับนี้ได้รับการอนุมัติแล้ว")
            await preserveApprovedVilla(db,villa)
            await db.prepare("UPDATE villas SET verification_level=?,reviewed_at=?,reviewed_by=? WHERE id=?").run(data.verificationLevel,new Date().toISOString(),user.id,villa.id)
            await rotateApprovedRevision(db,{...villa,verification_level:data.verificationLevel,reviewed_by:user.id},user,"VERIFICATION_LEVEL_APPROVED")
            await audit(db,user,"villa.verification-level",villa.id)
          })
          return json(await state(user))
        }
        const demoPayment=path.match(/^\/api\/payments\/([a-f0-9-]+)\/demo-slip$/)
        if(req.method === "POST" && demoPayment){
          if(user.role!=="merchant")fail(403,"เฉพาะ Merchant")
          requireManualPayment(config)
          if(!await demoMode(db,config))fail(403,"Demo mode ปิดอยู่")
          const {invoice}=await invoiceFor(user,demoPayment[1])
          const qr=await paymentQrDto(db,invoice.id)
          if(invoice.status!=="pending" || qr?.status!=="ACTIVE")fail(409,"ต้องมี Payment QR ที่ยังใช้งานได้")
          return json(demoSlip(invoice))
        }
        const regenerate = path.match(/^\/api\/payments\/([a-f0-9-]+)\/qr$/)
        if (req.method === "POST" && regenerate) {
          if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
          requireManualPayment(config)
          const { invoice } = await invoiceFor(user, regenerate[1])
          const qr = await db.transaction(() =>
            generatePaymentQr(db, invoice.id, config.appUrl),
          )
          return json(qr)
        }
        if (req.method === "GET" && path === "/api/payments/attempt") {
          requireManualPayment(config)
          const attempt = await db
            .prepare("SELECT * FROM payment_qrs WHERE id=?")
            .get(url.searchParams.get("id"))
          if (!attempt) fail(404, "ไม่พบ Payment QR")
          await invoiceFor(user, attempt.payment_id)
          const latest = await paymentQrDto(db, attempt.payment_id)
          if (latest?.id !== attempt.id || latest.status !== "ACTIVE")
            fail(410, "Payment QR หมดอายุหรือถูกยกเลิก")
          return json({ paymentId: attempt.payment_id, qr: latest })
        }
        if (req.method === "GET" && path === "/api/admin/payments") {
          if (user.role !== "admin") fail(403, "เฉพาะ Admin")
          const status = url.searchParams.get("status")
          const rows = status
            ? await db
                .prepare(
                  "SELECT * FROM invoices WHERE payment_status=? ORDER BY created DESC",
                )
                .all(status)
            : await db
                .prepare("SELECT * FROM invoices ORDER BY created DESC")
                .all()
          return json({
            payments: await Promise.all(
              rows.map(async (row) => ({
                ...(await invoiceDto(row)),
                ownerId: (await villaFor(user, row.villa_id)).owner_id,
                packageId: row.package_id,
              })),
            ),
          })
        }
        const paymentRead = path.match(
          /^\/api\/(admin\/payments|payments)\/([a-f0-9-]+)(\/status)?$/,
        )
        if (req.method === "GET" && paymentRead) {
          if (paymentRead[1] === "admin/payments" && user.role !== "admin")
            fail(403, "เฉพาะ Admin")
          const { invoice, villa } = await invoiceFor(user, paymentRead[2])
          return json({
            ...(await invoiceDto(invoice)),
            ownerId: villa.owner_id,
            ownerName: villa.merchant,
            villaName: villa.name,
            packageId: invoice.package_id,
          })
        }
        if (req.method === "GET" && path === "/api/state")
          return json(await state(user))
        if (req.method === "POST" && path === "/api/merchant/villa-package") {
          await blockFreePackageSelection(db,user)
          if(user.role !== "merchant") fail(403,"เฉพาะ Merchant")
          const data=await body(req)
          await transaction(db,async()=>{
            const villa=await db.prepare("SELECT * FROM villas WHERE id=? AND owner_id=?").get(data.villaId,user.id)
            if(!villa) fail(404,"ไม่พบที่พัก")
            if(villa.status!=="approved") fail(409,"ต้องผ่านการตรวจสอบที่พักก่อนซื้อแพ็กเกจ")
            const sub=await getSubscription(db,user.id)
            if(["SUSPENDED","CANCELLED"].includes(sub?.lifecycle))fail(409,"บัญชีถูกระงับ กรุณาติดต่อทีมงาน")
            const plan=await getPlan(db,data.packageId)
            assertNoUnsettledPackageChange(villa,plan.id)
            if(!plan.active || plan.amount<=0) fail(400,"เลือกแพ็กเกจที่เปิดขาย")
            if(plan.id === "basic") {
              if(villa.payments > 0) fail(409,"การเปลี่ยนจากแพ็กเกจชำระเงินเป็น Basic รอยืนยันนโยบายรักษาสิทธิ์เดิม")
              await grantBasicPromotion(db,villa.id,user.id)
              await audit(db,user,"basic.promotion.claim",villa.id)
              return
            }
            if(await db.prepare("SELECT id FROM invoices WHERE villa_id=? AND status!='paid'").get(villa.id)) fail(409,"มีใบแจ้งชำระค้างสำหรับที่พักนี้")
            if(plan.netAmount===0)fail(409,"โปรโมชั่นสุทธิ 0 บาท ไม่ต้องชำระ ระยะสิทธิ์ระดับนี้รอยืนยันก่อนเปิดใช้งาน")
            requireNewPayment(config)
            if(paymentAccess(config)==="OMISE_TEST"&&!config.omiseTestEnabled)fail(503,"Omise Test ยังไม่พร้อม")
            if(!config.omiseTestEnabled && !await demoMode(db,config) && !await receivingBank(db))fail(503,"ยังไม่ได้ตั้งค่าช่องทางรับชำระ ไม่สามารถสร้างใบแจ้งชำระได้")
            await selectCoupon(db,user.id,plan,data.couponCode)
            const id=await createInvoice(db,{...villa,package_id:plan.id},config.appUrl,config.paymentInstructions)
            await db.prepare("UPDATE invoices SET package_id=? WHERE id=?").run(plan.id,id)
            if(config.omiseTestEnabled){await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run("invoice_gateway:"+id,"OMISE");await db.prepare("UPDATE invoices SET external_provider='OMISE',verification_mode='AUTO' WHERE id=?").run(id);await db.prepare("UPDATE mails SET status='cancelled',last_error='Omise checkout replaces manual payment instructions' WHERE invoice_id=?").run(id)}
            await generatePaymentQr(db,id,config.appUrl)
            await audit(db,user,"villa.package.request",villa.id)
          })
          json(await state(user));void worker.run();return
        }
        if(req.method==='POST'&&path==='/api/subscription/upgrade')fail(409,"กรุณาเลือกซื้อแพ็กเกจแยกตามที่พักใน Member Room")
        if(path==="/api/subscription/coupon"&&req.method==="POST"){
          await blockFreePackageSelection(db,user)
          if(user.role!=="merchant")fail(403,"เฉพาะ Merchant")
          const data=await body(req),sub=await getSubscription(db,user.id);if(!sub)fail(409,"ยังไม่มีแพ็กเกจ")
          await transaction(db,async()=>{if(await db.prepare("SELECT id FROM invoices WHERE subscription_owner=? AND status!='paid'").get(user.id))fail(409,"ใบแจ้งชำระสร้างแล้ว ไม่แก้ส่วนลดย้อนหลัง");await selectCoupon(db,user.id,await getPlan(db,sub.package_id),data.couponCode)})
          return json(await state(user))
        }
        if (req.method === "POST" && path === "/api/subscription") fail(409,"เพิ่มที่พักเพื่อเริ่มใช้ฟรี แล้วเลือกซื้อแพ็กเกจแยกตามที่พักใน Member Room")
        if (req.method === "POST" && path === "/api/villas") {
          if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
          const data = await body(req)
          const nameEn = text(data.nameEn, "ชื่อที่พักภาษาอังกฤษ")
          const name = text(data.name, "ชื่อที่พักภาษาไทย"),
            province = text(data.province, "จังหวัด"),
            merchant = text(data.merchant, "ชื่อ Merchant"),
            address = email(data.email)
          const contacts = [
            data.phone || "",
            data.bankName || "",
            data.accountName || "",
            data.accountNumber || "",
          ]
          for (const value of contacts)
            if (
              typeof value !== "string" ||
              value.length > 200 ||
              /[\x00-\x1f]/.test(value)
            )
              fail(400, "ข้อมูลติดต่อหรือบัญชีไม่ถูกต้อง")
          if (contacts[0] && !/^[+0-9 ()-]{8,25}$/.test(contacts[0]))
            fail(400, "เบอร์โทรไม่ถูกต้อง")
          if (contacts[3] && !/^[0-9 -]{6,30}$/.test(contacts[3]))
            fail(400, "เลขบัญชีไม่ถูกต้อง")
          const capacity = guestCapacity(data.guestCapacity) ?? 1
          const file = document(data.document)
          const id = await transaction(db, async () => {
            await assertWriteSession(db,user);
            const request=await reserveVillaCreate(db,user,data);if(request.replayId)return request.replayId;
            let perVillaTrial=perVillaTrialEnabled(config);
            const freePeriod=await assertVillaCreation(db,user.id,{perVilla:perVillaTrial});
            perVillaTrial=perVillaTrial||freePeriod?.version===3
            await db.prepare("INSERT INTO subscriptions(owner_id,package_id,created) VALUES (?,?,?) ON CONFLICT(owner_id) DO NOTHING").run(user.id,"basic",new Date().toISOString())

            const docId = await insertDocument(db, user.id, file)
            const id = config.interactiveDemo?req.stagingVillaId:randomUUID(); if(!id)fail(403,"Staging Villa allocation required")
            await db
              .prepare(
                "INSERT INTO villas(id,owner_id,name,name_en,province,merchant,email,package_id,document_id,created) VALUES (?,?,?,?,?,?,?,?,?,?)",
              )
              .run(
                id,
                user.id,
                name,
                nameEn,
                province,
                merchant,
                address,
                freePeriod?"starter":"basic",
                docId,
                new Date().toISOString(),
              )
            await db
              .prepare(
                "UPDATE villas SET phone=?,bank_name=?,account_name=?,account_number=? WHERE id=?",
              )
              .run(...contacts, id)
            const photoUrl = data.photo ? await saveVillaPhoto(db,user.id,data.photo) : data.photoUrl || ""
            await assertVillaCoverLimit(db,{id,photo_url:""},photoUrl)
            if (
              photoUrl &&
              (typeof photoUrl !== "string" ||
                photoUrl.length > 2000 ||
                (!photoUrl.startsWith("https://") && !data.photo))
            )
              fail(400, "Photo URL ต้องเป็น HTTPS")
            await db
              .prepare("UPDATE villas SET photo_url=?,guest_capacity=?,photo_uploaded_at=?,photo_taken_at=? WHERE id=?")
              .run(photoUrl, capacity, photoUrl ? new Date().toISOString() : null, data.photoTakenAt ? mediaDate(data.photoTakenAt) : null, id)
            // Apply agreed defaults only to the newly created Villa; preserve replay/description workflow.
            await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('villa_page:'+id,JSON.stringify({details:{isDemo:isDemoVilla({email:address}),description:'',location:'',guestCapacity:capacity,bedrooms:1,bathrooms:1,amenities:[],rules:[],checkIn:'',checkOut:'',notice:''}}));
            await saveVillaDescription(db,await db.prepare('SELECT * FROM villas WHERE id=?').get(id),data.description);
            if(data.mediaUploads!==undefined){
              if(!Array.isArray(data.mediaUploads)||data.mediaUploads.length>12)fail(400,'รูปเพิ่มเติมไม่เกิน 10 รูป และวิดีโอไม่เกิน 2 รายการ');
              const current=await db.prepare('SELECT * FROM villas WHERE id=?').get(id);
              for(const upload of data.mediaUploads){if(!upload||typeof upload!=='object'||(!upload.youtubeUrl&&!upload.uploadId)||Boolean(upload.youtubeUrl&&upload.uploadId))fail(400,'ข้อมูลสื่อไม่ถูกต้อง');await storePropertyMedia(db,user,current,upload.youtubeUrl?{youtubeUrl:upload.youtubeUrl,name:upload.name}:{file:{uploadId:upload.uploadId}},membershipTrustOptions);}
            }
            if(perVillaTrial)await prepareVillaTrial(db,await db.prepare('SELECT * FROM villas WHERE id=?').get(id));
            if(!phase1&&!freePeriod)await grantBasicPromotion(db,id,user.id)
            await audit(db, user, "villa.create", id)
            await markVillaDraftSubmitted(db,user,data,id)
            await completeVillaCreate(db,request.token,id)
            return id
          })
          return json({ ...(await state(user)), createdId: id }, 201)
        }
        const villaAction = path.match(
          /^\/api\/villas\/([a-f0-9-]+)\/(review|resubmit|renew)$/,
        )
        if (req.method === "POST" && villaAction) {
          const [, id, action] = villaAction
          const data = await body(req)
          await transaction(db, async () => {
            await assertWriteSession(db,user);
            const villa = await villaFor(user, id)
            if(action==='resubmit')await assertPhase2VillaEditing(db,user,villa,config)
            if (action === "review") {
              if (user.role !== "admin") fail(403, "เฉพาะ Admin")
              if (villa.status !== "pending") fail(409, "Villa นี้ถูกตรวจสอบแล้ว")
              const previousDecisionStatus=villa.status;
              if(Object.hasOwn(data,'expectedReviewId')&&(await villaReview(db,villa)).id!==data.expectedReviewId)
                fail(409,'ข้อมูล Villa เปลี่ยนหลังจากเปิดตรวจ กรุณาโหลดรายการล่าสุดก่อนอนุมัติ')
              if(data.status==='begin'){
                const current=await villaReview(db,villa);
                if(!current.startedAt){await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('villa_review:'+id,JSON.stringify({...current,id:current.id||randomUUID(),startedAt:new Date().toISOString(),startedBy:user.id}));await audit(db,user,'villa.review_started',id)}
                return;
              }
              if (!["approved", "changes", "rejected"].includes(data.status))
                fail(400, "สถานะไม่ถูกต้อง")
              if(data.status === "approved" && await db.prepare("SELECT id FROM invoices WHERE villa_id=? AND external_provider='OMISE' AND status='paid' AND payment_status='FAILED' LIMIT 1").get(id))fail(409,"มีรายการ Omise กลับรายการที่ต้องตรวจสอบและกระทบยอดก่อนอนุมัติ")
              const reason =
                data.status === "approved"
                  ? ""
                  : text(data.reason, "เหตุผล", 2000)
              const hasApprovedSnapshot=Boolean(await db.prepare('SELECT key FROM system_settings WHERE key=?').get('villa_approved:'+id))
              if(data.status==='approved'&&!villa.photo_url)fail(409,'กรุณาแนบรูปหน้าปกที่พักก่อนอนุมัติ')
              if(data.status==='approved'&&!reviewedCover(villa))fail(409,'กรุณาตรวจรูปหน้าปกปัจจุบันก่อนอนุมัติ');
              if(data.status==='approved')await assertOwnershipDocumentsReviewed(db,id)
              const reviewedAt=new Date().toISOString()
              let approvedInitialGrant
              let freeTrial=await villaFreeTrial(db,villa);
              if(data.status==='approved'&&!freeTrial&&perVillaTrialEnabled(config)&&!hasApprovedSnapshot&&villa.payments===0&&!villa.qr&&!villa.expires)freeTrial=await prepareVillaTrial(db,villa);
              if(data.status==='approved'&&freeTrial)freeTrial=await activateVillaTrial(db,villa,user,reviewedAt);
              const freePeriod=freeTrial||await merchantFreePeriod(db,villa.owner_id)
              const publicTrial=Boolean(freeTrial)||releaseMode==='PHASE1_PUBLIC'&&freePeriod?.state==='ACTIVE'
              if(phase1&&data.status==='approved'&&!hasApprovedSnapshot&&!publicTrial){
                if(config.phase1ActivationMode!=='APPROVED_EXPLICIT_GRANTS')fail(409,'Phase1 initial activation terms are not approved')
                approvedInitialGrant=await initialGrantForReview(db,villa,config.phase1InitialGrantPolicy,Date.parse(reviewedAt),user,config.qaGrantContext)
              }
              const level = data.verificationLevel || (villa.payments === 0 ? "BASIC_CHECKED" : "VERIFIED")
              if(data.status==='approved'&&!freeTrial&&freePeriod&&freePeriod.state!=='ACTIVE')fail(409,'ช่วงใช้ฟรีสิ้นสุดแล้ว รอประกาศสิทธิ์การใช้งานต่อ')
              const entitled = await getPlan(db, freePeriod?'starter':approvedInitialGrant?villa.package_id:villa.payments === 0 ? "basic" : villa.package_id)
              if (
                !levels.includes(level) ||
                levels.indexOf(level) > levels.indexOf(entitled.max_level)
              )
                fail(400, "ระดับเกินสิทธิ์แพ็กเกจ")
              await db
                .prepare(
                  "UPDATE villas SET status=?,reason=?,verification_level=?,reviewed_at=?,reviewed_by=? WHERE id=?",
                )
                .run(
                  data.status,
                  reason,
                  level,
                  reviewedAt,
                  user.id,
                  id,
                )
              if (data.status === 'approved') {
                if(phase1&&!hasApprovedSnapshot&&!approvedInitialGrant&&!publicTrial)fail(409,'Phase1 initial activation terms are not approved')
                if(phase1&&!approvedInitialGrant&&!publicTrial){
                  // Internal entitlement check only. Never publish this historical revision.
                  const prior=JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+id))?.value||'null');
                  if(!prior?.villa||prior.villa.status!=='approved'||(await trustDto(db,{...prior.villa,expires:villa.expires,payments:villa.payments})).qrStatus!=='ACTIVE')fail(409,'สิทธิ์ที่พักที่อนุมัติเดิมไม่พร้อมใช้งาน กรุณาตรวจสอบสิทธิ์ก่อนอนุมัติใหม่','ENTITLEMENT_INACTIVE');
                }
                const sub = await getSubscription(db, villa.owner_id)
                if (!sub) fail(409, "Merchant ต้องสมัครแพ็กเกจที่บัญชีก่อน")
                if(publicTrial&&!freeTrial&&(["SUSPENDED","CANCELLED"].includes(sub.lifecycle)||sub.expires!==freePeriod.endsAt))fail(409,"Trial subscription requires review");
                await rememberQr(db,villa)
                await db.prepare("UPDATE villas SET qr=? WHERE id=?").run(villa.qr||`VC-${randomUUID()}`,id)
                if(!freeTrial&&(!phase1||publicTrial))await activateVilla(db, {...villa,qr:(await db.prepare("SELECT qr FROM villas WHERE id=?").get(id)).qr})
                await preserveApprovedVilla(db,await db.prepare("SELECT * FROM villas WHERE id=?").get(id))
              }
              await approvalHistory(db,villa,user,data.status,reason)

              await audit(db, user, `villa.${data.status}`, id)
              await decisionAudit(db,user,{kind:"KYC",resourceType:"VILLA_REVIEW",targetId:id,outcome:data.status==="approved"?"APPROVED":data.status==="rejected"?"REJECTED":"CHANGES",reason:data.reason||"",previousStatus:previousDecisionStatus,newStatus:data.status,action:'villa.review'});
            } else if (action === "resubmit") {
              if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
              if (!["changes", "rejected"].includes(villa.status))
                fail(409, "ยังไม่สามารถส่งเอกสารใหม่ได้")
              const file = document(data.document)
              const docId = await insertDocument(db, user.id, file)
              await recordVillaReview(db,villa,{...villa,document_id:docId},"document_resubmission",user)
              await db
                .prepare(
                  "UPDATE villas SET document_id=?,status='pending',reason='' WHERE id=?",
                )
                .run(docId, id)
              await audit(db, user, "villa.resubmit", id)
            } else {
              if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")
              if (villa.status !== "approved" || !villa.qr)
                fail(409, "ต้องเปิดใช้ QR ก่อนต่ออายุแพ็กเกจ")
              const sub=await getSubscription(db,villa.owner_id)
              if(["SUSPENDED","CANCELLED"].includes(sub?.lifecycle))fail(409,"บัญชีถูกระงับ กรุณาติดต่อทีมงาน")
              const target=await getPlan(db,data.packageId||villa.package_id)
              assertNoUnsettledPackageChange(villa,target.id)
              if(!target.active||target.amount<=0)fail(400,"เลือกแพ็กเกจที่เปิดขาย")
              if(target.id==="basic")fail(409,"Basic ใช้สิทธิ์โปรโมชั่นเดิม เงื่อนไขการสมัครแบบชำระเงินและต่ออายุรอยืนยัน")
              if(await db.prepare("SELECT id FROM invoices WHERE villa_id=? AND status!='paid'").get(villa.id))fail(409,"มีใบแจ้งชำระค้างสำหรับที่พักนี้")
              if(target.netAmount===0)fail(409,"ยอดสุทธิ 0 บาท เงื่อนไขต่ออายุรอยืนยัน ไม่มีการเรียกเก็บ")
              requireNewPayment(config)
            if(paymentAccess(config)==="OMISE_TEST"&&!config.omiseTestEnabled)fail(503,"Omise Test ยังไม่พร้อม")
            if(!config.omiseTestEnabled && !await demoMode(db,config) && !await receivingBank(db))fail(503,"ยังไม่ได้ตั้งค่าช่องทางรับชำระ ไม่สามารถสร้างใบแจ้งชำระได้")
              await selectCoupon(db,user.id,target,data.couponCode)
              const invoiceId=await createInvoice(db,{...villa,package_id:target.id},config.appUrl,config.paymentInstructions)
              await db.prepare("UPDATE invoices SET package_id=? WHERE id=?").run(target.id,invoiceId)
              if(config.omiseTestEnabled){await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run("invoice_gateway:"+invoiceId,"OMISE");await db.prepare("UPDATE invoices SET external_provider='OMISE',verification_mode='AUTO' WHERE id=?").run(invoiceId);await db.prepare("UPDATE mails SET status='cancelled',last_error='Omise checkout replaces manual payment instructions' WHERE invoice_id=?").run(invoiceId)}
              await generatePaymentQr(db,invoiceId,config.appUrl)
              await audit(db,user,"villa.package.renew",villa.id)
            }
          })
          json(await state(user))
          void worker.run()
          return
        }
        const checkout=path.match(/^\/api\/payments\/([a-f0-9-]+)\/checkout$/)
        if(checkout&&req.method==="GET"){
          const {invoice}=await invoiceFor(user,checkout[1])
          const methods=(config.omiseTestMethods||[]).filter(method=>["promptpay"].includes(method))
          const publicKey=/^pkey_test_[a-zA-Z0-9]+$/.test(config.omiseTestPublicKey||"")?config.omiseTestPublicKey:null
          const ready=paymentAccess(config)!=="DISABLED"&&config.omiseTestEnabled===true&&Boolean(publicKey)&&methods.length>0&&(paymentAccess(config)!=="OMISE_TEST"||invoice.external_provider==="OMISE")
          return json({mode:"TEST",enabled:ready,statusAvailable:config.omiseTestEnabled===true,publicKey:ready?publicKey:null,methods:ready?methods:[],invoiceId:invoice.id,amount:invoice.amount,currency:"THB",paid:invoice.status==="paid"})
        }
        const omiseAction=path.match(/^\/api\/payments\/([a-f0-9-]+)\/omise$/)
        if(omiseAction && ["GET","POST"].includes(req.method)) {
          const {invoice}=await invoiceFor(user,omiseAction[1])
          if(req.method === "POST") {
            if(user.role!=="merchant")fail(403,"เฉพาะ Merchant")
            await rateLimit(req,"omise:"+user.id)
            requireNewPayment(config)
            if(paymentAccess(config)==="OMISE_TEST"&&invoice.external_provider!=="OMISE")fail(409,"Legacy manual invoice ต้องกระทบยอดแยก ไม่แปลงเป็น Omise charge")
            const data=await body(req)
            return json(await omise.create(invoice,user,data.source))
          }
          return json(await omise.status(invoice.id))
        }
        const invoiceAction = path.match(
          /^\/api\/invoices\/([a-f0-9-]+)\/(proof|confirm|reject)$/,
        )
        if (["POST", "PATCH"].includes(req.method) && invoiceAction) {
          const [, id, action] = invoiceAction
          if(action!=="reject")requireManualPayment(config)
          const gatewayRow=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("invoice_gateway:"+id)
          if(gatewayRow?.value === "OMISE")fail(409,"รายการนี้รับชำระและตรวจสถานะผ่าน Omise เท่านั้น")
          const data = await body(req)
          await transaction(db, async () => {
            const { invoice, villa } = await invoiceFor(user, id)
            if (villa.status !== "approved" && !villa.reviewed_at && !villa.qr) fail(409, "Villa ยังไม่เคยผ่านการอนุมัติ")
            if (action === "proof") {
              if (user.role !== "merchant") fail(403, "เฉพาะ Merchant")

              if (invoice.status !== "pending")
                fail(409, "ใบแจ้งชำระนี้อยู่ระหว่างตรวจสอบหรือชำระแล้ว")
              const reference = text(data.reference, "เลขอ้างอิงการโอน", 150)
              const duplicate = await db
                .prepare(
                  "SELECT id FROM invoices WHERE external_transaction_id=? AND id!=?",
                )
                .get(reference, id)
              if (duplicate) fail(409, "เลขธุรกรรมนี้ถูกใช้ยืนยันการชำระแล้ว")
              const proof=document(data.document)
              await reserveManualProof(db,id,reference,proof.bytes)
              const docId = await insertDocument(db,user.id,proof)
              await db
                .prepare(
                  "UPDATE invoices SET status='submitted',payment_status='PENDING_REVIEW',verification_mode=?,updated_at=?,proof_id=?,reference=?,reason='' WHERE id=?",
                )
                .run(
                  await getVerificationMode(
                    db,
                    config.paymentVerificationMode || "MANUAL",
                  ),
                  new Date().toISOString(),
                  docId,
                  reference,
                  id,
                )
              const verification = new PaymentVerificationService(
                await getVerificationMode(
                  db,
                  config.paymentVerificationMode || "MANUAL",
                ),
              )
              await verification.verify(id) // AUTO placeholder safely stays PENDING_REVIEW.
              await audit(db, user, "invoice.proof", id)
            } else {
              if (user.role !== "admin") fail(403, "เฉพาะ Admin")
              if (action === "confirm" && invoice.status === "paid") return
              if (invoice.status !== "submitted" || !invoice.proof_id)
                fail(409, "ต้องมีหลักฐานการชำระรอตรวจสอบ")
              if (action === "reject") {
                await db
                  .prepare(
                    "UPDATE invoices SET status='pending',payment_status='REJECTED',updated_at=?,reason=? WHERE id=?",
                  )
                  .run(
                    new Date().toISOString(),
                    text(data.reason, "เหตุผล", 2000),
                    id,
                  )
              } else {
                const transactionId = data.externalTransactionId
                  ? text(data.externalTransactionId, "เลขธุรกรรม", 150)
                  : invoice.reference
                const duplicate = await db
                  .prepare(
                    "SELECT id FROM invoices WHERE external_transaction_id=? AND id!=?",
                  )
                  .get(transactionId, id)
                if (duplicate) fail(409, "เลขธุรกรรมนี้ถูกใช้ยืนยันการชำระแล้ว")
                await db
                  .prepare(
                    "UPDATE invoices SET external_transaction_id=?,external_provider='MANUAL' WHERE id=?",
                  )
                  .run(transactionId, id)
                await confirmPayment(db, invoice, villa, user.id)
              }
              await audit(db, user, `invoice.${action}`, id)
              await decisionAudit(db,user,{kind:'PAYMENT',targetId:id,outcome:action==='confirm'?'APPROVED':'REJECTED',reason:action==='reject'?data.reason||'':'',previousStatus:invoice.status,newStatus:action==='confirm'?'paid':'pending',action:'invoice.'+action});
            }
          })
          return json(await state(user))
        }
        const retry = path.match(/^\/api\/mails\/([a-f0-9-]+)\/retry$/)
        if (req.method === "POST" && retry) {
          if (user.role !== "admin") fail(403, "เฉพาะ Admin")
          if (!transport) fail(409, "ยังไม่ได้ตั้งค่า SMTP")
          const mail = await db
            .prepare("SELECT status FROM mails WHERE id=?")
            .get(retry[1])
          if (!mail) fail(404, "ไม่พบอีเมล")
          if (mail.status === "sending" || mail.status === "sent")
            fail(409, "อีเมลส่งแล้วหรือกำลังส่ง")
          await db
            .prepare(
              "UPDATE mails SET status='queued',attempts=0,next_attempt=0 WHERE id=?",
            )
            .run(retry[1])
          await audit(db, user, "mail.retry", retry[1])
          json(await state(user))
          void worker.run()
          return
        }
        fail(404, "ไม่พบ API")
      }
      if (req.method === "GET" && config.staticDir) {
        const root = resolve(config.staticDir)
        const file = resolve(root, `.${decodeURIComponent(path)}`)
        if (!file.startsWith(root + sep) && file !== root) fail(404, "ไม่พบไฟล์")
        const target =
          file !== root && existsSync(file) && /\.[a-z0-9]+$/i.test(file)
            ? file
            : resolve(root, "index.html")
        const mime = {
          ".js": "text/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".woff2": "font/woff2",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".jpg": "image/jpeg",
          ".ico": "image/x-icon",
          ".txt": "text/plain",
        }
        const extension = target.slice(target.lastIndexOf("."))
        res.setHeader(
          "Content-Type",
          mime[extension] || "application/octet-stream",
        )
        return res.end(readFileSync(target))
      }
      fail(404, "ไม่พบหน้า")
    } catch (error) {
      // Structured security telemetry contains no attacker-controlled payload.
      // Alert routing/retention is configured separately, never by this handler.
      const endpoint=new URL(req.url||'/', 'http://localhost').pathname
      if(req.method==='POST'&&endpoint.startsWith('/api/auth/')&&[401,403,429].includes(error.status))
        securityEvent(endpoint.includes('/otp/')?'otp.rejected':'authentication.failed')
      if(!res.headersSent&&error.status===429&&req.method==='GET'&&/^\/api\/auth\/oauth\/(google|line|facebook)\/start$/.test(endpoint)){const retryAfter=Number.isInteger(error.retryAfter)?Math.max(1,Math.min(900,error.retryAfter)):900;res.writeHead(303,{'Location':config.appUrl+'/#page=login&oauth_error=rate_limited&retry_after='+retryAfter,'Retry-After':String(retryAfter),'Cache-Control':'no-store'});res.end();return;}
      if (!res.headersSent) {const result=publicError(error,{allowServiceMessage:error instanceof ApiError,locale:req.headers["accept-language"]});if(result.status===429){const retryAfter=Number.isInteger(error.retryAfter)?Math.max(1,Math.min(3600,error.retryAfter)):900;res.setHeader("Retry-After",String(retryAfter));result.body.retryAfter=retryAfter}json(result.body,result.status)}
      else res.end()
      if (
        !(error instanceof ApiError) &&
        !(error.status >= 400 && error.status < 500)
      )
        console.error("Backend error:", error.code || error.name)
    }
  })
  server.requestTimeout = 30000
  server.headersTimeout = 15000
  server.on("close", () => worker.stop())
  server.authenticate = auth
  server.runMail = worker.run
  server.runOtpDeliveries = ()=>loginOtp.runDeliveries()
  return server
}
