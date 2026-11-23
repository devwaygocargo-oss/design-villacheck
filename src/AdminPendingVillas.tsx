import {uiText,useUiLanguage} from "./uiLanguage";
import PendingVilla from "./PendingVillaReview";
import { useEffect, useRef, useState } from "react";
import { api, currentAccount, ApiError } from "./api";
import { PortalShell, type Page } from "./prototype";
import type { MerchantVilla, Store } from "./merchantStore";
import OwnerVerification from "./OwnerVerification";
import VillaPagination from "./VillaPagination";
import { usePackages } from "./packagePlans";

export default function AdminPendingVillas({go}:{go:(page:Page,item?:string)=>void}) {
  const {locale}=useUiLanguage();
  const {plans,error:packageError}=usePackages(true);
  const [query,setQuery]=useState(""),[selectedId,setSelectedId]=useState("");
  const [villas,setVillas]=useState<MerchantVilla[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const working=useRef(false);
  const [mediaRevision,setMediaRevision]=useState(0);
  const search=query.trim().toLocaleLowerCase();
  const visible=villas.filter(v=>[v.name,v.nameEn,v.province,v.merchant,v.email,v.qr,v.package,v.packageId].some(value=>value.toLocaleLowerCase().includes(search)));
  const selectedVilla=visible.find(v=>v.id===selectedId)||visible[0];
  useEffect(()=>{
    let active=true,fetching=false;
    const load=async()=>{if(fetching||working.current)return;fetching=true;try{
      const state=await api<Store>("/state");if(active&&!working.current)setVillas(state.villas.filter(v=>!v.archived&&v.status==="pending"));
    }catch(e){if(active){if(e instanceof ApiError&&e.status===401)go("admin-login");else setMessage(e instanceof Error?e.message:"โหลดรายการไม่สำเร็จ");}}
    finally{fetching=false;if(active)setLoading(false);}};
    void load();const timer=window.setInterval(()=>void load(),10000);return()=>{active=false;clearInterval(timer);};
  },[mediaRevision]);
  const review=async(villa:MerchantVilla,status:string,reason:string,level:string)=>{
    if(working.current)return;
    if(["changes","rejected"].includes(status)&&!reason.trim()){setMessage("กรุณาระบุเหตุผลขอแก้ไขหรือไม่อนุมัติ");return;}
    working.current=true;setBusy(true);setMessage("");
    try{await currentAccount();const result=await api<{villas:MerchantVilla[]}>(`/villas/${villa.id}/review`,{status,reason,verificationLevel:level,expectedReviewId:villa.reviewRequest?.id??null});
      const remaining=result.villas.filter(v=>!v.archived&&v.status==="pending");
      if(!remaining.some(v=>v.id===villa.id)){const index=visible.findIndex(v=>v.id===villa.id),next=visible[index+1]||visible[index-1];setSelectedId(next?.id||"");}
      setVillas(remaining);setMessage(status==="approved"?`อนุมัติ ${villa.name} แล้ว`:`บันทึกผลตรวจสอบ ${villa.name} แล้ว`);
    }catch(e){setMessage(e instanceof Error?e.message:"บันทึกผลตรวจสอบไม่สำเร็จ");}
    finally{working.current=false;setBusy(false);}
  };
  return <PortalShell role="Admin" page="admin-pending-villas" go={go}><div className="portal-head"><div><h1>{locale==="en"?"Properties awaiting review":"ที่พักรอตรวจสอบ"}</h1><p>{locale==="en"?"Select a property, check its cover and details, then review the supporting documents.":"เลือกที่พัก ดูรูปปกและข้อมูล แล้วตรวจเอกสารประกอบก่อนให้ผลการพิจารณา"}</p></div><button className="outline-button" onClick={()=>go("admin-approved-villas")}>{uiText("ดู Villa ที่อนุมัติแล้ว")}</button></div>
    <details className="merchant-panel pending-review-help"><summary>{locale==="en"?"Review criteria and owner verification":"เกณฑ์การตรวจและยืนยันเจ้าของบ้าน"}</summary><p>{uiText("Basic Verify ไม่ต้องยืนยันเจ้าของบ้าน ส่วนแพ็กเกจ 1,990 ขึ้นไปตรวจหลักฐานเจ้าของบ้านในหน้านี้ เมื่อ Villa ผ่านอนุมัติและมีแพ็กเกจที่ใช้งานอยู่")}</p><div className="button-row"><button type="button" onClick={()=>document.getElementById("pending-villa-review")?.scrollIntoView({behavior:"smooth"})}>{uiText("รายการ Villa รออนุมัติ")}</button><button type="button" onClick={()=>document.getElementById("owner-verification-review")?.scrollIntoView({behavior:"smooth"})}>{uiText("ตรวจยืนยันเจ้าของบ้าน · 1,990 ขึ้นไป")}</button></div></details>
    <section id="pending-villa-review" aria-label={uiText("รายการ Villa รออนุมัติ")}>
    <label className="pending-villa-search">{uiText("ค้นหา Villa / Merchant / แพ็กเกจ")}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setSelectedId("")}} placeholder={uiText("ชื่อที่พัก จังหวัด หรือแพ็กเกจ")}/></label>
    {message&&!selectedVilla&&<p role="status" className="form-message">{uiText(message)}</p>}
    <p role="status">{loading?uiText("กำลังโหลดรายการ…"):uiText(`รออนุมัติ ${villas.length} รายการ · แสดง ${visible.length} รายการ`)}</p>
    {!loading&&!visible.length&&<section className="merchant-panel">{search?uiText("ไม่พบ Villa ที่ตรงกับการค้นหา"):uiText("ไม่มี Villa รออนุมัติ")}</section>}
    {selectedVilla&&<VillaPagination items={visible} selectedId={selectedVilla.id} onSelect={setSelectedId} disabled={busy} label={uiText("รายการ Villa รออนุมัติ")}/>}
    {[selectedVilla].filter((villa):villa is MerchantVilla=>Boolean(villa)).map(villa=><PendingVilla key={`${villa.id}:${villa.reviewRequest?.id||"legacy"}`} villa={villa} busy={busy} onReview={review} plan={plans.find(p=>p.id===villa.packageId)} packageError={packageError} go={go} feedback={message} onMediaChanged={()=>setMediaRevision(value=>value+1)}/>)}
    {selectedVilla&&<VillaPagination items={visible} selectedId={selectedVilla.id} onSelect={id=>{setSelectedId(id);document.getElementById("pending-villa-review")?.scrollIntoView({block:"start"})}} disabled={busy} label={uiText("รายการ Villa รออนุมัติ")}/>}
    </section>
    <div id="owner-verification-review"><OwnerVerification admin paginate/></div>
  </PortalShell>;
}
