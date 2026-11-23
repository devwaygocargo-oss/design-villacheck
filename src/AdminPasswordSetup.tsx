"use client";
import {adminPasswordSetupLifetimeText} from "../server/admin-password-terms.mjs";
import {useEffect,useRef,useState} from "react";
const copy={
 missing:"Missing or invalid setup link. Request a new link. / ลิงก์ตั้งรหัสผ่านไม่ครบหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่",
 weak:"Use 12–128 characters with uppercase, lowercase, number and symbol. / ใช้รหัสผ่าน 12–128 ตัวอักษร มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และสัญลักษณ์",
 confirmation:"Confirm your new password. / กรุณากรอกยืนยันรหัสผ่านใหม่",
 mismatch:"Passwords do not match. / รหัสผ่านทั้งสองช่องไม่ตรงกัน",
 email:"Enter a valid Admin email. / กรุณากรอกอีเมล Admin ให้ถูกต้อง",
 invalid:"This link is invalid, expired, used or revoked. Request a new link. / ลิงก์ไม่ถูกต้อง หมดอายุ ใช้แล้ว หรือถูกยกเลิก กรุณาขอลิงก์ใหม่",
 loading:"Saving, please wait… / กำลังดำเนินการ กรุณารอสักครู่…",
 success:"Password saved. Sign in to the Admin Dashboard. / ตั้งรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ Admin Dashboard",
 sent:"If this email is eligible, a setup link will arrive. Check Inbox/Spam. / หากอีเมลนี้ได้รับอนุญาต ระบบจะส่งลิงก์ กรุณาตรวจ Inbox/Spam",
 limited:"Too many requests. Wait 15 minutes. / ทำรายการบ่อยเกินไป กรุณารอ 15 นาที",
 unavailable:"Service unavailable. Please retry later. / บริการยังไม่พร้อม กรุณาลองใหม่ภายหลัง",
 forbidden:"This request was not authorized. Reopen the verified Staging page. / คำขอนี้ไม่ได้รับอนุญาต กรุณาเปิดหน้า Staging ที่ถูกต้องใหม่",
 network:"Unable to confirm the result. Check your connection, then try signing in or request a new link. / ยังยืนยันผลไม่ได้ กรุณาตรวจการเชื่อมต่อ แล้วลองเข้าสู่ระบบหรือขอลิงก์ใหม่",
 timeout:"Request timed out; the result could not be confirmed. Try signing in or request a new link. / คำขอหมดเวลาและยังยืนยันผลไม่ได้ กรุณาลองเข้าสู่ระบบหรือขอลิงก์ใหม่",
 response:"Unexpected server response. Try signing in or request a new link. / ได้รับคำตอบจากเซิร์ฟเวอร์ไม่สมบูรณ์ กรุณาลองเข้าสู่ระบบหรือขอลิงก์ใหม่"
};
type Phase="initializing"|"idle"|"loading"|"error"|"success";
export default function AdminPasswordSetup({requestOnly=false}:{requestOnly?:boolean}){
 const token=useRef(""),pending=useRef(false),controller=useRef<AbortController|null>(null),version=useRef(0),feedback=useRef<HTMLParagraphElement>(null);
 const [phase,setPhase]=useState<Phase>(requestOnly?"idle":"initializing"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[confirmation,setConfirmation]=useState(""),[message,setMessage]=useState(""),[invalidField,setInvalidField]=useState(""),[environmentLabel,setEnvironmentLabel]=useState("VillaCheck");
 useEffect(()=>{setEnvironmentLabel(window.location.hostname==="design-villacheck.vercel.app"?"VillaCheck Staging":"VillaCheck");const read=()=>{if(requestOnly)return;const raw=new URLSearchParams(window.location.hash.slice(1)).get("token");if(raw!==null){version.current++;controller.current?.abort();pending.current=false;token.current=/^[A-Za-z0-9_-]{43}$/.test(raw)?raw:"";window.history.replaceState(null,"",window.location.pathname);setPassword("");setConfirmation("");}if(token.current){setPhase("idle");setMessage("");}else{setPhase("error");setMessage(copy.missing);}};read();window.addEventListener("hashchange",read);return()=>{window.removeEventListener("hashchange",read);version.current++;controller.current?.abort();};},[requestOnly]);
 useEffect(()=>{if(message){feedback.current?.focus({preventScroll:true});feedback.current?.scrollIntoView({block:"center"});}},[message]);
 const busy=phase==="loading",done=phase==="success";
 function showError(text:string,field=""){setPhase("error");setMessage(text);setInvalidField(field);feedback.current?.focus({preventScroll:true});feedback.current?.scrollIntoView({block:"center"});}
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(pending.current)return;setInvalidField("");
  if(requestOnly){if(email.trim().length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){showError(copy.email,"email");return;}}
  else{if(!token.current){showError(copy.missing);return;}if(password.length<12||password.length>128||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||! /[^a-zA-Z0-9\s]/.test(password)||Array.from(password).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)){showError(copy.weak,"password");return;}if(!confirmation){showError(copy.confirmation,"confirmation");return;}if(password!==confirmation){showError(copy.mismatch,"confirmation");return;}}
  pending.current=true;setPhase("loading");setMessage(copy.loading);const current=version.current,abort=new AbortController();controller.current=abort;let timedOut=false;const timer=window.setTimeout(()=>{timedOut=true;abort.abort();},20000);
  try{const response=await fetch(requestOnly?"/api/auth/admin-password/request":"/api/auth/admin-password/complete",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",signal:abort.signal,body:JSON.stringify(requestOnly?{email:email.trim()}:{token:token.current,newPassword:password})});const text=await response.text();if(current!==version.current)return;let result:{ok?:boolean;code?:string};try{result=JSON.parse(text);if(!result||typeof result!=="object"||Array.isArray(result))throw Error("Invalid response");}catch{showError(copy.response);return;}if(!response.ok){showError(result.code==="ADMIN_PASSWORD_WEAK"?copy.weak:result.code==="ADMIN_SETUP_TOKEN_INVALID"?copy.invalid:response.status===429?copy.limited:response.status===403||response.status===401?copy.forbidden:response.status===400?copy.invalid:copy.unavailable);return;}if(result?.ok!==true){showError(copy.response);return;}if(!requestOnly){token.current="";setPassword("");setConfirmation("");}setPhase("success");setMessage(requestOnly?copy.sent:copy.success);
  }catch{if(current===version.current)showError(timedOut?copy.timeout:copy.network);}finally{window.clearTimeout(timer);if(current===version.current){pending.current=false;controller.current=null;}}
 }
 return <main className="login-screen"><section className="login-sheet"><h1>{requestOnly?"Admin password recovery / ขอลิงก์ตั้งรหัสผ่าน":"Set Admin password / ตั้งรหัสผ่าน Admin"}</h1><p>{environmentLabel}</p><p>New setup links: {adminPasswordSetupLifetimeText}. / ลิงก์เดิมไม่ถูกต่ออายุ</p><p id="admin-password-feedback" ref={feedback} tabIndex={-1} role={phase==="error"?"alert":"status"} aria-live={phase==="error"?"assertive":"polite"} aria-atomic="true">{phase==="initializing"?"Checking setup link… / กำลังตรวจลิงก์…":message}</p>
 {!done&&<form noValidate aria-busy={busy} className="login-email-form" onSubmit={submit}>
 {requestOnly?<label className="login-field">Admin email / อีเมล Admin<input type="email" autoComplete="email" required maxLength={254} aria-invalid={invalidField==="email"} aria-describedby="admin-password-feedback" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>:<><p id="admin-password-help">{copy.weak}</p><label className="login-field">New password / รหัสผ่านใหม่<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={invalidField==="password"} aria-describedby="admin-password-help admin-password-feedback" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy||phase==="initializing"}/></label><label className="login-field">Confirm password / ยืนยันรหัสผ่าน<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={invalidField==="confirmation"} aria-describedby="admin-password-feedback" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy||phase==="initializing"}/></label></>}
 <button type="submit" className="login-submit" disabled={busy||phase==="initializing"}>{busy?"Please wait / กรุณารอ":requestOnly?"Send setup link / ส่งลิงก์":"Save password / บันทึกรหัสผ่าน"}</button></form>}
 <p><a href="/admin/login">Admin Login / เข้าสู่ระบบ Admin</a></p><p><a href="/admin/password/request">Request a new link / ขอลิงก์ใหม่</a></p></section></main>;
}
