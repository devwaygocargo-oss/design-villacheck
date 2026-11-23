import {uiText} from "./uiLanguage";
import LanguageSwitcher from "./publicLanguage";
import HomeLogoLink from "./HomeLogoLink";
import { useState } from "react";
import { authenticateAdmin, logout } from "./api";
import type { Page } from "./prototype";

export default function AdminLogin({go,owner=false}:{go:(page:Page)=>void;owner?:boolean}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  return <main className="login-screen"><div className="login-sheet">
    <HomeLogoLink className="login-brand" onNavigate={()=>go("home")}><strong>{owner?"VillaCheck Business Owner":"VillaCheck CMS"}</strong></HomeLogoLink>
    <LanguageSwitcher/><h1 className="login-title">{owner?"เข้าสู่ระบบ Business Owner":uiText("เข้าสู่ระบบ Admin")}</h1>
    <p className="login-account-note">{owner?"ใช้บัญชีผู้ดูแลเดิมของบริษัท สิทธิ์ Business Owner ต้องได้รับอนุมัติแยกต่างหาก":uiText("สำหรับผู้ดูแลระบบ VillaCheck")}</p>
    <form className="login-email-form" onSubmit={async event=>{
      event.preventDefault();if(busy)return;setBusy(true);setError("");
      try {
        const account=await authenticateAdmin(email,password);
        if(account.role!=="admin"){await logout();setError("บัญชีนี้ไม่มีสิทธิ์ Admin");return;}
        if(owner)window.location.assign("/owner?context=admin");else go("admin-dashboard");
      }catch(e){setError(e instanceof Error?e.message:"เข้าสู่ระบบไม่สำเร็จ");}
      finally{setBusy(false);}
    }}>
      <label className="login-field"><span>{uiText("อีเมล Admin")}</span><input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label className="login-field"><span>{uiText("รหัสผ่าน")}</span><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {error&&<p role="alert" className="login-error">{uiText(error)}</p>}
      <button type="submit" disabled={busy} className="login-submit">{busy?uiText("กำลังเข้าสู่ระบบ…"):owner?"เข้าสู่ระบบ Business Owner":uiText("เข้าสู่ระบบ Admin")}</button>
    </form>
    <a href="/admin/password/request">Set or recover password / ตั้งหรือกู้รหัสผ่าน</a>
    <p><a href={owner?"/admin/login":"/owner/login"}>{owner?"เข้าสู่ระบบผู้ดูแล / Admin":"เข้าสู่ระบบ Business Owner"}</a></p>
  </div></main>;
}
