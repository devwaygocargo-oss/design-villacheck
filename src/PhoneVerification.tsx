import {useCallback,useEffect,useState} from "react";
import {api,currentAccount} from "./api";
import {uiText} from "./uiLanguage";
import useOAuthNavigation from "./useOAuthNavigation";
import OtpLogin from "./OtpLogin";

type PhoneStatus={profilePhone:string;loginPhone:string;status:"VERIFIED"|"PENDING"|"NOT_SET";primaryRole:"user"|"merchant"};
type Props={refreshVersion?:number;onVerified:()=>void|Promise<void>};
export default function PhoneVerification({refreshVersion=0,onVerified}:Props){
 const [info,setInfo]=useState<PhoneStatus|null>(null),[sms,setSms]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[password,setPassword]=useState(""),[providers,setProviders]=useState<string[]>([]),[proofReady,setProofReady]=useState(false);
 const {busy:opening,error:navigationError,start}=useOAuthNavigation();
 const load=useCallback(async()=>{
  const [status,config]=await Promise.all([api<PhoneStatus>("/auth/otp/status?profile=true"),api<{otp:{sms:boolean};oauth:Record<string,boolean>}>("/config")]);
  setInfo(status);setSms(config.otp.sms);
  const oauth=await api<{providers:string[];providerVerificationPurpose:string|null}>("/auth/oauth/status");setProviders(oauth.providers.filter(p=>config.oauth[p]));setProofReady(oauth.providerVerificationPurpose==="phone-change");
 },[]);
 useEffect(()=>{let active=true;void load().catch(e=>{if(active)setError(e instanceof Error?e.message:"โหลดข้อมูลเบอร์โทรไม่สำเร็จ")});return()=>{active=false};},[load,refreshVersion]);
 const reauthenticate=(provider:string)=>{setPassword("");void start(async signal=>{await currentAccount();const result=await api<{authorizeUrl:string}>("/auth/oauth/"+provider+"/reauth",{purpose:"phone-change"},{signal});return result.authorizeUrl;});};
 return <section className="merchant-panel phone-verification" aria-label={uiText("เบอร์โทรและการยืนยัน SMS")}><h2>{uiText("เบอร์โทรและการยืนยัน SMS")}</h2>{(error||navigationError)&&<p role="alert">{uiText(error||navigationError)}</p>}{message&&<p role="status">{uiText(message)}</p>}{!info?<p role="status">{uiText("กำลังโหลดข้อมูล…")}</p>:<>
 <p role="status" data-phone-status={info.status}>{uiText(info.status==="VERIFIED"?"ยืนยันเบอร์โทรแล้ว":info.status==="PENDING"?"บันทึกเบอร์แล้ว — ยังไม่ยืนยันด้วย OTP":"ยังไม่มีเบอร์โทรที่บันทึกไว้")}</p>
 <p>{uiText("เบอร์สำหรับเข้าสู่ระบบที่ยืนยันแล้ว")}: <strong>{info.loginPhone||uiText("ยังไม่ได้เชื่อม")}</strong></p>
 <p>{uiText("บันทึกเบอร์ติดต่อไม่เท่ากับยืนยันเจ้าของเบอร์ ต้องยืนยัน SMS OTP จากบัญชีนี้ก่อนใช้เบอร์ใหม่เข้าสู่ระบบ")}</p>
 {!sms&&<p role="status" className="login-otp-note">{uiText("SMS OTP ยังไม่เปิดใช้งาน เบอร์ที่บันทึกจะคงรอยืนยันและจะไม่ส่งข้อความ")}</p>}
 {info.loginPhone&&<div className="portal-form phone-change-proof"><p>{uiText("เมื่อเปลี่ยนเบอร์ที่ยืนยันแล้ว ให้ยืนยันรหัสผ่านปัจจุบันหรือบัญชี Google/LINE ที่เชื่อมไว้ก่อน")}</p><label>{uiText("รหัสผ่านปัจจุบัน")}<input type="password" autoComplete="current-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={opening||!sms}/></label>{providers.map(provider=><button type="button" className="outline-button" key={provider} disabled={opening||!sms} onClick={()=>reauthenticate(provider)}>{uiText("ยืนยันบัญชีเพื่อเปลี่ยนเบอร์")} · {provider==="google"?"Google":"LINE"}</button>)}{proofReady&&<p role="status">{uiText("ยืนยันบัญชีแล้ว ใช้เปลี่ยนเบอร์ได้หนึ่งครั้งภายใน 5 นาที")}</p>}</div>}
 <OtpLogin key={info.profilePhone+"|"+info.loginPhone} accountType={info.primaryRole} purpose="link_identity" fixedChannel="sms" initialDestination={info.profilePhone||info.loginPhone} phoneChangePassword={password} onRequestAccepted={()=>{setPassword("");setProofReady(false);}} onAuthenticated={async()=>{setPassword("");await load();await onVerified();setMessage("ยืนยันและบันทึกเบอร์สำหรับเข้าสู่ระบบแล้ว");}}/>
 <p>{uiText("เมื่อยืนยันเบอร์ใหม่สำเร็จ เบอร์เดิมจะไม่ใช้เข้าสู่บัญชีนี้ และอุปกรณ์อื่นต้องเข้าสู่ระบบใหม่")}</p>
 </>}</section>;
}
