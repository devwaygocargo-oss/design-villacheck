import {useState} from "react";
import {uiText} from "./uiLanguage";
import {usePublicLanguage} from "./publicLanguage";
import {translateMenu} from "./menuLanguage";
export const cmsSections=[
 {id:"home",label:"หน้าแรก",help:"แก้แบนเนอร์ ช่องค้นหา และส่วนต่าง ๆ ของหน้าแรก",group:"หน้าเว็บไซต์"},
 {id:"steps",label:"ตรวจสอบใน 3 ขั้นตอน",help:"แก้ข้อความและรูปของแต่ละขั้นตอน",group:"หน้าเว็บไซต์"},
 {id:"articles",label:"ข่าวสารและอัปเดต",help:"เพิ่มหรือแก้ข่าว รูปปก และรูปรายละเอียด",group:"หน้าเว็บไซต์"},
 {id:"pages",label:"หน้าเว็บ",help:"แก้เนื้อหาหน้าเกี่ยวกับเราและหน้าข้อมูล",group:"หน้าเว็บไซต์"},
 {id:"faqs",label:"FAQ",help:"จัดการคำถามและคำตอบที่พบบ่อย",group:"หน้าเว็บไซต์"},
 {id:"media",label:"คลังรูปภาพ",help:"ค้นหาและเลือกใช้รูปที่อัปโหลดไว้",group:"รูปและการแสดงผล"},
 {id:"advertising",label:"แบนเนอร์ / โฆษณา",help:"จัดการภาพแบนเนอร์และลำดับการแสดง",group:"รูปและการแสดงผล"},
 {id:"presentation",label:"เนื้อหาทั่วเว็บไซต์",help:"แก้ข้อความ ปุ่ม จังหวัด และ Footer",group:"รูปและการแสดงผล"},
 {id:"navigation",label:"เมนูเว็บไซต์",help:"จัดการชื่อเมนูและลิงก์นำทาง",group:"รูปและการแสดงผล"},
 {id:"site",label:"ตั้งค่าเว็บไซต์",help:"แก้ข้อมูลติดต่อ โลโก้ และข้อมูลเว็บไซต์",group:"ข้อมูลและประวัติ"},
 {id:"business",label:"กติกา / ข้อความอีเมล",help:"ตรวจและแก้ข้อความธุรกิจที่ระบบใช้งาน",group:"ข้อมูลและประวัติ"},
 {id:"data",label:"ข้อมูลที่พัก / แพ็กเกจ / บัญชี",help:"ไปยังหน้าจัดการข้อมูลธุรกิจตามสิทธิ์",group:"ข้อมูลและประวัติ"},
 {id:"history",label:"ประวัติ / ย้อนเวอร์ชัน",help:"ดูประวัติการแก้ไขและคืนร่างจากเวอร์ชันก่อน",group:"ข้อมูลและประวัติ"},
] as const;
export type CmsTab=typeof cmsSections[number]["id"];
export default function CmsNavigation({active,onSelect,coreSettingsAllowed=false}:{active:CmsTab;onSelect:(tab:CmsTab)=>void;coreSettingsAllowed?:boolean}){
 const {locale}=usePublicLanguage(),[query,setQuery]=useState("");
 const label=(text:string)=>translateMenu(text,locale);
 const available=cmsSections.filter(s=>coreSettingsAllowed||!["site","business"].includes(s.id));
 const matches=available.filter(section=>[section.label,section.help,label(section.label),uiText(section.help)].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <>
  <div className="cms-mobile-navigation"><label>{uiText("เลือกส่วนที่ต้องการแก้ไข")}<select className="cms-mobile-section-select" value={active} onChange={e=>onSelect(e.target.value as CmsTab)}>{[...new Set(available.map(s=>s.group))].map(group=><optgroup key={group} label={uiText(group)}>{available.filter(s=>s.group===group).map(s=><option key={s.id} value={s.id}>{label(s.label)}</option>)}</optgroup>)}</select></label><div className="cms-quick-actions">{available.filter(s=>["home","steps","articles","media"].includes(s.id)).map(s=><button type="button" key={s.id} aria-pressed={active===s.id} onClick={()=>onSelect(s.id)}>{label(s.label)}</button>)}</div></div>
  <aside className="cms-navigation"><label className="cms-section-search">{uiText("ค้นหาส่วนที่ต้องการแก้ไข")}<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={uiText("เช่น ข่าว รูป แบนเนอร์")}/></label><nav className="cms-tabs" aria-label={uiText("ส่วนจัดการ CMS")}>{[...new Set(available.map(s=>s.group))].map(group=>{const sections=matches.filter(s=>s.group===group);return sections.length?<div className="cms-nav-group" key={group}><h3>{uiText(group)}</h3>{sections.map(s=><button type="button" key={s.id} data-cms-tab={s.id} aria-current={active===s.id?"page":undefined} className={active===s.id?"active":""} onClick={()=>onSelect(s.id)}><span>{label(s.label)}</span><small>{uiText(s.help)}</small></button>)}</div>:null})}{!matches.length&&<p role="status">{uiText("ไม่พบส่วนที่ตรงกับคำค้นหา")}</p>}</nav>{query&&<button type="button" className="outline-button" onClick={()=>setQuery("")}>{uiText("แสดงเมนูทั้งหมด")}</button>}</aside>
 </>;
}
