import {getLocale,translateUi} from "./uiLanguage"
import type { Account } from "./merchantStore"
const adminPortal = () => typeof window !== "undefined" && (/^\/admin(?:\/|$)/.test(window.location.pathname)||window.location.pathname==="/owner/login"||window.location.pathname==="/owner")
const merchantPortal=()=>typeof window!=="undefined"&&(window.location.pathname==="/merchant"||/^owner-/.test(new URLSearchParams(window.location.hash.slice(1)).get("page")||"")&&!["owner-auth","owner-registration"].includes(new URLSearchParams(window.location.hash.slice(1)).get("page")||""));
const projectAccount=(account:Account,inMerchantPortal=merchantPortal()):Account=>{if(account.role==="admin"||!account.unifiedAuthEnabled&&!(account.primaryRole==="user"&&account.capabilities?.merchant))return account;const primary=account.primaryRole||account.role;return{...account,primaryRole:primary,role:inMerchantPortal&&account.capabilities?.merchant?"merchant":"user"};};
let csrf = ""
let sessionEpoch = 0
let accountRead: {path:string;epoch:number;promise:Promise<Account>} | null = null
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
type ApiOptions={signal?:AbortSignal;portal?:"admin"|"user"};
async function request<T>(path: string, data?: unknown, options?:ApiOptions): Promise<T> {
  const locale = getLocale()
  let response: Response
  const multipart = typeof FormData !== "undefined" && data instanceof FormData
  try {
    response = await fetch(`/api${path}`, {
      method: data === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: options?.signal,
      headers: { "Accept-Language": locale === "en" ? "en-GB" : "th-TH", ...{"X-VillaCheck-Portal":options?.portal||(adminPortal()?"admin":merchantPortal()?"merchant":"user")}, ...(data === undefined ? {} : { ...(!multipart ? { "Content-Type": "application/json" } : {}), "X-CSRF-Token": csrf }) },
      body: data === undefined ? undefined : multipart ? data as FormData : JSON.stringify(data),
    })
  } catch {
    throw new ApiError(503, translateUi("เชื่อมต่อ Backend ไม่สำเร็จ กรุณาตรวจสอบว่าเซิร์ฟเวอร์เปิดอยู่",locale))
  }
  const value = await response
    .json()
    .catch(() => {if(response.ok)throw new ApiError(502,translateUi("Backend ตอบกลับไม่สมบูรณ์ กรุณาลองใหม่",locale));return {error:translateUi("เชื่อมต่อ Backend ไม่สำเร็จ",locale)}})
  if (!response.ok) {
    const seconds=Number(value.retryAfter||response.headers.get("Retry-After"));
    const retryAfter=Number.isInteger(seconds)&&seconds>0&&seconds<=3600?seconds:undefined;
    const message=value.error||translateUi("ดำเนินการไม่สำเร็จ",locale);
    throw Object.assign(new ApiError(response.status,message+(response.status===429&&retryAfter?locale==="en"?` Try again in ${retryAfter} seconds.`:` ลองใหม่ใน ${retryAfter} วินาที`:"")),{code:value.code,retryAfter});
  }
  if (data !== undefined && (path.startsWith("/auth/") || path.startsWith("/otp/") || path==="/user/merchant-registration")) {
    sessionEpoch++
    try{localStorage.setItem("villacheck:auth-session-changed",String(Date.now()))}catch{/* No credentials or responses persisted. */}
    window.dispatchEvent(new Event("auth-session-changed"))
  }
  if(data!==undefined&&/^\/(?:villas(?:\/|$)|merchant\/(?:villas\/|property-media(?:\?|$)|ownership-documents(?:\?|$)|owner-verification(?:\?|$))|admin\/(?:property-media|ownership-documents|owner-verification)(?:\?|$))/.test(path)){
    invalidatePublicVillaReads()
    try{localStorage.setItem("villacheck:demo-villa-visibility-changed",String(Date.now()))}catch{/* Storage may be disabled. */}
    window.dispatchEvent(new Event("villacheck:demo-villa-visibility-changed"))
  }
  return value as T
}
// Share only simultaneous public reads. Settled responses are never cached.
const publicReads=new Map<string,Promise<unknown>>();
let configCache:{value:unknown;epoch:number;expiresAt:number}|null=null;
export function invalidatePublicVillaReads(){for(const path of publicReads.keys())if(/^\/public\/(?:villas|advertisements)(?:\?|$)/.test(path))publicReads.delete(path);}
export function api<T>(path:string,data?:unknown,options?:ApiOptions):Promise<T>{
  if(data!==undefined && (/^\/(?:auth|otp)\//.test(path)||path==="/user/merchant-registration"))sessionEpoch++;
  if(data!==undefined){configCache=null;publicReads.delete("/config");}
  if(path==="/config"&&data===undefined&&configCache?.epoch===sessionEpoch&&configCache.expiresAt>Date.now())return Promise.resolve(configCache.value as T);
  if(options?.signal)return request<T>(path,data,options);
  if(data!==undefined || !(/^\/public\/(?:cms|villas|advertisements)(?:\?|$)/.test(path) || path==="/config"))return request<T>(path,data);
  const epoch=sessionEpoch;
  const existing=publicReads.get(path);if(existing)return existing as Promise<T>;
  const pending=request<T>(path).then(value=>{if(path==="/config"&&epoch===sessionEpoch)configCache={value,epoch,expiresAt:Date.now()+5000};if(publicReads.get(path)===pending)publicReads.delete(path);return value;},error=>{if(publicReads.get(path)===pending)publicReads.delete(path);throw error;});
  publicReads.set(path,pending);return pending;
}
export async function currentAccount() {
  const path=adminPortal()?"/auth/admin-me":"/auth/me",epoch=sessionEpoch,inMerchantPortal=merchantPortal()
  if(accountRead?.path===path&&accountRead.epoch===epoch)return projectAccount(await accountRead.promise,inMerchantPortal)
  const promise=api<{user:Account;csrf:string}>(path).then(session=>{
    if(epoch!==sessionEpoch)throw new ApiError(409,translateUi("บัญชีเข้าสู่ระบบเปลี่ยนแล้ว กรุณาโหลดข้อมูลอีกครั้ง",getLocale()))
    csrf=session.csrf
    return session.user
  }).finally(()=>{if(accountRead?.promise===promise)accountRead=null})
  accountRead={path,epoch,promise}
  return projectAccount(await promise,inMerchantPortal)
}
export async function authenticate(email: string,password: string) {
 const session=await api<{user:Account;csrf:string}>("/auth/login",{email,password})
 csrf=session.csrf
 return session.user
}
export async function authenticateAdmin(email:string,password:string) {
  const session=await api<{user:Account;csrf:string}>("/auth/admin-login",{email,password});
  csrf=session.csrf;return session.user;
}
export async function logout() {
  await currentAccount()
  await api(adminPortal() ? "/auth/admin-logout" : "/auth/logout", {})
  csrf = ""
}

// End only the selected existing portal session; do not revoke other sessions.
export async function logoutWorkspace(portal:"admin"|"user"){
 const identity=await request<{csrf:string}>(portal==="admin"?"/auth/admin-me":"/auth/me",undefined,{portal});
 csrf=identity.csrf;await request(portal==="admin"?"/auth/admin-logout":"/auth/logout",{},{portal});csrf="";
}
