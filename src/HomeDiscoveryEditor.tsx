import {uiText} from "./uiLanguage";
import type { CmsContent, HomeDiscovery, HomeShortcut, ShortcutIconName } from "./cms";
import { discoveryDefaults, publicDestinations, shortcutIcons } from "../server/cms-home-config.mjs";
import ShortcutIcon from "./ShortcutIcon";
export default function HomeDiscoveryEditor({content,onChange,media}:{content:CmsContent;onChange:(content:CmsContent)=>void;media:{url:string;name:string}[]}){
  const d={...discoveryDefaults,...content.home.discovery} as HomeDiscovery;
  const update=(patch:Partial<HomeDiscovery>)=>onChange({...content,home:{...content.home,discovery:{...d,...patch}}});
  const itemUpdate=(id:string,patch:Partial<HomeShortcut>)=>update({shortcuts:d.shortcuts.map(item=>item.id===id?{...item,...patch}:item)});
  const move=(index:number,delta:number)=>{const rows=[...d.shortcuts];[rows[index],rows[index+delta]]=[rows[index+delta],rows[index]];update({shortcuts:rows});};
  const field=(key:"heading"|"placeholder"|"buttonLabel"|"provinceHint"|"freeHint",label:string)=><label>{uiText(label)}<input value={d[key]} maxLength={300} onChange={e=>update({[key]:e.target.value})}/></label>;
  return <div className="cms-discovery-editor"><h2>{uiText("ช่องค้นหาและเมนูลัดใต้ Carousel")}</h2><p>{uiText("ปรับข้อความ เลือกไอคอนใหม่ หรือใช้ภาพจากคลังรูปภาพ ลากลำดับด้วยปุ่มขึ้น / ลง แล้วกด Preview เพื่อตรวจสอบก่อนบันทึกร่าง")}</p>
    <div className="cms-discovery-options">{([['visible',uiText("แสดงส่วนค้นหาและเมนูลัด")],['searchVisible',uiText("แสดงช่องค้นหา")],['showProvinceHint',uiText("แสดงลิงก์เลือกจังหวัด")],['showFreeHint',uiText("แสดงข้อความดูข้อมูลฟรี")]] as const).map(([key,label])=><label className="cms-checkbox" key={key}><input type="checkbox" checked={d[key]} onChange={e=>update({[key]:e.target.checked})}/>{uiText(label)}</label>)}</div>
    <div className="cms-discovery-fields">
    {field("heading",uiText("หัวข้อสำหรับโปรแกรมอ่านหน้าจอ"))}{field("placeholder",uiText("ข้อความในช่องค้นหา"))}{field("buttonLabel",uiText("ข้อความปุ่มค้นหา"))}{field("provinceHint",uiText("ข้อความลิงก์เลือกจังหวัด"))}{field("freeHint",uiText("ข้อความดูข้อมูลฟรี"))}
    <div className="cms-discovery-colors">{([['background',uiText("สีพื้นหลัง")],['iconColor',uiText("สีไอคอน")],['accentColor',uiText("สีเส้นตกแต่ง")]] as const).map(([key,label])=><label key={key}>{uiText(label)}<input type="color" value={d[key]} onChange={e=>update({[key]:e.target.value})}/></label>)}</div>
    </div>
    <div className="cms-discovery-shortcuts">
    {d.shortcuts.map((item,index)=><section className="cms-block-editor" key={item.id} aria-label={uiText(`เมนูลัด ${index+1}`)}><h3>{index+1}. {item.label}</h3><label className="cms-checkbox"><input type="checkbox" checked={item.visible} onChange={e=>itemUpdate(item.id,{visible:e.target.checked})}/>{uiText("แสดงเมนูลัดนี้")}</label>
      <label>{uiText("ชื่อเมนูลัด")}<input maxLength={80} value={item.label} onChange={e=>itemUpdate(item.id,{label:e.target.value})}/></label><label>{uiText("คำอธิบายเมื่อชี้เมาส์")}<input maxLength={300} value={item.description} onChange={e=>itemUpdate(item.id,{description:e.target.value})}/></label>
      <p>{uiText("เลือกไอคอน")}</p><div className="cms-shortcut-icons">{shortcutIcons.map(icon=><button type="button" key={icon.id} aria-pressed={item.icon===icon.id&&!item.image} onClick={()=>itemUpdate(item.id,{icon:icon.id as ShortcutIconName,image:""})}><ShortcutIcon name={icon.id as ShortcutIconName}/><span>{icon.label}</span></button>)}</div>
      <label>{uiText("ใช้ภาพจากคลังแทนไอคอน")}<select value={media.some(m=>m.url===item.image)?item.image:""} onChange={e=>itemUpdate(item.id,{image:e.target.value})}><option value="">{uiText("ใช้ไอคอนที่เลือก")}</option>{media.map(m=><option key={m.url} value={m.url}>{uiText(m.name)}</option>)}</select></label>
      <label>{uiText("URL ภาพไอคอน (HTTPS หรือภาพจากคลัง)")}<input value={item.image} onChange={e=>itemUpdate(item.id,{image:e.target.value})}/></label>
      <label>{uiText("เลือกหน้าปลายทาง")}<select value="" onChange={e=>{if(e.target.value)itemUpdate(item.id,{href:e.target.value});}}><option value="">{uiText("เลือกหน้าปลายทาง…")}</option>{publicDestinations.map(x=><option key={x.href} value={x.href}>{uiText(x.label)}</option>)}{content.pages.map(p=><option key={p.slug} value={`#page=cms-page&item=${p.slug}`}>{uiText(p.title)}</option>)}</select></label><label>{uiText("ลิงก์ปลายทาง")}<input value={item.href} onChange={e=>itemUpdate(item.id,{href:e.target.value})}/></label>
      <div className="button-row"><button type="button" disabled={index===0} onClick={()=>move(index,-1)}>{uiText("↑ ขึ้น")}</button><button type="button" disabled={index===d.shortcuts.length-1} onClick={()=>move(index,1)}>{uiText("↓ ลง")}</button><button type="button" onClick={()=>update({shortcuts:d.shortcuts.filter(x=>x.id!==item.id)})}>{uiText("ลบเมนูลัด")}</button></div>
    </section>)}
    </div>
    <button type="button" disabled={d.shortcuts.length>=12} onClick={()=>update({shortcuts:[...d.shortcuts,{id:`shortcut-${crypto.randomUUID()}`,icon:"find",label:"เมนูลัดใหม่",href:"#page=directory",description:"",visible:true,image:""}]})}>{uiText("+ เพิ่มเมนูลัด")}</button><p>{uiText("สูงสุด 12 รายการ · มือถือแสดง 3 คอลัมน์ · คอมพิวเตอร์แสดง 6 คอลัมน์")}</p>
  </div>;
}
