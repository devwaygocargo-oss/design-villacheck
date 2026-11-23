import {uiText} from "./uiLanguage";
import {useEffect,useState} from 'react'
import {api,currentAccount} from './api'

export default function AccountSecurity({onSignedOut}:{onSignedOut:()=>void}){
 const [available,setAvailable]=useState(false),[currentPassword,setCurrent]=useState(''),[newPassword,setNew]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let active=true;void api<{currentPhaseFeaturesEnabled?:boolean;releaseMode?:string}>('/config').then(c=>{if(active)setAvailable(c.currentPhaseFeaturesEnabled===true||!['PRELAUNCH','PHASE1','MEMBER_PREVIEW','STAGING_INTERACTIVE'].includes(c.releaseMode||''))}).catch(()=>{});return()=>{active=false}},[])
 if(!available)return null
 async function submit(action:'password'|'logout-all'){
  if(busy)return
  setError('')
  if(action==='password'&&newPassword!==confirm){setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');return}
  setBusy(true)
  try{await currentAccount();await api('/auth/'+action,{currentPassword,...(action==='password'?{newPassword}:{})});setCurrent('');setNew('');setConfirm('');onSignedOut()}
  catch(e){setError(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ')}
  finally{setBusy(false)}
 }
 return <section className="merchant-panel" aria-label={uiText("ความปลอดภัยบัญชี")}><h2>{uiText("ความปลอดภัยบัญชี")}</h2><p>{uiText("ยืนยันรหัสผ่านปัจจุบันก่อนดำเนินการ เมื่อสำเร็จอุปกรณ์ทุกเครื่องจะต้องเข้าสู่ระบบใหม่")}</p>{error&&<p role="alert">{uiText(error)}</p>}<form className="portal-form" onSubmit={e=>{e.preventDefault();void submit('password')}}>
 <label>{uiText("รหัสผ่านปัจจุบัน")}<input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label>
 <label>{uiText("รหัสผ่านใหม่")}<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={newPassword} onChange={e=>setNew(e.target.value)}/></label>
 <label>{uiText("ยืนยันรหัสผ่านใหม่")}<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
 <button className="primary-button" disabled={busy}>{uiText("เปลี่ยนรหัสผ่านและออกจากทุกอุปกรณ์")}</button><button type="button" className="outline-button" disabled={busy||!currentPassword} onClick={()=>void submit('logout-all')}>{uiText("ออกจากระบบทุกอุปกรณ์")}</button>
 </form></section>
}
