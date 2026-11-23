import {uiText,getLocale} from "./uiLanguage";
import {propertyCount} from "./propertyFacts";
import {propertyName} from "./propertyNames";
import usePublishedProvinces from "./usePublishedProvinces";
import {localeTag} from "./uiLanguage";
import DemoPhoto from "./DemoPhoto"
import {onPublicVillaRefresh} from "./publicVillaRefresh";
import {useEffect,useRef,useState} from "react";
import {api} from "./api";
import {useCms,useCopy,usePresentation} from "./cms";
import type {Page} from "./prototype";
import {popularProvinces} from "./ProvinceExplorer";
type Villa={demoImage?:boolean;isDemo?:boolean;id:string;name:string;nameEn:string;province:string;qr:string;qrStatus:string;photoUrl:string;updated:string|null;premiumBanner:boolean;guestCapacity:number|null};
const statusLabel:Record<string,string>={ACTIVE:"ตรวจสอบข้อมูลแล้ว",EXPIRED:"หมดอายุ",SUSPENDED:"ถูกระงับ",INACTIVE:"ปิดใช้งาน",PENDING:"รอตรวจสอบ"};
export default function HomeVillaShowcase({go,onSearch}:{go:(page:Page,item?:string)=>void;onSearch:(query:string,province:string)=>void}){
 const t=useCopy(),presentation=usePresentation(),provinces=usePublishedProvinces();
 const {home}=useCms(),section=home.sections.find(s=>s.id==="showcase");
 const [province,setProvince]=useState(""),[items,setItems]=useState<Villa[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[position,setPosition]=useState({start:true,end:true,index:0});
 const track=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;setLoading(true);setError("");setItems([]);setPosition({start:true,end:true,index:0});track.current?.scrollTo({left:0});const params=new URLSearchParams({limit:String(presentation.showcaseLimit)});if(province)params.set("province",province);void api<{villas:Villa[]}>("/public/villas?"+params).then(data=>{if(active)setItems(data.villas);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[province,attempt,presentation.showcaseLimit]);
 useEffect(()=>onPublicVillaRefresh(()=>setAttempt(n=>n+1)),[]);
 const measure=()=>{const el=track.current,card=el?.firstElementChild as HTMLElement|null;if(!el||!card)return;setPosition({start:el.scrollLeft<2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2,index:Math.max(0,Math.min(items.length-1,Math.round(el.scrollLeft/(card.getBoundingClientRect().width+20))))});};
 useEffect(()=>{const el=track.current;if(!el)return;const observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect();},[items,loading]);
 const move=(direction:number)=>{const el=track.current,card=el?.firstElementChild as HTMLElement|null;if(el&&card)el.scrollBy({left:direction*(card.getBoundingClientRect().width+20),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <section className="section villa-discovery-section" aria-labelledby="villa-discovery-title"><div className="container">
  <div className="villa-discovery-heading"><div><span className="kicker">{t("home.showcaseKicker")}</span><h2 id="villa-discovery-title" className="cms-prose">{uiText(section?.title||uiText("ที่พักที่ลงทะเบียนกับ VillaCheck"))}</h2><p>{uiText(section?.description||uiText("ดูภาพ อ่านข้อมูล และตรวจสถานะของที่พักก่อนตัดสินใจ"))}</p></div><button className="villa-discovery-all" onClick={()=>onSearch("",province)}>{t("home.showcaseAll")} <span aria-hidden="true">↗</span></button></div>
  <nav className="villa-province-tabs" aria-label={uiText("เลือกจังหวัดของที่พัก")}>{["",...provinces.slice(0,5)].map(name=><button type="button" key={name} aria-pressed={province===name} aria-controls="villa-discovery-track" onClick={()=>setProvince(name)}>{uiText(name||t("home.showcaseProvince"))}</button>)}</nav>
  <div id="villa-discovery-track" className="villa-discovery-track" ref={track} onScroll={measure} aria-busy={loading} aria-label={province?uiText(`ที่พักใน${province}`):uiText("ที่พักทุกจังหวัด")}>
    {loading?Array.from({length:4},(_,index)=><div key={index} className="villa-discovery-skeleton" aria-hidden="true"><div/><span/><span/></div>):items.map(villa=><a className="discovery-villa-card" key={villa.id} href={`#page=detail&item=${encodeURIComponent(villa.qr)}`} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();go("detail",villa.qr);}}>
      <div className="discovery-villa-photo"><DemoPhoto demo={villa.demoImage} src={villa.photoUrl} alt={uiText(`ภาพ ${villa.name}`)} loading="lazy"/><span className={`discovery-villa-status${!villa.isDemo&&villa.qrStatus==="ACTIVE"?"":" inactive"}`}><span aria-hidden="true">{villa.isDemo?"◷":villa.qrStatus==="ACTIVE"?"✓":"◷"}</span>{villa.isDemo?uiText("ข้อมูลสาธิต · ไม่ใช่ผลตรวจที่พักจริง"):uiText(statusLabel[villa.qrStatus]||villa.qrStatus)}</span>{!villa.isDemo&&villa.premiumBanner&&<span className="discovery-villa-premium">✦ Premium Verified</span>}</div>
      <div className="discovery-villa-body"><span className="discovery-villa-location">{uiText(villa.province)}</span><h3>{propertyName(villa,getLocale())}</h3>{villa.isDemo&&<small>{uiText("ข้อมูลสาธิต · ไม่ใช่ที่พักจริงสำหรับจอง")}</small>}{villa.nameEn&&villa.nameEn!==villa.name&&<p className="discovery-villa-english">{getLocale()==="en"?villa.name:villa.nameEn}</p>}<div className="discovery-villa-meta"><span>{villa.guestCapacity==null?propertyCount(null,"guests",getLocale()):uiText(`สูงสุด ${villa.guestCapacity} คน`)}</span><span>Trust Profile <span aria-hidden="true">↗</span></span></div><small>{villa.updated?uiText(`ตรวจล่าสุด ${new Date(villa.updated).toLocaleDateString(localeTag(),{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Bangkok"})}`):uiText("ยังไม่มีข้อมูลวันที่ตรวจ")}</small></div>
    </a>)}
  </div>
  {!loading&&error&&<div className="villa-discovery-message" role="alert"><p>{uiText(error)}</p><button onClick={()=>setAttempt(n=>n+1)}>{uiText("ลองโหลดอีกครั้ง")}</button></div>}
  {!loading&&!error&&!items.length&&<div className="villa-discovery-message"><p>{uiText("ยังไม่มีที่พักที่แสดง")}{province?uiText(`ใน${province}`):uiText("ในขณะนี้")}</p><button onClick={()=>setProvince("")}>{uiText("ดูจังหวัดอื่น")}</button></div>}
  {items.length>0&&!loading&&<div className="villa-discovery-controls"><span>{position.start&&position.end?uiText(`แสดง ${items.length} รายการ`):`${position.index+1} / ${items.length}`}</span><div><button type="button" aria-label={uiText("Villa ก่อนหน้า")} disabled={position.start} onClick={()=>move(-1)}>←</button><button type="button" aria-label={uiText("Villa ถัดไป")} disabled={position.end} onClick={()=>move(1)}>→</button></div></div>}
 </div></section>;
}
