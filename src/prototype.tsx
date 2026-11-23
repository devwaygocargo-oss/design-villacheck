import WorkspaceNavigation from "./WorkspaceNavigation";
import PublicMerchantRegistration from "./PublicMerchantRegistration";
import {useLocale,t as translateSystem} from "./locale";
import {BusinessReadinessNotice} from "./BusinessReadiness";
import {uiText} from "./uiLanguage";
import LanguageSwitcher,{usePublicLanguage} from "./publicLanguage";
import {translateMenu} from "./menuLanguage";
import {thaiUi} from "./thaiUi"
import PasswordRecovery from "./PasswordRecovery"
import PasswordRegistration from "./PasswordRegistration"
import HomeLogoLink from "./HomeLogoLink";
import AdminApprovalNotice from "./AdminApprovalNotice";
import { CmsPublicPage,useCopy } from "./cms";
import OtpLogin from "./OtpLogin";
import {oauthErrors} from "./authMessages";
import type {Account} from "./merchantStore";
import ContactLead from "./ContactLead";
import PublicMedia from "./PublicMedia";
import { usePackages, packageIntentKey } from "./packagePlans";
import { SocialLogin } from "./UserAccounts";
import { api, authenticate, currentAccount, logout, ApiError } from "./api";
import { openSupport } from "./support";
import { createContext, useContext, useEffect, useId, useState } from "react";

export type Page = "admin-audit-log" | "user-membership" | "owner-membership" | "admin-membership" | "business-owner-workspace" | "not-found"
  | "admin-archived-villas" | "admin-villa-page" | "admin-receiving-bank" | "admin-approved-villas" | "admin-verify" | "admin-pending-villas" | "admin-login" | "admin-cms" | "cms-page" | "user-registration" | "admin-users"
  | "home" | "directory" | "detail" | "scan" | "verify" | "pricing" | "login"
  | "about" | "verification-standard" | "articles" | "article-detail" | "owner-guide"
  | "help" | "contact" | "privacy" | "terms" | "social-facebook" | "social-instagram"
  | "social-line" | "gallery"
  | "owner-auth" | "owner-registration" | "owner-information" | "owner-onboarding-villa"
  | "package-confirmation" | "owner-select-villa" | "package-request-pending"
  | "owner-profile" | "owner-dashboard" | "owner-villas"
  | "owner-villa-detail" | "owner-villa-edit" | "owner-add-villa" | "owner-preview"
  | "owner-pending" | "owner-analytics" | "owner-reports" | "owner-package"
  | "user-profile" | "user-dashboard" | "user-checks" | "user-check-detail" | "user-reports"
  | "user-report-detail" | "user-precheck" | "user-check-success" | "villa-report" | "villa-report-success"
  | "admin-dashboard" | "admin-owners" | "admin-villas"
  | "admin-advertising" | "admin-reviews" | "admin-owner-verification" | "admin-leads" | "admin-settings" | "admin-payments" | "admin-subscriptions" | "admin-checks" | "admin-reports" | "admin-qr" | "admin-packages";

type Go = (page: Page, item?: string) => void;
type Status = "Pending" | "Verified" | "Rejected" | "Suspended" | "Expired";
export type UserReport = { reference: string; villa: string; type: string; guest: boolean; qr?:string; detail?:string; reporter?:string; contact?:string };

export function PublicInfoPage({ page, go, selectedArticle }: { page: Page; go: Go; selectedArticle?: string }) {
  if (page === "gallery" || page.startsWith("social-")) return <PublicMedia page={page} go={go} />;
  return <CmsPublicPage page={page} item={selectedArticle} go={go}/>;
}

export function PublicReportPage({ onSubmit, reference="" }: { reference?:string; onSubmit: (report: Omit<UserReport, "reference" | "guest">) => Promise<void> }) {
  const [reportAccount,setReportAccount]=useState(false);
  useEffect(()=>{void currentAccount().then(()=>setReportAccount(true)).catch(()=>setReportAccount(false));if(reference)void api<{name:string}>(`/public/qr/${encodeURIComponent(reference)}`).then(v=>setVilla(v.name)).catch(()=>{});},[reference]);
  const t=useCopy();
  const [villa, setVilla] = useState("");
  const [type, setType] = useState("ชื่อบัญชีไม่ตรง");
  const [detail, setDetail] = useState("");
  const [reporter, setReporter] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [busy,setBusy]=useState(false);
  const submit = async () => {
    if(busy)return;
    if (!villa.trim() || !detail.trim()) {
      setError("กรุณากรอกชื่อ Villa และรายละเอียดปัญหา");
      return;
    }
    setBusy(true);setError("");
    try {await onSubmit({ villa: villa.trim(), type, qr:reference||undefined, detail:detail.trim(),reporter:reporter.trim(),contact:contact.trim() });}
    catch(error){setError(error instanceof Error?error.message:"ส่ง Report ไม่สำเร็จ");}
    finally{setBusy(false);}
  };
  return <main className="page-bg public-report-page">
    <div className="page-hero container"><span className="kicker">{t("report.kicker")}</span><h1>{t("report.title")}</h1><p>{t("report.description")}</p></div>
    <div className="container report-form-card">
      <div className="report-guest-note"><span>{reportAccount?uiText("รายงานผูกกับบัญชีของคุณ ผู้ดูแลเท่านั้นที่เห็นข้อมูลผู้แจ้ง"):uiText("รายงานโดยไม่เข้าสู่ระบบ")}</span><strong>{uiText("ไม่บังคับเข้าสู่ระบบ")}</strong><p>{uiText("ข้อมูลผู้แจ้งและช่องทางติดต่อกลับไม่จำเป็นต้องระบุ")}</p></div>
      <div className="portal-form">
        <label><span>{t("report.villa")}</span><input value={villa} onChange={event => setVilla(event.target.value)} placeholder={uiText("ชื่อที่พักที่ต้องการแจ้งปัญหา")} /></label>
        <label><span>{t("report.type")}</span><select value={type} onChange={event => setType(event.target.value)}><option value={"ชื่อบัญชีไม่ตรง"}>{uiText("ชื่อบัญชีไม่ตรง")}</option><option value={"สงสัยเพจปลอม"}>{uiText("สงสัยเพจปลอม")}</option><option value={"ช่องทางติดต่อไม่ตรง"}>{uiText("ช่องทางติดต่อไม่ตรง")}</option><option value={"QR ผิดปกติ"}>{uiText("QR ผิดปกติ")}</option><option value={"อื่น ๆ"}>{uiText("อื่น ๆ")}</option></select></label>
        <label><span>{t("report.detail")}</span><textarea value={detail} onChange={event => setDetail(event.target.value)} placeholder={uiText("อธิบายข้อมูลหรือเหตุการณ์ที่พบ")} /></label>
        <div className="optional-fields"><label><span>{uiText("ชื่อผู้แจ้ง (ไม่จำเป็นต้องระบุ)")}</span><input value={reporter} onChange={event => setReporter(event.target.value)} placeholder={uiText("ไม่จำเป็นต้องระบุ")} /></label><label><span>{uiText("เบอร์โทรหรืออีเมลติดต่อกลับ (ไม่จำเป็นต้องระบุ)")}</span><input value={contact} onChange={event => setContact(event.target.value)} placeholder={uiText("ไม่จำเป็นต้องระบุ")} /></label></div>
        {error && <div className="form-message error-state">{uiText(error)}</div>}
        <button className="primary-button" disabled={busy} onClick={()=>void submit()}>{busy?uiText("กำลังบันทึก…"):t("report.submit")}</button>
      </div>
    </div>
  </main>;
}

export function PublicReportSuccess({ go, reference, linkedToUser }: { go: Go; reference: string; linkedToUser: boolean }) {
  const t=useCopy();
  const [status,setStatus]=useState(""),[note,setNote]=useState(""),[linked,setLinked]=useState(linkedToUser),[error,setError]=useState("");
  const statusLabel=["NEW","UNDER_REVIEW","RESOLVED","REJECTED"].includes(status)?translateSystem("support.status."+status):status;
  useEffect(()=>{let active=true;const refresh=()=>{if(!reference){setError("ไม่พบเลขอ้างอิงรายงาน");return;}void api<{status:string;publicNote:string;linkedToUser:boolean}>(`/public/reports/${encodeURIComponent(reference)}`).then(r=>{if(active){setStatus(r.status);setNote(r.publicNote);setLinked(r.linkedToUser);}}).catch(e=>{if(active)setError(e.message)});};refresh();const timer=window.setInterval(refresh,10000);return()=>{active=false;clearInterval(timer)};},[reference]);

  return <main className="page-bg public-report-page"><div className="page-hero container"><span className="kicker">{t("report.receivedKicker")}</span><h1>{status?t("report.receivedTitle"):uiText("กำลังตรวจสอบเลขอ้างอิง")}</h1><p>{t("report.receivedDescription")}</p></div><div className="container report-success-card"><StatusBadge status={status==="RESOLVED"?"Verified":status==="REJECTED"?"Rejected":"Pending"} /><span>{uiText("หมายเลขอ้างอิง")}</span><strong>{reference}</strong>{error?<p role="alert">{uiText(error)}</p>:<><p>{uiText("สถานะ: ")}{statusLabel||uiText("กำลังโหลด…")}</p>{note&&<p>{uiText("คำตอบจากทีมงาน: ")}{note}</p>}<a href={`#${new URLSearchParams({page:"villa-report-success",item:reference})}`}>{uiText("ลิงก์ติดตามรายงาน")}</a></>}<p>{uiText("กรุณาเก็บหมายเลขนี้ไว้สำหรับติดตามสถานะ")}{linked ? uiText(" · Report นี้ถูกเพิ่มในหน้า Report ของฉันแล้ว") : uiText(" · ส่งในรูปแบบ รายงานโดยไม่เข้าสู่ระบบ")}</p><div className="button-row">{linked && <button className="primary-button" onClick={() => go("user-reports")}>{uiText("ไปที่ Report ของฉัน")}</button>}<button className="outline-button" onClick={() => go("home")}>{uiText("กลับหน้าหลัก")}</button></div></div></main>;
}

const testAccounts = [
  { role: "User", email: "user@villacheck.test" },
  { role: "Merchant", email: "owner@villacheck.test" },
  { role: "Admin", email: "admin@villacheck.test" },
];

export function LoginPage({ go, onAuthenticated, reference = "", accountType="user",packageName="" }: { go: Go; reference?: string; onAuthenticated?: (role: "User" | "Merchant" | "Admin") => void;accountType?:"user"|"merchant";packageName?:string }) {
  const t=useCopy();
  const methodId=useId();
  const [unified,setUnified]=useState(false);
  const [otpBusy,setOtpBusy]=useState(false);
  const [passwordMode,setPasswordMode]=useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const oauthError = new URLSearchParams(window.location.hash.slice(1)).get("oauth_error");
  const [error, setError] = useState(oauthError ? oauthErrors[oauthError] || "OAuth ไม่สำเร็จ" : "");

  const [localAccounts, setLocalAccounts] = useState(false);
  const [loginReady,setLoginReady]=useState(false);
  const [registrationAvailable,setRegistrationAvailable]=useState(false);
  const [passwordOnly,setPasswordOnly]=useState(false);
  const [userHomeAvailable,setUserHomeAvailable]=useState(false);
  useEffect(() => {let active=true;void api<{localAccounts:boolean;releaseMode?:string;publicRegistrationEnabled?:boolean;unifiedAuthEnabled?:boolean;otp?:{email:boolean;sms:boolean}}>("/config").then(v=>{if(!active)return;setLocalAccounts(v.localAccounts);setRegistrationAvailable(v.publicRegistrationEnabled!==false);setUnified(v.unifiedAuthEnabled===true);const restricted=!v.otp?.email&&!v.otp?.sms;setPasswordOnly(restricted);if(restricted)setPasswordMode(true)}).catch(()=>{if(active){setPasswordMode(true);setError("ตรวจช่องทางเข้าสู่ระบบไม่สำเร็จ ใช้อีเมลและรหัสผ่าน หรือลองโหลดหน้าใหม่")}}).finally(()=>{if(active)setLoginReady(true)});return()=>{active=false}}, []);
  const authenticated=async(account:Account)=>{
    if(account.role==="admin"){await logout();window.location.assign("/admin/login");return;}
    if(unified){onAuthenticated?.("User");go("user-dashboard");return;}
    if(accountType==="merchant"&&account.role!=="merchant"){setUserHomeAvailable(account.role==="user");setError("บัญชีนี้เป็นผู้ใช้ทั่วไป กรุณาไปยังบัญชีผู้ใช้ ไม่สามารถเข้าพื้นที่ผู้ประกอบการได้");return;}
    const role=account.role==="merchant"?"Merchant":"User";
    onAuthenticated?.(role);
    if(role==="Merchant"){
      const destination = sessionStorage.getItem("villacheck-merchant-return");
      if(destination === "owner-package") { sessionStorage.removeItem("villacheck-merchant-return"); go("owner-package"); return; }
      if(accountType!=="merchant"){go(sessionStorage.getItem(packageIntentKey)?"owner-information":"owner-dashboard");return;}
      go(sessionStorage.getItem(packageIntentKey)?"owner-information":"owner-dashboard");
    }else go(reference?"verify":"user-dashboard",reference||undefined);
  };
  const login = async () => {
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const account = await authenticate(email, password);
      await authenticated(account);
    } catch (error) { if(error instanceof ApiError&&(error as ApiError&{code?:string}).code==="ADMIN_LOGIN_REQUIRED"){setPassword("");window.location.assign("/admin/login");return;}setError(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ"); }
    finally { setLoading(false); }
  };

  return <main className="login-screen">
    <div className="login-sheet">
      <div className="login-topbar"><button aria-label={uiText("กลับหน้าหลัก")} onClick={()=>go("home")}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 5-7 7 7 7"/></svg></button><button aria-label={uiText("ช่วยเหลือการเข้าสู่ระบบ")} onClick={()=>go("help")}><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4"/><path d="M12 16h.01"/></svg></button></div>
      <HomeLogoLink className="login-brand" onNavigate={()=>go("home")}><span className="login-brand-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/></svg></span><strong>Villa<span>Check</span></strong></HomeLogoLink>
      <h1 className="login-title">{unified?uiText("เข้าสู่ระบบ VillaCheck"):accountType==="merchant"?t("auth.merchantTitle"):t("auth.userTitle")}</h1>
      <div className="login-method-tabs" role="tablist" aria-label={uiText("วิธีเข้าสู่ระบบ")} onKeyDown={event=>{
        if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)||loading||otpBusy||!loginReady)return;
        event.preventDefault();const next=passwordOnly||event.key==="End"?true:event.key==="Home"?false:!passwordMode;
        setPasswordMode(next);setError("");event.currentTarget.querySelector<HTMLButtonElement>(next?'[data-method="password"]':'[data-method="otp"]')?.focus();
      }}>
        <button type="button" role="tab" data-method="otp" id={methodId+"-otp"} aria-controls={methodId+"-otp-panel"} aria-selected={!passwordMode} tabIndex={passwordMode?-1:0} disabled={!loginReady||loading||otpBusy||passwordOnly} onClick={()=>{setPasswordMode(false);setError("")}}>OTP</button>
        <button type="button" role="tab" data-method="password" id={methodId+"-password"} aria-controls={methodId+"-password-panel"} aria-selected={passwordMode} tabIndex={passwordMode?0:-1} disabled={!loginReady||loading||otpBusy} onClick={()=>{setPasswordMode(true);setError("")}}>{uiText("อีเมลและรหัสผ่าน")}</button>
      </div>
      {!unified&&accountType==="merchant"&&<p className="login-account-note">{packageName?uiText(`แพ็กเกจที่สนใจ: ${packageName} · `):""}{uiText("เลือกช่องทางเข้าสู่ระบบหรือสร้างบัญชี Merchant")}</p>}
      {userHomeAvailable&&<button type="button" className="primary-button login-user-home" onClick={()=>go(reference?"verify":"user-dashboard",reference||undefined)}>{uiText("ไปยังบัญชีผู้ใช้")}</button>}
      {passwordOnly&&<p className="login-account-note" role="status">{uiText("เข้าสู่ระบบด้วยอีเมลและรหัสผ่านเดิม · OTP ยังไม่เปิดใช้งาน")}</p>}
      {!passwordMode&&error&&<p className="login-error" role="alert">{uiText(error)}</p>}
      {!loginReady?<p role="status">{uiText("กำลังตรวจช่องทางเข้าสู่ระบบ…")}</p>:<>
      <div role="tabpanel" id={methodId+"-otp-panel"} aria-labelledby={methodId+"-otp"} hidden={passwordMode}><OtpLogin accountType={unified?"auto":accountType} onRegister={destination=>{try{const key="villacheck:merchant-signup-contact";if(destination)sessionStorage.setItem(key,JSON.stringify({destination,created:Date.now()}));else sessionStorage.removeItem(key);}catch{/* Registration still works without storage. */}go("owner-registration");}} onBusyChange={setOtpBusy} onAuthenticated={authenticated}/></div>
      <div role="tabpanel" id={methodId+"-password-panel"} aria-labelledby={methodId+"-password"} hidden={!passwordMode}>
      <form className="login-email-form" onSubmit={event=>{event.preventDefault();void login();}}>
        <label className="login-field"><span>{t("auth.email")}</span><input aria-label={t("auth.email")} required type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder={uiText("อีเมลของคุณ")}/></label>
        <label className="login-field"><span>{t("auth.password")}</span><input aria-label={t("auth.password")} required autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} type="password" placeholder={uiText("รหัสผ่าน")}/></label>
        {error&&<p className="login-error" role="alert">{uiText(error)}</p>}
        <button className="login-submit" disabled={loading}>{loading?uiText("กำลังเข้าสู่ระบบ…"):t("auth.submit")}</button>
      </form>
      </div></>}
      <div className="login-divider"><span>{uiText("หรือ")}</span></div>
      <SocialLogin reference={reference} variant="stacked" accountType={unified?"user":accountType}/>
      <PasswordRecovery accountType={unified?"user":accountType}/><div className="login-bottom">{!registrationAvailable&&<p role="status">{uiText("การสมัครบัญชีใหม่ยังไม่เปิดใช้งาน ขณะนี้เข้าสู่ระบบได้ด้วยบัญชีเดิมเท่านั้น")}</p>}{unified?<><button className="login-create" disabled={!registrationAvailable} onClick={()=>go("user-registration",reference)}>{uiText("สร้างบัญชี User")}</button><p>{uiText("สมัครเป็น Merchant ได้ภายหลังจากหน้า User Dashboard")}</p></>:accountType==="merchant"?<><button className="login-create" disabled={!registrationAvailable} onClick={()=>go("owner-registration")}>{uiText("สมัคร Merchant ใหม่")}</button><button className="login-merchant" onClick={()=>go("login")}>{t("auth.userLogin")}</button></>:<><button className="login-create" disabled={!registrationAvailable} onClick={()=>go("user-registration",reference)}>{t("auth.createUser")}</button><button className="login-merchant" onClick={()=>go("owner-auth")}>{t("auth.merchantLogin")}</button><button className="login-merchant" onClick={()=>go("owner-registration")}>{t("auth.createMerchant")}</button></>}<p>{uiText("เมื่อดำเนินการต่อ แสดงว่าคุณยอมรับ")}<button onClick={()=>go("terms")}>{uiText("เงื่อนไขการใช้บริการ")}</button>{uiText("และได้อ่าน")}<button onClick={()=>go("privacy")}>{uiText("นโยบายความเป็นส่วนตัว")}</button>{uiText("ของ VillaCheck แล้ว")}</p></div>
      {localAccounts && <div className="test-accounts">
        <strong>{uiText("บัญชีทดสอบบนเซิร์ฟเวอร์ Local")}</strong>
        {testAccounts.filter(account=>account.role!=="Admin").map(account => <button key={account.role === "Merchant" ? "Merchant" : account.role} onClick={() => { setEmail(account.email); setPassword(""); setError(""); }}>
          <span>{account.role === "Merchant" ? "Merchant" : account.role}</span><small>{account.email}</small>
        </button>)}
      </div>}
    </div>
  </main>;
}

export function OwnerPackageAuth({ go }: { go: Go; packageName: string; onOwnerLogin: () => void }) {
  return <LoginPage go={go} accountType="merchant"/>;
}

export function OwnerRegistration({ go }: { go: Go; packageName: string }) {
  const t=useCopy();
  const [unified,setUnified]=useState(false);useEffect(()=>{void api<{unifiedAuthEnabled?:boolean}>("/config").then(c=>setUnified(c.unifiedAuthEnabled===true)).catch(()=>{});},[]);
  return <FlowPage onHome={()=>go("home")} kicker="MERCHANT REGISTRATION" title={t("registration.merchantTitle")} subtitle={unified?uiText("สมัคร Merchant หลังเข้าสู่ระบบ เพิ่มที่พักภายหลังได้"):uiText("merchant.application.open")} onBack={()=>go("owner-auth")}><PublicMerchantRegistration onBack={()=>go("owner-auth")} onRegistered={account=>{if(account.role==="merchant")go("owner-dashboard");}}/></FlowPage>;
}

export function OwnerOnboardingVilla({ go, onVillaAdded }: { go: Go; onVillaAdded: (name: string) => void }) {
  const [name, setName] = useState("");
  const [province, setProvince] = useState("ชลบุรี");
  return <FlowPage onHome={()=>go("home")} kicker="ADD VILLA" title={uiText("เพิ่ม Villa แรกของคุณ")} subtitle={uiText("ข้อมูลนี้จะถูกส่งพร้อมคำขอแพ็กเกจ")} onBack={() => go("owner-information")}>
    <div className="form-stack"><label><span>{uiText("ชื่อ Villa")}</span><input value={name} onChange={event => setName(event.target.value)} placeholder={uiText("ชื่อที่พัก")} /></label><label><span>{uiText("จังหวัด")}</span><select value={province} onChange={event => setProvince(event.target.value)}>{["ชลบุรี","ประจวบคีรีขันธ์","นครราชสีมา","ภูเก็ต","เชียงใหม่","กระบี่","สุราษฎร์ธานี"].map(item => <option key={item} value={item}>{uiText(item)}</option>)}</select></label><button className="primary-button full" disabled={!name} onClick={() => { onVillaAdded(name); go("package-confirmation"); }}>{uiText("บันทึก Villa และดำเนินการต่อ")}</button></div>
  </FlowPage>;
}

export function PackageConfirmation({ go, packageName, villaName, onConfirm }: { go: Go; packageName: string; villaName: string; onConfirm: () => void }) {
  const {plans} = usePackages();
  const selectedPackage = plans.find(p=>p.id === packageName || p.name === packageName);
  if(!selectedPackage)return <FlowPage onHome={()=>go("home")} kicker="PACKAGE" title={uiText("กำลังโหลดแพ็กเกจ")} subtitle="" onBack={()=>go("pricing")}><p>{uiText("กรุณาเลือกแพ็กเกจที่เปิดใช้งาน")}</p></FlowPage>;
  return <FlowPage onHome={()=>go("home")} kicker="PACKAGE CONFIRMATION" title={uiText("ยืนยันแพ็กเกจ")} subtitle={uiText("ตรวจสอบรายละเอียดก่อนส่งคำขอ · ยังไม่มี Payment System")} onBack={() => go("pricing")}>
    <div className="confirmation-box package-confirmation">
      <div><span>{uiText("Package ที่เลือก")}</span><strong>{packageName}</strong><b>{selectedPackage.amount / 100} THB</b></div>
      <div><span>{uiText("Villa ที่เลือก")}</span><strong>{villaName || uiText("ยังไม่ได้เลือก Villa")}</strong><button className="text-button" onClick={() => go("owner-select-villa")}>{villaName ? uiText("เปลี่ยน Villa") : "Select Villa"} →</button></div>
      <div><span>{uiText("Features")}</span><ul>{selectedPackage.features.map(feature => <li key={feature}>✓ {uiText(feature)}</li>)}</ul></div>
      <p>{uiText("ไม่มีการเรียกเก็บเงินใน Prototype ทีมงานจะตรวจสอบและติดต่อกลับหลังอนุมัติคำขอ")}</p>
    </div>
    <button className="primary-button full" disabled={!villaName} onClick={onConfirm}>{uiText("ยืนยันแพ็กเกจ")}</button>
  </FlowPage>;
}

export function OwnerSelectVilla({ go, onSelect }: { go: Go; onSelect: (villa: string) => void }) {
  return <FlowPage onHome={()=>go("home")} kicker="SELECT VILLA" title={uiText("เลือก Villa สำหรับแพ็กเกจ")} subtitle={uiText("เลือกที่พักที่ต้องการใช้แพ็กเกจนี้")} onBack={() => go("package-confirmation")}>
    <div className="villa-choice"><button onClick={() => { onSelect("Sea Sky Pool Villa"); go("package-confirmation"); }}><span>Sea Sky Pool Villa</span><small>{uiText("ชลบุรี · VillaCheck VERIFIED")}</small></button><button onClick={() => { onSelect("Hua Hin Blue House"); go("package-confirmation"); }}><span>Hua Hin Blue House</span><small>{uiText("ประจวบคีรีขันธ์ · Pending")}</small></button></div>
  </FlowPage>;
}

export function PackageRequestPending({ go, packageName }: { go: Go; packageName: string }) {
  return <FlowPage onHome={()=>go("home")} kicker="REQUEST SUBMITTED" title={uiText("ส่งคำขอแพ็กเกจเรียบร้อยแล้ว")} subtitle={uiText("ทีมงาน VillaCheck จะตรวจสอบข้อมูลก่อนเปิดใช้งาน")} onBack={() => go("package-confirmation")}>
    <div className="state-panel"><StatusBadge status="Pending" /><h2>{uiText("รอดำเนินการ / Pending")}</h2><p>{packageName}{uiText(" · ไม่มีการชำระเงินในขั้นตอนนี้")}</p></div>
    <button className="primary-button full" onClick={() => go("owner-dashboard")}>{uiText("ไป Merchant Dashboard")}</button>
  </FlowPage>;
}

function FlowPage({ kicker, title, subtitle, onBack, onHome, children }: { kicker: string; title: string; subtitle: string; onBack: () => void; onHome: () => void; children: React.ReactNode }) {
  return <main className="page-bg flow-page"><div className="flow-card"><HomeLogoLink className="flow-brand" onNavigate={onHome}>Villa<span>Check</span></HomeLogoLink>
    <button className="text-button" onClick={onBack}>{uiText("← ย้อนกลับ")}</button>
    <span className="kicker">{uiText(kicker)}</span><h1>{uiText(title)}</h1><p>{uiText(subtitle)}</p>{children}
  </div></main>;
}

const ownerNav: [string, Page][] = [
  ["ภาพรวม", "owner-dashboard"], ["ที่พักของฉัน", "owner-villas"], ["เพิ่มที่พัก", "owner-add-villa"],
  ["แพ็กเกจและสิทธิ์", "owner-membership"], ["สิทธิ์แพ็กเกจเดิม", "owner-package"], ["จัดการเอกสาร", "owner-pending"], ["ข้อมูลบัญชี", "owner-profile"],
];
const adminNav: [string, Page][] = [
  ["ประวัติการอนุมัติ", "admin-audit-log"],
  ["สมาชิกและ Trial", "admin-membership"], ["CMS เว็บไซต์", "admin-cms"], ["Dashboard", "admin-dashboard"], ["Villa รออนุมัติ", "admin-pending-villas"], ["Villa ที่อนุมัติแล้ว", "admin-approved-villas"], ["ที่พัก Archived", "admin-archived-villas"], ["Users", "admin-users"], ["Merchants", "admin-owners"],
  ["ประวัติตรวจสอบ", "admin-checks"], ["รายงานปัญหา", "admin-reports"], ["ทะเบียน QR", "admin-qr"], ["แพ็กเกจ / โปรโมชั่น", "admin-packages"], ["รีวิวลูกค้า", "admin-reviews"], ["ตรวจการชำระเงิน", "admin-payments"], ["บัญชีรับเงิน", "admin-receiving-bank"], ["Leads", "admin-leads"], ["Settings", "admin-settings"],
];
const userNav: [string, Page][] = [
  ["แพ็กเกจสมาชิก", "user-membership"], ["ภาพรวม", "user-dashboard"], ["ประวัติตรวจสอบ", "user-checks"], ["รายงานของฉัน", "user-reports"], ["ข้อมูลบัญชี", "user-profile"],
  ["ตรวจข้อมูลก่อนโอน", "user-precheck"],
];

const inheritedPortalRole=createContext<string|null>(null);
export function PortalShell(props:Parameters<typeof PortalShellLayout>[0]){const inherited=useContext(inheritedPortalRole);return inherited===props.role?<>{props.children}</>:<PortalShellLayout {...props}/>;}
function PortalShellLayout({ role, page, go, children, phase1: explicitPhase1 }: { phase1?:boolean; role: "Merchant" | "Admin" | "User" | "Business Owner"; page: Page; go: Go; children: React.ReactNode }) {
  const {locale,t:dashboardText}=useLocale();
  const [detectedPhase1,setDetectedPhase1]=useState<boolean|null>(null);
  useEffect(()=>{if(explicitPhase1!==undefined)return;let active=true;void api<{releaseMode?:string}>("/config").then(c=>{if(active)setDetectedPhase1(["PRELAUNCH","PHASE1","PHASE1_PUBLIC","STAGING_INTERACTIVE","MEMBER_PREVIEW"].includes(c.releaseMode||""))}).catch(()=>{if(active)setDetectedPhase1(true)});return()=>{active=false}},[explicitPhase1]);
  const phase1=explicitPhase1??(detectedPhase1!==false);
  const [permissionNames,setPermissionNames]=useState<string[]>([]);
  const allNav = role === "Business Owner" ? [["ภาพรวม Business Owner", "business-owner-workspace"]] as [string,Page][] : role === "Merchant" ? ownerNav : role === "Admin" ? adminNav : userNav;
  const nav = role === "Business Owner" ? allNav : role === "Admin" ? adminNav.filter(([,target])=>target!=="admin-receiving-bank"||permissionNames.includes("bank.manage")).filter(([,target])=>target!=="admin-settings"||permissionNames.includes("system.configure")) : role === "User" ? userNav : phase1 ? allNav.filter(([label,target])=>role==="Merchant"?["owner-dashboard","owner-villas","owner-add-villa","owner-package","owner-membership","owner-pending","owner-profile"].includes(target)&&label!=="การชำระเงิน":false) : allNav;
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{let active=true,version=0;const refresh=()=>{const request=++version;void currentAccount().then(account=>{if(active&&request===version){setSignedIn(true);setPermissionNames(account.businessPermissions||[]);}}).catch(error=>{if(active&&request===version&&error instanceof ApiError&&error.status===401)setSignedIn(false)});};refresh();window.addEventListener("auth-session-changed",refresh);window.addEventListener("focus",refresh);return()=>{active=false;window.removeEventListener("auth-session-changed",refresh);window.removeEventListener("focus",refresh)}},[page,role]);
  const signOut = async () => {
    try { await logout(); navigate(role === "Admin" ? "admin-login" : "login"); }
    catch (error) { if (error instanceof ApiError && error.status === 401) navigate(role === "Admin" ? "admin-login" : "login"); else setLogoutError(error instanceof Error ? error.message : dashboardText("ออกจากระบบไม่สำเร็จ")); }
  };
  const navigate = (target: Page) => { setMenuOpen(false); go(target); };
  useEffect(() => { setMenuOpen(false); }, [page]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return <inheritedPortalRole.Provider value={role}><main className={`portal-page${role === "User" ? " portal-user" : role === "Merchant" ? " portal-merchant" : " portal-admin"}`}>
    <aside className={`portal-side ${menuOpen ? "portal-menu-open" : ""}`}>
      <div className="portal-mobile-bar">
        <HomeLogoLink className="portal-brand" onNavigate={() => navigate("home")}>Villa<span>Check</span></HomeLogoLink>
        <button className="portal-menu-toggle" aria-expanded={menuOpen} aria-controls="portal-menu" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? dashboardText(translateSystem("ปิดเมนู"))+" ✕" : dashboardText(translateSystem("เมนู"))+" ☰"}</button>
      </div>
      <small>{dashboardText(role === "Business Owner" ? "Business Owner" : role === "Merchant" ? translateSystem("พื้นที่ผู้ประกอบการ") : role==="Admin"?translateSystem("พื้นที่ผู้ดูแลระบบ"):translateSystem("พื้นที่ผู้ใช้งาน"))}</small><div className="portal-locale"><LanguageSwitcher/></div>
      <nav id="portal-menu" aria-label={`${dashboardText(translateSystem("เมนู"))} ${role === "Merchant" ? "Merchant" : role}`}>{nav.map(([label, target]) => <button key={`${target}:${label}`} aria-current={page === target ? "page" : undefined} className={page === target ? "active" : ""} onClick={() => navigate(target)}>{dashboardText(translateMenu(label,locale))}</button>)}</nav>
      <WorkspaceNavigation/>
      {signedIn&&<button className="portal-logout" onClick={() => void signOut()}>{dashboardText(translateSystem("ออกจากระบบ"))}</button>}{logoutError && <p role="alert">{logoutError}</p>}
    </aside>
    <section className="portal-content"><BusinessReadinessNotice/>{!phase1&&role==="Admin"&&<AdminApprovalNotice go={go}/>}{children}</section>
  </main></inheritedPortalRole.Provider>;
}

function PortalHead({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="portal-head"><div><span className="kicker">{uiText("VILLACHECK PROTOTYPE")}</span><h1>{uiText(title)}</h1><p>{uiText(subtitle)}</p></div>{uiText(action)}</div>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{uiText(thaiUi(status))}</span>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric-card"><span>{uiText(label)}</span><strong>{value}</strong><small>{note}</small></div>;
}

export function OwnerPages({ page, go, packageName, packageStatus, setPackageName, onPackageChange }: { page: Page; go: Go; packageName: string; packageStatus: string; setPackageName: (name: string) => void; onPackageChange: () => void }) {
  if (page === "owner-dashboard") return <PortalShell role="Merchant" page={page} go={go}>
    <PortalHead title={uiText("Merchant Dashboard")} subtitle={uiText("ภาพรวม Sea Sky Pool Villa")} action={<button className="primary-button" onClick={() => go("owner-add-villa")}>{uiText("+ Add Villa")}</button>} />
    <div className="package-strip"><span>{uiText("แพ็กเกจปัจจุบัน")}</span><strong>{packageName}</strong><StatusBadge status={packageStatus.includes("Pending") ? "Pending" : "Verified"} /><small>{packageStatus}</small><button onClick={() => go("owner-package")}>{uiText("เปลี่ยน Package")}</button></div>
    <div className="metric-grid"><Metric label="Villas" value="1" note="1 Verified" /><Metric label="QR Scans" value="248" note={uiText("+18% เดือนนี้")} /><Metric label="Checks" value="91" note="Success 88" /><Metric label="Reports" value="2" note="Pending 1" /></div>
    <div className="portal-grid"><ActionCard title={uiText("จัดการ Villa")} text={uiText("ดูรายละเอียด แก้ไข และสถานะ")} action="เปิด Villas" onClick={() => go("owner-villas")} /><ActionCard title="Verification QR" text={uiText("เปิดหน้าสแกนและผลตรวจสอบ")} action="เปิด QR" onClick={() => go("scan")} /><ActionCard title={uiText("Analytics")} text={uiText("ดูสถิติการเข้าชม")} action="ดู Analytics" onClick={() => go("owner-analytics")} /></div>
  </PortalShell>;

  if (page === "owner-villas") return <PortalShell role="Merchant" page={page} go={go}><PortalHead title="Villas" subtitle={uiText("จัดการที่พักทั้งหมด")} action={<button className="primary-button" onClick={() => go("owner-add-villa")}>{uiText("+ Add Villa")}</button>} /><DataRow title="Sea Sky Pool Villa" detail="บางแสน, ชลบุรี" status="Verified" action="ดูรายละเอียด" onClick={() => go("owner-villa-detail")} /></PortalShell>;
  if (page === "owner-villa-detail") return <PortalShell role="Merchant" page="owner-villas" go={go}><PortalHead title="Sea Sky Pool Villa" subtitle="Villa Detail · VC-TH-2025-01842" action={<button className="primary-button" onClick={() => go("owner-villa-edit")}>{uiText("Edit")}</button>} /><DetailPanel /><button className="outline-button" onClick={() => go("verify")}>{uiText("เปิด Verification Page")}</button></PortalShell>;
  if (page === "owner-villa-edit") return <PortalShell role="Merchant" page="owner-villas" go={go}><PortalHead title="Edit Villa" subtitle={uiText("แก้ไขข้อมูลที่พัก")} /><VillaForm submitLabel="บันทึกการแก้ไข" onSubmit={() => go("owner-villa-detail")} /></PortalShell>;
  if (page === "owner-add-villa") return <PortalShell role="Merchant" page={page} go={go}><PortalHead title="Add Villa" subtitle={uiText("กรอกข้อมูลที่พักเพื่อส่งตรวจสอบ")} /><VillaForm submitLabel="Preview" onSubmit={() => go("owner-preview")} /></PortalShell>;
  if (page === "owner-preview") return <PortalShell role="Merchant" page="owner-add-villa" go={go}><PortalHead title="Preview Villa" subtitle={uiText("ตรวจสอบข้อมูลก่อน Submit")} /><DetailPanel /><div className="button-row"><button className="outline-button" onClick={() => go("owner-add-villa")}>{uiText("กลับไปแก้ไข")}</button><button className="primary-button" onClick={() => go("owner-pending")}>{uiText("Submit")}</button></div></PortalShell>;
  if (page === "owner-pending") return <PortalShell role="Merchant" page="owner-villas" go={go}><PortalHead title="Pending Review" subtitle={uiText("ส่งข้อมูลเข้าระบบสำเร็จ")} /><StatePanel status="Pending" title={uiText("กำลังรอ Admin ตรวจสอบ")} /><button className="primary-button" onClick={() => go("owner-villas")}>{uiText("กลับไปหน้า Villas")}</button></PortalShell>;
  if (page === "owner-analytics") return <PortalShell role="Merchant" page={page} go={go}><PortalHead title={uiText("Analytics")} subtitle={uiText("ข้อมูลสาธิต 30 วันล่าสุด")} /><div className="metric-grid"><Metric label="Profile Views" value="1,248" note="+14%" /><Metric label="QR Scans" value="248" note="+18%" /><Metric label="Contact Clicks" value="93" note="+7%" /></div><div className="chart-demo">{[42,68,51,82,60,91,75].map((_, index) => <i key={index} className={`chart-bar-${index + 1}`} />)}</div></PortalShell>;
  if (page === "owner-reports") return <PortalShell role="Merchant" page={page} go={go}><PortalHead title="Reports" subtitle={uiText("รายการแจ้งปัญหาที่เกี่ยวข้องกับที่พัก")} /><DataRow title="REP-1048" detail="ผู้ใช้แจ้งข้อมูลบัญชีไม่ตรง" status="Pending" action="รับทราบ" onClick={() => window.alert(uiText("บันทึกการรับทราบรายงานแล้ว"))} /><DataRow title="REP-1022" detail="ข้อมูลติดต่อได้รับการแก้ไขแล้ว" status="Verified" action="ดูรายละเอียด" onClick={() => window.alert(uiText("รายงาน REP-1022: ดำเนินการสำเร็จ"))} /></PortalShell>;
  return <PortalShell role="Merchant" page="owner-package" go={go}><PortalHead title="Package" subtitle={uiText(`แพ็กเกจปัจจุบัน: ${packageName} · ${packageStatus}`)} /><PackagePicker selected={packageName} onSelect={name => { setPackageName(name); onPackageChange(); window.alert(uiText(`ส่งคำขอเปลี่ยนแพ็กเกจเป็น ${name} แล้ว`)); }} /></PortalShell>;
}

function VillaForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: () => void }) {
  const [name, setName] = useState("Sea Sky Pool Villa");
  const [province, setProvince] = useState("ชลบุรี");
  const [contact, setContact] = useState("08X-XXX-4289");
  return <div className="portal-form">
    <label><span>{uiText("ชื่อ Villa")}</span><input value={name} onChange={event => setName(event.target.value)} /></label>
    <label><span>{uiText("จังหวัด")}</span><select value={province} onChange={event => setProvince(event.target.value)}>{["ชลบุรี","ประจวบคีรีขันธ์","นครราชสีมา","ภูเก็ต","เชียงใหม่","กระบี่","สุราษฎร์ธานี"].map(item => <option key={item} value={item}>{uiText(item)}</option>)}</select></label>
    <label><span>{uiText("Official Contact")}</span><input value={contact} onChange={event => setContact(event.target.value)} /></label>
    <label><span>{uiText("รายละเอียด")}</span><textarea defaultValue="พูลวิลล่าส่วนตัว พร้อมสระว่ายน้ำและพื้นที่สำหรับครอบครัว" /></label>
    <button className="primary-button" onClick={onSubmit} disabled={!name || !contact}>{submitLabel}</button>
  </div>;
}

function DetailPanel() {
  return <div className="detail-panel"><div><span>{uiText("ชื่อที่พัก")}</span><strong>Sea Sky Pool Villa</strong></div><div><span>{uiText("จังหวัด")}</span><strong>{uiText("ชลบุรี")}</strong></div><div><span>{uiText("Official Contact")}</span><strong>08X-XXX-4289</strong></div><div><span>{uiText("Status")}</span><StatusBadge status="Verified" /></div></div>;
}

function PackagePicker({ selected, onSelect }: { selected: string; onSelect: (name: string) => void }) {
  const {plans}=usePackages();
  return <div className="package-picker">{plans.map(p=>p.name).map(name => <button key={name} className={selected === name ? "active" : ""} onClick={() => onSelect(name)}><span>{name}</span><small>{selected === name ? uiText("แพ็กเกจปัจจุบัน") : uiText("เลือกแพ็กเกจ")}</small></button>)}</div>;
}

export function AdminPages({ page, go, villaStatus, setVillaStatus }: { page: Page; go: Go; villaStatus: Status; setVillaStatus: (status: Status) => void }) {
  if (page === "admin-dashboard") return <PortalShell role="Admin" page={page} go={go}><PortalHead title={uiText("Admin Dashboard")} subtitle={uiText("ภาพรวมระบบ VillaCheck")} /><div className="metric-grid"><Metric label="Pending Villas" value="4" note={uiText("รอตรวจสอบ")} /><Metric label="Merchants" value="128" note="Active 123" /><Metric label="Checks" value="2,481" note={uiText("เดือนนี้")} /><Metric label="Reports" value="12" note="Open 3" /></div><ActionCard title="Pending Villa" text={uiText("Sea Sky Pool Villa รอการตรวจสอบ")} action="Review" onClick={() => go("admin-pending-villas")} /><StateGallery /></PortalShell>;
  const configs: Partial<Record<Page, [string,string]>> = {
    "admin-owners": ["Merchants", "บัญชีเจ้าของที่พักและสถานะการใช้งาน"],
    "admin-villas": ["Villas", "รายการ Villa และสถานะล่าสุด"],
    "admin-checks": ["Checks", "ประวัติการตรวจสอบก่อนโอน"],
    "admin-reports": ["Reports", "รายงานปัญหาจากผู้ใช้งาน"],
    "admin-qr": ["QR", "QR Reference และสถานะ"],
    "admin-packages": ["Packages", "แพ็กเกจที่ Merchant ใช้งาน"],
  };
  const [title, subtitle] = configs[page] ?? ["Admin", "จัดการระบบ"];
  return <PortalShell role="Admin" page={page} go={go}><PortalHead title={uiText(title)} subtitle={subtitle} />
    {page === "admin-owners" && <><DataRow title="Sea Sky Co., Ltd." detail="owner@villacheck.test" status="Verified" action="เปิด Merchant" onClick={() => window.alert(uiText("Merchant: Sea Sky Co., Ltd."))} /><DataRow title="North Stay Group" detail="สถานะถูกระงับชั่วคราว" status="Suspended" action="ตรวจสอบ" onClick={() => window.alert(uiText("บัญชี Suspended"))} /></>}
    {page === "admin-villas" && <DataRow title="Sea Sky Pool Villa" detail="VC-TH-2025-01842" status={villaStatus} action="Review" onClick={() => go("admin-pending-villas")} />}
    {page === "admin-checks" && <DataRow title="CHK-2081" detail="Sea Sky Pool Villa · Success" status="Verified" action="ดู Check" onClick={() => window.alert(uiText("CHK-2081 · Verification Success · Sea Sky Pool Villa"))} />}
    {page === "admin-reports" && <DataRow title="REP-1048" detail="ข้อมูลบัญชีไม่ตรง" status="Pending" action="เปิด Report" onClick={() => window.alert(uiText("REP-1048 · อยู่ระหว่างตรวจสอบข้อมูลบัญชี"))} />}
    {page === "admin-qr" && <><DataRow title="VC-TH-2025-01842" detail="Sea Sky Pool Villa" status="Verified" action="Verification Page" onClick={() => go("verify")} /><DataRow title="VC-TH-2024-00991" detail="QR หมดอายุ" status="Expired" action="ดูรายละเอียด" onClick={() => window.alert(uiText("QR นี้หมดอายุแล้ว"))} /></>}
    {page === "admin-packages" && <PackagePicker selected="Trust Pro" onSelect={name => window.alert(uiText(`เปิดรายละเอียด ${name}`))} />}
  </PortalShell>;
}

function StateGallery() {
  const [state, setState] = useState("Loading");
  const states = ["Loading","Empty","Success","Error","Pending","Verified","Rejected","Suspended","Expired"];
  return <div className="state-gallery"><strong>{uiText("Interaction States")}</strong><div>{states.map(item => <button key={item} className={state === item ? "active" : ""} onClick={() => setState(item)}>{item}</button>)}</div><p>{state === "Loading" ? uiText("กำลังโหลดข้อมูล...") : state === "Empty" ? uiText("ยังไม่มีข้อมูลในรายการนี้") : uiText(`สถานะ ${state}`)}</p></div>;
}

export function UserPages({ page, go, reports, selectedReference }: { page: Page; go: Go; reports: UserReport[]; selectedReference?: string }) {
  if (page === "user-dashboard") return <PortalShell role="User" page={page} go={go}><PortalHead title={uiText("User Dashboard")} subtitle={uiText("ตรวจสอบที่พักก่อนโอนอย่างมั่นใจ")} action={<button className="primary-button" onClick={() => go("user-precheck")}>{uiText("Check Before Transfer")}</button>} /><div className="metric-grid"><Metric label="Checks" value="3" note="Verified 2" /><Metric label="Reports" value={String(reports.length)} note={uiText("กำลังดำเนินการ")} /></div><div className="portal-grid"><ActionCard title="Checks" text={uiText("ดูประวัติการตรวจสอบ")} action="เปิด Checks" onClick={() => go("user-checks")} /><ActionCard title={uiText("Report ของฉัน")} text={uiText("ติดตามรายงานปัญหา")} action="เปิด Report" onClick={() => go("user-reports")} /></div></PortalShell>;
  if (page === "user-checks") return <PortalShell role="User" page={page} go={go}><PortalHead title="Checks" subtitle={uiText("ประวัติการตรวจสอบก่อนโอน")} /><DataRow title="CHK-2081" detail="Sea Sky Pool Villa · 20 มิ.ย. 2568" status="Verified" action="Check Detail" onClick={() => go("user-check-detail")} /></PortalShell>;
  if (page === "user-check-detail") return <PortalShell role="User" page="user-checks" go={go}><PortalHead title="Check Detail" subtitle="Reference CHK-2081" /><StatePanel status="Verified" title="VillaCheck VERIFIED" /><DetailPanel /><button className="outline-button" onClick={() => go("detail")}>{uiText("ดู Trust Profile")}</button></PortalShell>;
  if (page === "user-reports") return <PortalShell role="User" page={page} go={go}><PortalHead title={uiText("Report ของฉัน")} subtitle={uiText("รายงานที่ผูกกับบัญชี User ของคุณ")} action={<button className="primary-button" onClick={() => go("villa-report")}>+ แจ้งปัญหา</button>} />{reports.length ? reports.map(report => <DataRow key={report.reference} title={report.reference} detail={`${report.villa} · ${report.type}`} status="Pending" action="Report Detail" onClick={() => go("user-report-detail", report.reference)} />) : <StatePanel status="Pending" title={uiText("ยังไม่มี Report")} />}</PortalShell>;
  if (page === "user-report-detail") return <PortalShell role="User" page="user-reports" go={go}><PortalHead title="Report Detail" subtitle={`Reference ${reports.find(report => report.reference === selectedReference)?.reference ?? reports[0]?.reference ?? "RPT-1042"}`} /><StatePanel status="Pending" title={uiText("ทีมงานกำลังตรวจสอบ")} /><p className="portal-note">{uiText("ระบบได้รับข้อมูลแล้ว และจะแจ้งผลเมื่อดำเนินการเสร็จสิ้น")}</p><button className="outline-button" onClick={() => go("user-reports")}>{uiText("กลับไป Report ของฉัน")}</button></PortalShell>;
  if (page === "user-check-success") return <PortalShell role="User" page="user-precheck" go={go}><PortalHead title={uiText("สร้างรายการตรวจสอบสำเร็จ")} subtitle={uiText("บันทึกข้อมูลเรียบร้อยแล้ว")} /><StatePanel status="Verified" title="CHK-2081" /><button className="primary-button" onClick={() => go("user-check-detail")}>{uiText("ดู Check Detail")}</button></PortalShell>;
  return <PortalShell role="User" page="user-precheck" go={go}><PortalHead title={uiText("Check Before Transfer")} subtitle={uiText("กรอกข้อมูลก่อนโอนเพื่อสร้างรายการตรวจสอบ")} /><PrecheckForm onSubmit={() => go("user-check-success")} /></PortalShell>;
}

function PrecheckForm({ onSubmit }: { onSubmit: () => void }) {
  const [villa, setVilla] = useState("");
  const [account, setAccount] = useState("");
  const [contact, setContact] = useState("");
  return <div className="portal-form"><label><span>{uiText("ชื่อ Villa")}</span><input value={villa} onChange={event => setVilla(event.target.value)} placeholder={uiText("ชื่อที่พัก")} /></label><label><span>{uiText("เลขบัญชีที่ได้รับ")}</span><input value={account} onChange={event => setAccount(event.target.value)} placeholder="XXX-X-XXXXX-X" /></label><label><span>{uiText("ช่องทางติดต่อ")}</span><input value={contact} onChange={event => setContact(event.target.value)} placeholder={uiText("เบอร์โทรหรือ LINE")} /></label><button className="primary-button" disabled={!villa || !account || !contact} onClick={onSubmit}>{uiText("Submit")}</button></div>;
}

function ActionCard({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return <article className="action-card"><h3>{uiText(title)}</h3><p>{uiText(text)}</p><button className="text-button" onClick={onClick}>{uiText(action)} →</button></article>;
}

function DataRow({ title, detail, status, action, onClick }: { title: string; detail: string; status: Status; action: string; onClick: () => void }) {
  return <div className="data-row"><div><strong>{title}</strong><span>{detail}</span></div><StatusBadge status={status} /><button className="outline-button" onClick={onClick}>{uiText(action)}</button></div>;
}

function StatePanel({ status, title }: { status: Status; title: string }) {
  return <div className="state-panel"><StatusBadge status={status} /><h2>{uiText(title)}</h2><p>{uiText("สถานะล่าสุดจากระบบ Prototype ของ VillaCheck")}</p></div>;
}
