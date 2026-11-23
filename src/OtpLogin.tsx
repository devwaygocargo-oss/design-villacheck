import {normalizeProfileOtpPhone} from "../server/phone-number.mjs";
import {uiText,localeTag,getLocale} from "./uiLanguage";
import {useEffect,useState} from "react";
import {api,ApiError,currentAccount} from "./api";
import type {Account} from "./merchantStore";

type Props={onAuthenticated:(account:Account)=>void|Promise<void>;onBusyChange?:(busy:boolean)=>void;onRegister?:(destination?:string)=>void;accountType?:"user"|"merchant"|"auto";purpose?:"login"|"register"|"link_identity";registration?:{name:string;businessNameEn:string};initialDestination?:string;fixedChannel?:"email"|"sms";phoneChangePassword?:string;onRequestAccepted?:()=>void};
export default function OtpLogin({onAuthenticated,onBusyChange,onRegister,accountType="user",purpose="login",registration,initialDestination="",fixedChannel,phoneChangePassword,onRequestAccepted}:Props){
 const [delivery,setDelivery]=useState("PENDING"),[unified,setUnified]=useState(false),[choice,setChoice]=useState<"user"|"merchant"|null>(null);
 const [destination,setDestination]=useState(initialDestination),[code,setCode]=useState(""),[challenge,setChallenge]=useState(""),[expires,setExpires]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [retryAt,setRetryAt]=useState(0),[seconds,setSeconds]=useState(0),[expired,setExpired]=useState(false),[ready,setReady]=useState(false),[channels,setChannels]=useState({email:false,sms:false});
 const merchantNotice=getLocale()==="th"?"หากยังไม่มีบัญชีผู้ประกอบการ กรุณาสมัคร Merchant ก่อนเข้าสู่ระบบ หากบัญชีที่สมัครแล้วผูกกับช่องทางนี้ ระบบจะส่ง OTP ให้":uiText("merchant.otp.notice");
 const merchantLogin=accountType==="merchant"&&purpose==="login";
 const emailOnly=fixedChannel?fixedChannel==="email":ready&&channels.email&&!channels.sms,smsOnly=fixedChannel?fixedChannel==="sms":ready&&channels.sms&&!channels.email;
 const channel=fixedChannel|| (emailOnly?"email":smsOnly?"sms":destination.includes("@")?"email":"sms");
 const changeBusy=(value:boolean)=>{setBusy(value);onBusyChange?.(value);};
 useEffect(()=>{let active=true;void api<{otp?:typeof channels;unifiedAuthEnabled?:boolean}>("/config").then(v=>{if(active){setChannels(v.otp||{email:false,sms:false});setUnified(v.unifiedAuthEnabled===true);}}).catch(()=>{if(active)setError("otp.availabilityFailed");}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
 useEffect(()=>{const tick=()=>{setSeconds(Math.max(0,Math.ceil((retryAt-Date.now())/1000)));setExpired(Boolean(expires)&&Date.parse(expires)<=Date.now());};tick();const timer=window.setInterval(tick,1000);return()=>clearInterval(timer);},[retryAt,expires]);
 useEffect(()=>{if(!challenge||!unified)return;let active=true;const poll=()=>{void api<{state:string}>("/auth/otp/status?challengeId="+encodeURIComponent(challenge)).then(v=>{if(active)setDelivery(v.state);}).catch(()=>{if(active)setDelivery("UNAVAILABLE");});};poll();const timer=window.setInterval(poll,1500);return()=>{active=false;clearInterval(timer);};},[challenge,unified]);
 const showFailure=(failure:unknown,verifying=false)=>{
  if(failure instanceof ApiError&&failure.status===429){const retry=Number((failure as ApiError&{retryAfter?:number}).retryAfter)||60;setRetryAt(Date.now()+Math.min(86400,Math.max(1,retry))*1000);setError("otp.tooMany");}
  else if(!verifying&&failure instanceof ApiError&&failure.status===409){if((failure as ApiError&{code?:string}).code==="ACCOUNT_CHOICE_REQUIRED"){setError(failure.message);setChoice("user");return;}setError(purpose==="link_identity"||accountType==="user"?"ช่องทางนี้ผูกกับบัญชีอื่นแล้ว กรุณาใช้ช่องทางอื่น":"merchant.registration.duplicate");}
  else if(failure instanceof ApiError&&["PHONE_REAUTH_REQUIRED","OTP_SMS_SCOPE_UNAVAILABLE"].includes((failure as ApiError&{code?:string}).code||""))setError(failure.message);
  else if(failure instanceof ApiError&&failure.status===400)setError("otp.invalidDestination");
  else if(verifying&&failure instanceof ApiError&&[401,409].includes(failure.status))setError("OTP ไม่ถูกต้องหรือหมดอายุ");
  else setError("otp.tryLater");
 };
 const request=async()=>{
  if(busy||seconds>0)return;changeBusy(true);setError("");
  try{if(purpose==="link_identity")await currentAccount();const primary=purpose==="link_identity"?await currentAccount():null;if(channel==="sms"&&!normalizeProfileOtpPhone(destination)){setError("เบอร์โทรไม่ถูกต้อง เช่น 0812345678 หรือ +66812345678");return;}const result=await api<{challengeId?:string;expiresAt?:string;resendAfter?:number;registrationRequired?:boolean}>("/auth/otp/request",{channel,destination:destination.trim(),accountType:primary?(primary.primaryRole||primary.role):choice||(unified&&purpose==="login"?"auto":accountType),purpose,...(purpose==="link_identity"&&channel==="sms"&&phoneChangePassword?{currentPassword:phoneChangePassword}:{}),...(registration?{registration}:{})});if(merchantLogin&&result.registrationRequired){if(onRegister)onRegister(destination.trim());else setError("merchant.registration.required");return;}if(!result.challengeId||!result.expiresAt)throw Error("Invalid OTP response");onRequestAccepted?.();setDelivery("PENDING");setChallenge(result.challengeId);setExpires(result.expiresAt);setCode("");setRetryAt(Date.now()+(result.resendAfter||60)*1000);}
  catch(failure){showFailure(failure);}finally{changeBusy(false);}
 };
 const verify=async()=>{
  if(busy||expired||unified&&delivery!=="READY")return;changeBusy(true);setError("");
  try{if(purpose==="link_identity")await currentAccount();await api("/auth/otp/verify",{challengeId:challenge,code});await onAuthenticated(await currentAccount());if(purpose==="link_identity"){setChallenge("");setCode("");setDestination("");setExpires("");}}
  catch(failure){showFailure(failure,true);}finally{changeBusy(false);}
 };
 const reset=()=>{setChallenge("");setCode("");setError("");setExpires("");};
 return <div className="login-otp">
  {choice&&<label>{uiText("ประเภทบัญชีเดิม")}<select value={choice} onChange={e=>setChoice(e.target.value as "user"|"merchant")}><option value="user">User</option><option value="merchant">Merchant</option></select></label>}
  <form className="login-email-form" onSubmit={e=>{e.preventDefault();void(challenge?verify():request());}}>
   <label className="login-field login-otp-destination"><span>{uiText(emailOnly?"อีเมลรับ OTP":smsOnly?"เบอร์โทรศัพท์รับ OTP":"อีเมลหรือเบอร์โทรศัพท์")}</span><input aria-label={uiText(emailOnly?"อีเมลรับ OTP":smsOnly?"เบอร์โทรศัพท์รับ OTP":"อีเมลหรือเบอร์โทรศัพท์รับ OTP")} required type={emailOnly?"email":"text"} onInvalid={()=>setError(emailOnly?"กรุณากรอกอีเมลให้ถูกต้อง":"กรุณากรอกอีเมลหรือเบอร์โทรศัพท์")} autoComplete="username" autoCapitalize="none" spellCheck={false} readOnly={busy||Boolean(challenge)} value={destination} onBlur={()=>{if(channel==="sms"){const normalized=normalizeProfileOtpPhone(destination);if(normalized)setDestination(normalized);}}} onChange={e=>{setDestination(e.target.value);setError("");}} placeholder={uiText(emailOnly?"กรอกอีเมลของคุณ":smsOnly?"กรอกเบอร์โทรศัพท์ของคุณ":"กรอกอีเมลหรือเบอร์โทรศัพท์")}/></label>
   {!challenge&&<p className="login-otp-note">{merchantLogin?merchantNotice:uiText(purpose==="register"?"merchant.registration.verify":emailOnly?"กรอกอีเมล แล้วกดรับรหัส OTP เพื่อเข้าสู่ระบบ":smsOnly?"กรอกเบอร์ของคุณ แล้วกดรับรหัส SMS OTP เพื่อยืนยัน":"ระบบจะส่งรหัส OTP ไปยังอีเมลหรือเบอร์โทรศัพท์ที่คุณกรอก")}</p>}
   {challenge&&<><p className="login-otp-note" role="status">{expired?uiText("otp.expired"):unified&&delivery!=="READY"?(delivery==="PENDING"?uiText("กำลังส่งรหัสยืนยัน…"):uiText("ส่งรหัสไม่สำเร็จ กรุณาลองใหม่")):merchantLogin?merchantNotice:uiText("otp.sent").replace("{destination}",destination)}{!expired&&<>{" · "}{uiText("ใช้ได้ถึง ")}{new Date(expires).toLocaleTimeString(localeTag(),{hour:"2-digit",minute:"2-digit"})}</>}</p><label className="login-field"><span>OTP</span><input aria-label={uiText("รหัส OTP")} required inputMode="numeric" autoComplete="one-time-code" readOnly={busy||expired} pattern="[0-9]{6}" maxLength={6} placeholder={uiText("รหัส 6 หลัก")} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label></>}
   {error&&<p className="login-error" role="alert">{uiText(error)}</p>}
   {ready&&(Boolean(destination.trim())||Boolean(fixedChannel))&&!channels[channel]&&<p className="login-otp-note">{uiText(channel==="sms"?"otp.unavailable.sms":"otp.unavailable.email")}</p>}
   <button className="login-submit" disabled={busy||!ready||(!challenge&&(!channels[channel]||seconds>0))||Boolean(challenge&&(expired||unified&&delivery!=="READY"))}>{busy?uiText("กำลังดำเนินการ…"):challenge?uiText(purpose==="link_identity"?"ยืนยันช่องทางเข้าสู่ระบบ":purpose==="register"?"ยืนยัน OTP และสร้างบัญชี":"ยืนยัน OTP และเข้าสู่ระบบ"):seconds?uiText("otp.retryIn").replace("{seconds}",String(seconds)):uiText("รับรหัส OTP")}</button>
   {challenge&&<div className="login-otp-actions"><button type="button" disabled={busy||seconds>0} onClick={()=>void request()}>{seconds?uiText("otp.resend").replace("{seconds}",String(seconds)):uiText("ส่ง OTP ใหม่")}</button><button type="button" disabled={busy} onClick={reset}>{uiText("เปลี่ยนอีเมลหรือเบอร์โทรศัพท์")}</button></div>}
  </form>
  {merchantLogin&&onRegister&&<button type="button" className="outline-button merchant-otp-register" disabled={busy} onClick={()=>onRegister()}>{getLocale()==="th"?"สมัคร Merchant ใหม่":uiText("สมัคร Merchant ใหม่")}</button>}
 </div>;
}
