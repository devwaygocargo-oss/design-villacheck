import VillaArchiveAction from "./VillaArchiveAction";
import AdminVillaMedia from "./AdminVillaMedia";
import {uiText} from "./uiLanguage";
import ListPagination from "./ListPagination";
import StatusCornerRibbon from "./StatusCornerRibbon"
import DemoPhoto from "./DemoPhoto"
import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { PortalShell, type Page } from "./prototype";
import type { MerchantVilla, Store } from "./merchantStore";
import { useCms } from "./cms";
import VillaEntitlements from "./VillaEntitlements";
import { usePackages } from "./packagePlans";

export default function AdminApprovedVillas({go}:{go:(page:Page,item?:string)=>void}) {
  const {site}=useCms();
  const {plans,error:packageError}=usePackages(true);
  const [villas,setVillas]=useState<MerchantVilla[]>([]);
  const [listPage,setListPage]=useState(1);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState("");
  useEffect(()=>{
    let active=true,fetching=false;
    const load=async()=>{
      if(fetching)return;fetching=true;
      try{const state=await api<Store>("/state");if(active){setVillas(state.villas.filter(v=>!v.archived&&v.status==="approved"));setError("");}}
      catch(e){if(active){if(e instanceof ApiError&&e.status===401)go("admin-login");else setError(e instanceof Error?e.message:"โหลดรายการไม่สำเร็จ");}}
      finally{fetching=false;if(active)setLoading(false);}
    };
    void load();const timer=window.setInterval(()=>void load(),10000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  const search=query.trim().toLocaleLowerCase();
  const visible=villas.filter(v=>!v.archived).filter(v=>[v.name,v.nameEn,v.province,v.merchant,v.email,v.qr,v.package,v.packageId].some(value=>value.toLocaleLowerCase().includes(search)));
  const currentPage=Math.min(listPage,Math.max(1,Math.ceil(visible.length/10)));
  const displayed=visible.slice((currentPage-1)*10,currentPage*10);
  return <PortalShell role="Admin" page="admin-approved-villas" go={go}>
    <div className="portal-head"><div><h1>{uiText("Villa ที่อนุมัติแล้ว")}</h1><p>{uiText("รายการที่ผ่านการตรวจจาก Admin ข้อมูลและสถานะจากระบบเดียวกับหน้าลูกค้า")}</p></div><button className="outline-button" onClick={()=>go("admin-pending-villas")}>{uiText("ดู Villa รออนุมัติ")}</button></div>
    <section className="merchant-panel portal-form"><label>{uiText("ค้นหา Villa ที่อนุมัติแล้ว")}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setListPage(1)}} placeholder={uiText("ชื่อ Villa จังหวัด Merchant หรือ QR")}/></label><p role="status">{loading?uiText("กำลังโหลดรายการ…"):uiText(`อนุมัติแล้ว ${villas.length} รายการ · แสดง ${visible.length} รายการ`)}</p></section>
    {error&&<p role="alert" className="form-message">{uiText(error)}</p>}
    {!loading&&!visible.length&&<section className="merchant-panel">{search?uiText("ไม่พบ Villa ที่ตรงกับการค้นหา"):uiText("ยังไม่มี Villa ที่อนุมัติแล้ว")}</section>}
    <ListPagination page={currentPage} total={visible.length} pageSize={10} onPage={setListPage}/>
    <div className="approved-villa-grid">
    {displayed.map(villa=><article key={villa.id} className="merchant-panel approved-villa" aria-label={uiText(`อนุมัติแล้ว ${villa.name}`)}>
      <h2>{villa.name}</h2><VillaArchiveAction id={villa.id} name={villa.name} admin onChanged={()=>window.location.reload()}/><button type="button" className="outline-button" onClick={()=>go("admin-villa-page",villa.id)}>{uiText("จัดการหน้ารายละเอียด")}</button><p className="merchant-status">{uiText("อนุมัติแล้ว")}{ /dummy|demo|sample/i.test(`${villa.name} ${villa.merchant} ${villa.document.name}`) && uiText(" · DUMMY / ข้อมูลสาธิต ไม่ใช่ที่พักจริง")}</p>
      <p>{villa.province} · {villa.merchant} · {villa.package}</p>
      <VillaEntitlements villa={villa} plan={plans.find(p=>p.id===villa.packageId)} error={packageError} go={go}/>
      {["pro","premium"].includes(villa.packageId)&&<section className="approved-villa-social" aria-label={uiText(`ส่งสื่อโปรโมท ${villa.name}`)}><h3>{uiText("ส่งสื่อโปรโมททาง Social Media")}</h3><p>{uiText("ให้เจ้าของที่พักส่ง")}{villa.packageId==="premium"?uiText("รูปภาพและวิดีโอ"):uiText("รูปภาพ")}{uiText("ผ่านข้อความ Facebook ของ VillaCheck เดือนละ 1 ครั้ง พร้อมชื่อที่พักและเดือนที่ต้องการโปรโมท")}</p><p>{villa.packageId==="premium"?uiText("แพ็กเกจ 4,990: ภาพเดี่ยว 1 โพสต์ + วิดีโอ 1 ชิ้นต่อเดือน"):uiText("แพ็กเกจ 2,990: ภาพเดี่ยว 1 โพสต์ต่อเดือน")}{uiText(" · โปรโมทบนทุก Social Media ของ VillaCheck รวมงบโฆษณาตามสิทธิ์แพ็กเกจ")}</p>{site.facebook?<a className="outline-button" href={site.facebook} target="_blank" rel="noopener noreferrer">{uiText("ส่งสื่อทาง Facebook ↗")}</a>:<p>{uiText("ติดต่อทีม VillaCheck เพื่อขอช่องทางส่งสื่อทาง Facebook")}</p>}</section>}
      <div className="villa-image"><DemoPhoto className="pending-villa-photo" demo={villa.demoImage} src={villa.photoUrl} alt={uiText(`รูป ${villa.name}`)}/><StatusCornerRibbon villa={villa}/></div>
      <details open><summary>{uiText("ข้อมูล Villa สำหรับ Admin")}</summary><dl className="pending-villa-fields">{[
        ["Merchant",villa.merchant],[uiText("อีเมล"),villa.email],[uiText("เบอร์โทร"),villa.phone],[uiText("ธนาคาร"),villa.bankName],[uiText("ชื่อบัญชี"),villa.accountName],[uiText("เลขบัญชี"),villa.accountNumber],[uiText("จำนวนผู้เข้าพักสูงสุด"),villa.guestCapacity==null?uiText("ไม่ได้ระบุ"):uiText(`${villa.guestCapacity} คน`)],["QR Reference",villa.qr||uiText("ยังไม่มี QR")],
      ].map(([label,value])=><div key={label}><dt>{uiText(label)}</dt><dd>{value||uiText("ไม่ได้ระบุ")}</dd></div>)}</dl></details>
      <AdminVillaMedia villaId={villa.id}/>
      <p>{uiText("เอกสารที่แนบ: ")}{villa.document.name}</p>
      <div className="button-row"><a className="outline-button" href={`${villa.document.data}?preview=1`} target="_blank" rel="noreferrer">{uiText("เปิดดูเอกสารที่แนบ")}</a><a className="outline-button" href={villa.document.data} download={villa.document.name}>{uiText("ดาวน์โหลดเอกสาร")}</a>{villa.qr&&<button className="primary-button" onClick={()=>go("admin-verify",villa.qr)}>{uiText("ตรวจสอบ Villa และ QR")}</button>}</div>
    </article>)}</div>
    <ListPagination page={currentPage} total={visible.length} pageSize={10} onPage={next=>{setListPage(next);window.scrollTo({top:0})}}/>
  </PortalShell>;
}
