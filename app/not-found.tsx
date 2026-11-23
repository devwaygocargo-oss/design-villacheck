"use client";
import LanguageSwitcher,{usePublicLanguage} from "../src/publicLanguage";
export default function NotFound(){
 const {locale}=usePublicLanguage(),en=locale==="en";
 return <main className="auth-page"><section className="auth-card"><LanguageSwitcher/><p>404</p><h1>{en?"Page not found":"ไม่พบหน้าที่ต้องการ"}</h1><p>{en?"Check the address or return to the VillaCheck homepage.":"กรุณาตรวจสอบที่อยู่เว็บไซต์ หรือกลับสู่หน้าหลัก VillaCheck"}</p><a className="primary-button" href="/">{en?"Back to home":"กลับหน้าหลัก"}</a></section></main>;
}
