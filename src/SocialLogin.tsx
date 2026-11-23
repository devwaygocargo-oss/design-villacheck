import useOAuthNavigation from "./useOAuthNavigation";
import {uiText} from "./uiLanguage";
import {useEffect,useState} from "react";
import {api,currentAccount} from "./api";
import {packageIntentKey} from "./packagePlans";
import AuthProviderIcon,{type AuthProvider} from "./AuthProviderIcon";
import {oauthErrors} from "./authMessages";

export default function SocialLogin({reference="",variant="default",accountType="user",linking=false}:{reference?:string;variant?:"default"|"stacked";accountType?:"user"|"merchant";linking?:boolean}) {
 const [providers,setProviders]=useState({google:false,facebook:false,line:false}),[oauthStatus,setOauthStatus]=useState<Record<string,string>>({}),[configError,setConfigError]=useState("");
 const [publicRegistration,setPublicRegistration]=useState(false),[publicMerchantRegistration,setPublicMerchantRegistration]=useState(false);
 const [existingOnly,setExistingOnly]=useState(false),[linkedProviders,setLinkedProviders]=useState<string[]>([]),[providerVerified,setProviderVerified]=useState(false);
 const [pendingProvider,setPendingProvider]=useState<AuthProvider|null>(null),[currentPassword,setCurrentPassword]=useState("");
 const {busy,error:connectionError,start}=useOAuthNavigation();
 const callbackError=new URLSearchParams(window.location.hash.slice(1)).get("oauth_error");
 const error=connectionError||configError||(linking&&callbackError?(oauthErrors[callbackError]||"OAuth ไม่สำเร็จ"):"");
 useEffect(()=>{let active=true;
  void api<{oauth:typeof providers;oauthExistingAccountsOnly?:boolean;oauthPublicUserRegistration?:boolean;oauthPublicMerchantRegistration?:boolean;oauthStatus?:Record<string,string>}>("/config").then(v=>{if(active){setProviders(v.oauth);setExistingOnly(v.oauthExistingAccountsOnly===true);setPublicRegistration(v.oauthPublicUserRegistration===true);setPublicMerchantRegistration(v.oauthPublicMerchantRegistration===true);setOauthStatus(v.oauthStatus||{});}}).catch(()=>{if(active)setConfigError("ตรวจช่องทางเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");});
  if(linking)void api<{providers:string[];providerVerificationReady:boolean}>("/auth/oauth/status").then(v=>{if(active){setLinkedProviders(v.providers);setProviderVerified(v.providerVerificationReady);}}).catch(()=>{if(active)setConfigError("ตรวจช่องทางยืนยันบัญชีไม่สำเร็จ กรุณาโหลดหน้าใหม่");});
  return()=>{active=false;};
 },[linking]);
 const returnTo=accountType==="merchant"?sessionStorage.getItem("villacheck-merchant-return")==="owner-package"?"#page=owner-package":sessionStorage.getItem(packageIntentKey)?"#page=owner-information":"#page=owner-dashboard":reference?`#${new URLSearchParams({page:"verify",item:reference})}`:"#page=user-dashboard";
 const connect=(provider:AuthProvider,confirmed=false)=>{
  if(busy||!providers[provider])return;
  if(linking&&!providerVerified&&!confirmed){setPendingProvider(provider);setCurrentPassword("");setConfigError("");return;}
  const password=currentPassword;
  setConfigError("");setCurrentPassword("");
  void start(async signal=>{
   if(linking){await currentAccount();if(signal.aborted)throw new DOMException("Cancelled","AbortError");
    try{const result=await api<{authorizeUrl:string}>(`/auth/oauth/${provider}/link`,providerVerified?{}:{currentPassword:password},{signal});setPendingProvider(null);return result.authorizeUrl;}
    finally{setProviderVerified(false);}
   }
   return `/api/auth/oauth/${provider}/start?${new URLSearchParams({returnTo})}`;
  });
 };
 const verifyProvider=(provider:"google"|"line")=>{
  if(busy)return;setCurrentPassword("");setConfigError("");setPendingProvider(null);
  void start(async signal=>{await currentAccount();if(signal.aborted)throw new DOMException("Cancelled","AbortError");const result=await api<{authorizeUrl:string}>(`/auth/oauth/${provider}/reauth`,{},{signal});return result.authorizeUrl;});
 };
 return <div aria-busy={busy} className={`social-login ${variant==="stacked"?"login-social-stack":""}`}>
 {variant!=="stacked"&&<span>{linking?uiText("เชื่อมบัญชีเข้าสู่ระบบ"):existingOnly&&!(accountType==="user"?publicRegistration:publicMerchantRegistration)?uiText("เข้าสู่ระบบบัญชีที่เชื่อมแล้วด้วย"):uiText(`เข้าสู่ระบบ / สมัคร ${accountType==="merchant"?"Merchant":"User"} ด้วย`)}</span>}
 {linking&&linkedProviders.some(p=>(p==="google"||p==="line")&&providers[p])&&<section aria-label={uiText("ยืนยันด้วยบัญชีที่เชื่อมไว้")}><p>{uiText("หากยังไม่เคยตั้งรหัสผ่าน ให้ยืนยันด้วยบัญชีเดิมก่อน แล้วเลือกช่องทางที่ต้องการเชื่อมเพิ่ม")}</p><div>{(["google","line"] as const).filter(p=>linkedProviders.includes(p)&&providers[p]).map(p=><button type="button" key={p} disabled={busy} onClick={()=>verifyProvider(p)}>{uiText("ยืนยันบัญชีเดิมด้วย ")}{p==="google"?"Google":"LINE"}</button>)}</div></section>}
 {linking&&providerVerified&&<p role="status">{uiText("ยืนยันบัญชีเดิมแล้ว เลือกช่องทางที่ต้องการเชื่อมภายใน 5 นาที ใช้การยืนยันได้หนึ่งครั้ง")}</p>}
 <div>{(["facebook","google","line"] as const).map(provider=><button type="button" key={provider} disabled={busy||!providers[provider]} title={providers[provider]?undefined:provider==="facebook"&&oauthStatus.facebook==="pending_approval"?uiText("Facebook ยังรออนุมัติจาก Meta"):uiText("ยังไม่ได้เปิดใช้งานบัญชีผู้ให้บริการ OAuth")} className={`oauth-button ${provider}`} onClick={()=>connect(provider)}><span className="auth-provider-icon"><AuthProviderIcon provider={provider}/></span><span>{linking?uiText("เชื่อมบัญชี "):variant==="stacked"?uiText("ดำเนินการต่อด้วย "):""}{provider==="google"?"Google":provider==="facebook"?"Facebook":"LINE"}</span></button>)}</div>
 <p className="line-login-notice">{uiText("VillaCheck ขอชื่อและอีเมลจากผู้ให้บริการเพื่อ")}{linking?uiText("เชื่อมช่องทางเข้าสู่ระบบกับบัญชีนี้"):existingOnly&&!(accountType==="user"?publicRegistration:publicMerchantRegistration)?uiText("เข้าบัญชีที่เชื่อมไว้เท่านั้น ยังไม่เปิดสมัครบัญชีสาธารณะ"):accountType==="user"&&publicRegistration?uiText("สร้างบัญชีผู้ใช้ใหม่หรือเข้าสู่ระบบด้วย Google หรือ LINE หลังจากคุณอนุญาต หากมีอีเมลนี้ในระบบแล้ว กรุณาเข้าสู่ระบบด้วยช่องทางเดิมเพื่อเชื่อมบัญชี"):uiText(`สร้างบัญชี ${accountType==="merchant"?"Merchant":"User"} และระบุบัญชีเมื่อเข้าสู่ระบบ`)}</p>
 {pendingProvider&&!providerVerified&&<form className="portal-form oauth-link-confirmation" aria-label={uiText("ยืนยันตัวตนเพื่อเชื่อมบัญชี")} onSubmit={e=>{e.preventDefault();connect(pendingProvider,true);}}><label>{uiText("รหัสผ่านปัจจุบัน")}<input type="password" required autoComplete="current-password" maxLength={128} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><button type="submit" disabled={busy||!currentPassword}>{uiText("ยืนยันด้วยรหัสผ่านและเชื่อมบัญชี")}</button><button type="button" disabled={busy} onClick={()=>{setPendingProvider(null);setCurrentPassword("");}}>{uiText("ยกเลิก")}</button></form>}
 {busy&&<p role="status">{uiText("กำลังเปิดหน้าล็อกอิน…")}</p>}
 {error&&<p role="alert">{uiText(error)}</p>}{(!providers.google||!providers.facebook||!providers.line)&&<small>{uiText("ช่องทางที่ยังไม่ได้เชื่อมต่อจะแสดงเป็นปุ่มปิดใช้งาน")}</small>}
 </div>;
}
