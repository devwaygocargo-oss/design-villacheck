import PhoneVerification from "./PhoneVerification";
import {normalizeProfileOtpPhone} from "../server/phone-number.mjs";
import {usePublicLanguage} from "./publicLanguage";
import PasswordSignup from "./PasswordSignup";
import {uiText} from "./uiLanguage";
import {localeTag} from "./uiLanguage";
import AccountPrivacy from "./AccountPrivacy"
import AccountSecurity from "./AccountSecurity"
import OtpLogin from "./OtpLogin"
import SocialLogin from "./SocialLogin";
import HomeLogoLink from "./HomeLogoLink";
import { useEffect, useState } from "react";
import { api, currentAccount, ApiError } from "./api";
import { PortalShell, type Page } from "./prototype";
import type { Account } from "./merchantStore";

export { SocialLogin };

export function UserRegistration({ go, reference }: { go: (page: Page, item?: string) => void; reference: string }) {
  const {locale}=usePublicLanguage(),en=locale==="en";
  return <main className="auth-page"><div className="auth-card"><HomeLogoLink className="flow-brand" onNavigate={()=>go("home")}>Villa<span>Check</span></HomeLogoLink><button className="text-button" onClick={() => go("login", reference)}>{en?"← Sign in":"← เข้าสู่ระบบ"}</button><span className="kicker">VILLACHECK / USER ACCOUNT</span><h1>{en?"Create user account":"สร้างบัญชีผู้ใช้"}</h1><p>{en?"Enter your name, email and password to get started.":"กรอกชื่อ อีเมล และรหัสผ่าน เพื่อเริ่มใช้งาน"}</p><PasswordSignup onAuthenticated={()=>go("user-dashboard")}/><section className="registration-other-methods"><h2>{en?"Or register / sign in with OTP":"หรือสมัคร / เข้าสู่ระบบด้วย OTP"}</h2><OtpLogin accountType="user" onAuthenticated={()=>go("user-dashboard")}/><SocialLogin accountType="user"/></section></div></main>;
}

type Member = { id: string; name: string; email: string; created: string; lastLogin: string | null; providers: string[] };
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString(localeTag(), { timeZone: "Asia/Bangkok" }) : "ยังไม่เข้าใช้";
export function AdminUsers({ go }: { go: (page: Page) => void }) {
  const [users, setUsers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void currentAccount().then(user => { if (user.role !== "admin") throw Error("เฉพาะ Admin สามารถดูข้อมูล User ได้"); return api<{ users: Member[] }>("/admin/users"); }).then(v => { if (!cancelled) setUsers(v.users); }).catch(error => { if (!cancelled) setError(error.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const visible = users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()));
  return <PortalShell role="Admin" page="admin-users" go={go}><div className="portal-head"><div><span className="kicker">{uiText("MEMBER MANAGEMENT")}</span><h1>{uiText("ข้อมูล User")}</h1><p>{uiText("สมาชิก ")}{users.length}{uiText(" บัญชี · ข้อมูลจาก Backend")}</p></div></div><div className="merchant-toolbar"><input aria-label={uiText("ค้นหา User")} placeholder={uiText("ค้นหาชื่อหรืออีเมล…")} value={search} onChange={e => setSearch(e.target.value)} /></div>{error && <p role="alert">{uiText(error)}</p>}{loading ? <p>{uiText("กำลังโหลดข้อมูล…")}</p> : <div className="user-table-wrap"><table className="user-table"><thead><tr><th>{uiText("สมาชิก")}</th><th>{uiText("ช่องทางสมัคร")}</th><th>{uiText("วันที่สมัคร")}</th><th>{uiText("เข้าใช้ล่าสุด")}</th></tr></thead><tbody>{visible.map(user => <tr key={user.id}><td data-label="สมาชิก"><strong>{user.name}</strong><small>{user.email}</small></td><td data-label="ช่องทางสมัคร">{user.providers.length ? user.providers.map(p => p === "google" ? "Google" : p === "line" ? "LINE" : "Facebook").join(", ") : uiText("อีเมล / รหัสผ่าน")}</td><td data-label="วันที่สมัคร">{timestamp(user.created)}</td><td data-label="เข้าใช้ล่าสุด">{timestamp(user.lastLogin)}</td></tr>)}</tbody></table>{!visible.length && <p className="merchant-empty">{uiText("ไม่พบสมาชิก")}</p>}</div>}</PortalShell>;
}

export function MemberDashboard({ go }: { go: (page: Page) => void }) {
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let cancelled = false; void currentAccount().then(value => { if (!cancelled) { if (value.role !== "user") go("login"); else setUser(value); } }).catch(error => { if (!cancelled) setError(error.message); }); return () => { cancelled = true; }; }, []);
  return <PortalShell role="User" page="user-dashboard" go={go}><div className="portal-head"><div><span className="kicker">{uiText("VILLACHECK / MEMBER")}</span><h1>{user ? uiText(`สวัสดี ${user.name}`) : uiText("บัญชี User")}</h1><p>{user?.email}</p></div></div>{error ? <div className="merchant-panel"><p role="alert">{uiText(error)}</p><button className="primary-button" onClick={() => go("login")}>{uiText("เข้าสู่ระบบ")}</button></div> : <div className="merchant-panel"><h2>{uiText("ตรวจสอบที่พักก่อนโอน")}</h2><p>{uiText("สแกน QR ของที่พักเพื่อดูข้อมูลที่ผ่านการตรวจสอบ และกรอกข้อมูลที่ได้รับเพื่อตรวจว่าตรงกับทะเบียนหรือไม่")}</p><button className="primary-button" onClick={() => go("scan")}>{uiText("สแกน QR ที่พัก →")}</button></div>}</PortalShell>;
}


export function UserProfile({go}:{go:(page:Page)=>void}) {
 const [phoneRevision,setPhoneRevision]=useState(0);
 const [profile,setProfile]=useState({name:"",email:"",phone:"",address:""}),[ready,setReady]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{let active=true;void Promise.all([currentAccount(),api<{profile:typeof profile}>("/user/profile")]).then(([user,data])=>{if(user.role!=="user")throw Error("หน้านี้สำหรับสมาชิกผู้ใช้งาน");return data}).then(data=>{if(active){setProfile(data.profile);setReady(true)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <PortalShell role="User" page="user-profile" go={go}><h1>{uiText("ข้อมูลบัญชี")}</h1>{error&&<p role="alert">{uiText(error)}</p>}{notice&&<p role="status">{uiText(notice)}</p>}{loading?<p role="status">{uiText("กำลังโหลดข้อมูล…")}</p>:!ready?<button className="primary-button" onClick={()=>go("login")}>{uiText("เข้าสู่ระบบ")}</button>:<form className="portal-form merchant-panel" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");setNotice("");try{await currentAccount();const phone=profile.phone.trim()?normalizeProfileOtpPhone(profile.phone):"";if(phone===null)throw Error("เบอร์โทรไม่ถูกต้อง เช่น 0812345678 หรือ +66812345678");const saved=await api<{profile:typeof profile}>("/user/profile",{name:profile.name,phone,address:profile.address});setProfile(saved.profile);setPhoneRevision(n=>n+1);setNotice("บันทึกข้อมูลบัญชีแล้ว")}catch(e){if(e instanceof ApiError&&e.status===401){setReady(false);setProfile({name:"",email:"",phone:"",address:""});setError("การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง")}else setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ")}finally{setBusy(false)}}}>
 <label>{uiText("ชื่อ-นามสกุล")}<input required maxLength={200} value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>{uiText("อีเมล")}<input type="email" value={profile.email} readOnly/></label><label>{uiText("เบอร์โทร")}<input type="tel" maxLength={25} onBlur={()=>{const normalized=normalizeProfileOtpPhone(profile.phone);if(normalized)setProfile(v=>({...v,phone:normalized}));}} value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}/></label><label>{uiText("ที่อยู่")}<textarea maxLength={1000} value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/></label><button className="primary-button" disabled={busy} type="submit">{busy?uiText("กำลังบันทึก…"):uiText("บันทึกข้อมูล")}</button></form>}{ready&&<PhoneVerification refreshVersion={phoneRevision} onVerified={async()=>{const data=await api<{profile:typeof profile}>("/user/profile");setProfile(data.profile);}}/>}{ready&&<section className="merchant-panel"><h2>{uiText("ยืนยันอีเมลสำหรับเข้าสู่ระบบ")}</h2><p>{uiText("ยืนยันช่องทางเพิ่มเติมด้วย OTP เพื่อเข้าสู่บัญชีเดิมได้ทั้งอีเมลและเบอร์โทร")}</p><OtpLogin accountType="user" purpose="link_identity" fixedChannel="email" onAuthenticated={async()=>{const data=await api<{profile:typeof profile}>("/user/profile");setProfile(data.profile);setNotice("ยืนยันช่องทางเข้าสู่ระบบแล้ว");}}/></section>}{ready&&<><AccountSecurity onSignedOut={()=>go("login")}/><AccountPrivacy/></>}</PortalShell>
}
