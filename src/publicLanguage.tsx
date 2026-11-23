import {useUiLanguage,translateUi} from "./uiLanguage";
import type {Locale} from "./uiLanguage";
const pairs: [string, string][] = [
  ["ช่วยเหลือและติดต่อ", "Help and contact"], ["ศูนย์ช่วยเหลือ", "Help / Support"], ["ติดต่อเรา", "Contact"],
  ["อีเมลทีมงาน", "Email our team"], ["โทรทีมงาน", "Call our team"], ["สงวนลิขสิทธิ์", "All rights reserved."],
  ["นโยบายความเป็นส่วนตัว", "Privacy policy"], ["ข้อกำหนดและเงื่อนไข", "Terms and conditions"], ["มั่นใจก่อนโอน", "Trust before transfer."],
  ["เกี่ยวกับ VillaCheck", "About VillaCheck"], ["เกี่ยวกับเรา", "About us"], ["มาตรฐานการตรวจสอบ", "Verification standards"],
  ["บทความและข่าวสาร", "Articles and news"], ["เข้าสู่ระบบ", "Sign in"], ["สำหรับผู้ใช้งาน", "For guests"],
  ["ค้นหาที่พัก", "Find accommodation"], ["ตรวจสอบ QR", "Verify QR"], ["ตรวจสอบก่อนโอน", "Check before paying"], ["แจ้งปัญหา", "Report an issue"],
  ["สำหรับเจ้าของที่พัก", "For property owners"], ["ห้องสมาชิก", "Member Room"], ["ลงทะเบียนที่พัก", "Register a property"],
  ["บัญชี ผู้ดูแลระบบ", "Admin account"], ["บัญชี ผู้ประกอบการ", "Merchant account"], ["บัญชี ผู้ใช้งาน", "Guest account"],
  ["ความช่วยเหลือและการสนับสนุน", "HELP / SUPPORT"], ["ติดต่อ VillaCheck", "CONTACT VILLACHECK"],
  ["ค้นหาคำตอบและช่องทางรับความช่วยเหลือ", "Find answers and ways to get help"],
  ["ดูคำแนะนำเกี่ยวกับการค้นหาที่พัก การตรวจสอบก่อนโอน การสแกน QR การแจ้งปัญหา และการจัดการข้อมูลสำหรับเจ้าของที่พัก", "Get help finding accommodation, checking before paying, scanning QR codes, reporting issues and managing property information."],
  ["ทีมงานพร้อมช่วยเหลือในวันจันทร์–ศุกร์ เวลา 09:00–18:00 น.", "Our team is available Monday–Friday, 09:00–18:00 (Thailand time)."],
  ["ฝากข้อมูลให้ทีมงานติดต่อกลับ หรือส่งอีเมลผ่านช่องทางด้านล่าง", "Leave your details for a callback or email us using the channels below."],
  ["จันทร์–ศุกร์ 09:00–18:00 น.", "Monday–Friday, 09:00–18:00 (Thailand time)"],
  ["ให้ทีมงานติดต่อกลับ", "Request a callback"], ["ประเภท", "Contact type"], ["ลูกค้า / User", "Guest / User"], ["ผู้ประกอบการ", "Merchant"],
  ["ชื่อ", "Name"], ["อีเมล", "Email"], ["เบอร์โทร", "Phone"], ["ส่งข้อมูลติดต่อ", "Send contact details"],
  ["บันทึกข้อมูลให้ทีมงานติดต่อกลับแล้ว", "Your details have been sent. Our team will contact you."], ["ส่งไม่สำเร็จ", "Unable to send. Please try again."],
  ["ส่งอีเมล", "Send email"], ["ติดต่อทีมงาน", "Contact our team"], ["กลับหน้าหลัก", "Back to home"],
];
const legacy: Record<string, string> = { "Merchant": "ผู้ประกอบการ", "ผู้ประกอบการ / Merchant": "ผู้ประกอบการ", "Help / Support": "ศูนย์ช่วยเหลือ", "HELP / SUPPORT": "ความช่วยเหลือและการสนับสนุน", "Contact": "ติดต่อเรา", "CONTACT VILLACHECK": "ติดต่อ VillaCheck", "Trust before transfer.": "มั่นใจก่อนโอน", "Member Room": "ห้องสมาชิก" };
export function translatePublic(value: string, locale: Locale) {
  const thai = legacy[value] || value;
  return locale === "en" ? pairs.find(([th]) => th === thai)?.[1] || translateUi(value,locale) : translateUi(thai,locale);
}
export function usePublicLanguage() {
  const {locale}=useUiLanguage();
  return { locale, text: (value: string) => translatePublic(value, locale) };
}
function Flag({locale}:{locale:Locale}) {
 return locale==="th"?<svg className="language-flag" aria-hidden="true" viewBox="0 0 30 20"><path fill="#a51931" d="M0 0h30v20H0z"/><path fill="#fff" d="M0 3.3h30v13.4H0z"/><path fill="#2d2a4a" d="M0 6.7h30v6.6H0z"/></svg>:<svg className="language-flag" aria-hidden="true" viewBox="0 0 60 40"><path fill="#012169" d="M0 0h60v40H0z"/><path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40"/><path stroke="#c8102e" strokeWidth="3" d="m0 0 60 40M60 0 0 40"/><path stroke="#fff" strokeWidth="13" d="M30 0v40M0 20h60"/><path stroke="#c8102e" strokeWidth="7" d="M30 0v40M0 20h60"/></svg>;
}

export default function LanguageSwitcher() {
  const {locale,setLocale}=useUiLanguage();
  return <div className="language-switcher" role="group" aria-label={locale === "th" ? "เลือกภาษา" : "Choose language"}>{(["th", "en"] as const).map(lang => <button key={lang} type="button" lang={lang} aria-label={locale==="th"?(lang==="th"?"ภาษาไทย":"ภาษาอังกฤษ"):(lang==="th"?"Thai":"English")} aria-pressed={locale === lang} onClick={() => setLocale(lang)}><Flag locale={lang}/><span>{lang === "th" ? "ไทย" : "EN"}</span></button>)}</div>;
}
