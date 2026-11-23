import useConfirmDialog from './useConfirmDialog';
import {uiText} from "./uiLanguage";
import {localeTag} from "./uiLanguage";
import {notifyPublicVillaVisibilityChanged} from "./publicVillaRefresh";
import Advertising from "./Advertising";
import Reviews from "./Reviews";
import AdminAcceptance from "./AdminAcceptance";
import AdminPromotions from "./AdminPromotions";
import { useEffect, useRef, useState } from "react";
import { api,currentAccount } from "./api";
import { PortalShell,type Page } from "./prototype";
import type { PackagePlan } from "./packagePlans";
import { basicVerificationNotice } from "../server/package-content.mjs";
import AdminReadiness from "./AdminReadiness";
import AdminLeadList,{type Lead} from "./AdminLeadList";
export default function AdminBusiness({page,go}:{page:Page;go:(page:Page)=>void}) {
 const {confirm,dialog}=useConfirmDialog();
 const [packages,setPackages]=useState<PackagePlan[]>([]),[draft,setDraft]=useState<PackagePlan|null>(null),[leads,setLeads]=useState<Lead[]>([]),[demo,setDemo]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const [canConfigurePackages,setCanConfigurePackages]=useState(false);
 const [demoAllowed,setDemoAllowed]=useState(false);
 const [demoVillasVisible,setDemoVillasVisible]=useState(true);
 const [loading,setLoading]=useState(true);
 const loadSequence=useRef(0);
 const [adsDirty,setAdsDirty]=useState(false),[baseline,setBaseline]=useState("");
 const dirty=adsDirty||!!draft&&JSON.stringify(draft)!==baseline;
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
 const navigate=async(target:Page)=>{if(!dirty||await confirm(uiText("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?")))go(target);};
 const edit=async(plan:PackagePlan)=>{if(dirty&&!await confirm(uiText("ละทิ้งการแก้ไขแพ็กเกจที่ยังไม่บันทึก?")))return;setDraft({...plan,features:[...plan.features]});setBaseline(JSON.stringify(plan));};
 const load=async(showLoading=true)=>{
  const sequence=++loadSequence.current;if(showLoading)setLoading(true);
  try {
   const account=await currentAccount();setCanConfigurePackages(Boolean(account.businessPermissions?.includes("packages.configure")));
   if(page==="admin-packages"){const value=await api<{packages:PackagePlan[]}>("/admin/packages");if(sequence===loadSequence.current)setPackages(value.packages.filter(p=>![p.name,p.slug,p.id].some(value=>value?.toLowerCase().replace(/[\s_+-]/g,"")==="trustplus")));}
   if(page==="admin-leads"){const value=await api<{leads:Lead[]}>("/admin/leads");if(sequence===loadSequence.current)setLeads(value.leads);}
   if(page==="admin-settings"){const configuration=await api<{releaseMode:string}>("/config");if(sequence===loadSequence.current)setDemoAllowed(["STAGING","STAGING_INTERACTIVE"].includes(configuration.releaseMode));const value=await api<{demoMode:boolean}>("/admin/settings");const visibility=await api<{visible:boolean}>("/admin/settings/demo-villas");if(sequence===loadSequence.current){setDemo(value.demoMode);setDemoVillasVisible(visibility.visible);}}
  } finally {if(sequence===loadSequence.current)setLoading(false);}
 };
 useEffect(()=>{let active=true;setError("");setMessage("");void load().catch(e=>{if(active)setError(e.message);});return()=>{active=false;loadSequence.current++;};},[page]);
 const save=async(path:string,data:unknown)=>{setBusy(true);setError("");try{await api(path,data);if(path==="/admin/settings/demo-villas")notifyPublicVillaVisibilityChanged();if(path.startsWith("/admin/packages"))setBaseline(JSON.stringify(data));await load(page!=="admin-leads");setMessage("บันทึกแล้ว");}catch(e){setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}finally{setBusy(false);}};
 const blank=():PackagePlan=>({id:"",name:"",slug:"",description:"",amount:0,capacity:1,currency:"THB",billingCycle:"MONTHLY",trialMonths:0,features:[],maximumVerificationLevel:"VERIFIED",showPremiumBanner:false,isActive:true,sort_order:0});
 if(page==="admin-packages"&&packages.some(p=>p.phase1DisplayOnly))return <PortalShell phase1 role="Admin" page={page} go={navigate}><h1>{uiText("ข้อมูลแพ็กเกจ Phase 1 (อ่านอย่างเดียว)")}</h1>{packages.filter(p=>p.isActive).map(p=><article key={p.id}><h2>{p.name}</h2><p>{uiText("ราคาเต็ม ฿")}{p.amount/100}{uiText(" · ลด ")}{p.promotion?.percent??0}{uiText("% · สุทธิ ฿")}{(p.netAmount??p.amount)/100}</p><p>{uiText(p.description)}</p></article>)}<p>{uiText("ยังไม่เปิดการแก้ Catalog, โปรโมชั่น หรือเงื่อนไขสิทธิ์ใหม่")}</p></PortalShell>
 return <PortalShell role="Admin" page={page} go={navigate}>{dialog}<h1>{page==="admin-packages"?uiText("จัดการแพ็กเกจ"):page==="admin-leads"?uiText("ผู้สนใจติดต่อ"):page==="admin-advertising"?uiText("โฆษณาและงาน Social Media"):page==="admin-reviews"?uiText("จัดการรีวิวลูกค้า"):page==="admin-owner-verification"?uiText("ตรวจยืนยันเจ้าของบ้าน"):uiText("ตั้งค่าระบบ")}</h1>{error&&<p role="alert">{uiText(error)}</p>}{message&&<p role="status">{uiText(message)}</p>}
 {page==="admin-packages"&&<section className="merchant-panel"><p>{uiText("ราคาและสิทธิ์ชุดเดียวกับหน้า Merchant · ต่อที่พัก รวมภาษี · Basic Verify ราคาปกติ 990 บาท ช่วงโปรโมชั่นลด 100%")}</p><p>{uiText(basicVerificationNotice)}</p><div className="admin-package-comparison" role="region" aria-label={uiText("ตารางเปรียบเทียบแพ็กเกจ เลื่อนแนวนอนได้")} tabIndex={0}><table><caption>{uiText("เปรียบเทียบสิทธิ์ตามหน้า Merchant — ✓ มีสิทธิ์ / ✕ ไม่มีสิทธิ์")}</caption><thead><tr><th>{uiText("สิทธิ์")}</th>{packages.map(p=><th key={p.id}>{p.name}<br/>{uiText("฿")}{(p.amount/100).toLocaleString(localeTag())}</th>)}</tr></thead><tbody>{[...new Set(packages.flatMap(p=>p.features.map(f=>f.trim()).filter(Boolean)))].map(f=><tr key={f}><th>{uiText(f)}</th>{packages.map(p=><td key={p.id} aria-label={p.features.some(x=>x.trim()===f)?uiText("มีสิทธิ์"):uiText("ไม่มีสิทธิ์")}>{p.features.some(x=>x.trim()===f)?"✓":"✕"}</td>)}</tr>)}</tbody></table></div><button disabled={!canConfigurePackages} className="primary-button" onClick={()=>edit(blank())}>{uiText("เพิ่มแพ็กเกจ")}</button>{packages.map(p=><div key={p.id} className="button-row"><strong>{p.name}{uiText(" · ฿")}{p.amount/100} · {p.capacity} Villa · {p.isActive?uiText("เปิด"):uiText("ปิด")}</strong><button disabled={!canConfigurePackages} onClick={()=>edit(p)}>{uiText("แก้ไข")}</button></div>)}{canConfigurePackages&&draft&&<form className="portal-form" onSubmit={e=>{e.preventDefault();void save(draft.id?`/admin/packages/${draft.id}`:"/admin/packages",draft);}}>
 {(["name","slug","description"] as const).map(k=><label key={k}>{{name:uiText("ชื่อแพ็กเกจที่แสดงให้ Merchant"),slug:uiText("รหัส URL"),description:uiText("คำอธิบายแพ็กเกจ")}[k]}<input required={k!=="description"} value={draft[k]} onChange={e=>setDraft({...draft,[k]:e.target.value})}/></label>)}
 <label>{uiText("ราคา THB")}<input type="number" min="0" step="0.01" value={draft.amount/100} onChange={e=>setDraft({...draft,amount:Math.round(Number(e.target.value)*100)})}/></label>
 {(["capacity","trialMonths","sort_order"] as const).map(k=><label key={k}>{{capacity:uiText("จำนวนที่พักตามระบบเดิม"),trialMonths:uiText("ระยะทดลองเดิม (เดือน)"),sort_order:uiText("ลำดับแสดงผล")}[k]}<input type="number" min={k==="capacity"?1:0} value={draft[k]} onChange={e=>setDraft({...draft,[k]:Number(e.target.value)})}/></label>)}
 <label>{uiText("สิทธิ์ที่แสดงบนหน้า Merchant (หนึ่งรายการต่อบรรทัด)")}<textarea value={draft.features.join("\n")} onChange={e=>setDraft({...draft,features:e.target.value.split("\n")})}/></label>
 <label>{uiText("Maximum Verification Level")}<select value={draft.maximumVerificationLevel} onChange={e=>setDraft({...draft,maximumVerificationLevel:e.target.value})}>{["REGISTERED","BASIC_CHECKED","VERIFIED","PREMIUM_VERIFIED"].map(x=><option key={x} value={x}>{uiText(x)}</option>)}</select></label>
 <label><input type="checkbox" checked={draft.showPremiumBanner} onChange={e=>setDraft({...draft,showPremiumBanner:e.target.checked})}/>{uiText("สิทธิ์แบนเนอร์ Premium (ต้องผ่านเงื่อนไขเผยแพร่โฆษณา)")}</label><label><input type="checkbox" checked={draft.isActive} onChange={e=>setDraft({...draft,isActive:e.target.checked})}/>{uiText("เปิดใช้งาน")}</label><label>{uiText("Billing cycle")}<select value={draft.billingCycle} onChange={e=>setDraft({...draft,billingCycle:e.target.value})}><option value="MONTHLY">{uiText("Monthly")}</option><option value="QUARTERLY">{uiText("Quarterly (3 months)")}</option><option value="YEARLY">{uiText("Yearly (12 months)")}</option></select></label><p>{uiText("ราคาต่อที่พัก รวมภาษี · บาท / รอบบิล · หน้า Merchant ใช้ข้อมูลชุดเดียวกัน การเปลี่ยนราคาไม่แก้ยอดใบแจ้งชำระเดิม")}</p><button disabled={busy} className="primary-button">{uiText("บันทึกแพ็กเกจ")}</button></form>}</section>}
 {page==="admin-leads"&&loading&&<p role="status">{uiText("กำลังโหลดผู้สนใจ…")}</p>}
 {page==="admin-leads"&&!loading&&!error&&<AdminLeadList leads={leads} busy={busy} save={save}/>}
 {page==="admin-settings"&&<section className="merchant-panel"><p><strong>{uiText("ตรวจสลิปโดย Admin")}</strong>{uiText(" · ตรวจยอดและเลขธุรกรรมก่อนอนุมัติ หรือระบุเหตุผลเมื่อส่งกลับให้ Merchant แนบใหม่")}</p>{demoAllowed&&<label><input type="checkbox" checked={demo} onChange={e=>setDemo(e.target.checked)}/>{uiText("Demo Mode · dummy slips and email outbox (no real money or emails)")}</label>}<button disabled={busy} className="primary-button" onClick={()=>void save("/admin/settings",{paymentVerificationMode:"MANUAL",demoMode:demo})}>{uiText("บันทึกการตั้งค่า")}</button></section>}
 {page==="admin-settings"&&demoAllowed&&<section className="merchant-panel"><h2>{uiText("แสดงที่พักสาธิตจากฐานข้อมูล")}</h2><p>{uiText("ใช้ข้อมูลในฐานที่เว็บเชื่อมอยู่ ปิดเพื่อซ่อนจากหน้าแรกและรายการค้นหา โดยไม่ลบข้อมูลหรือเปลี่ยนสิทธิ์สมาชิก รายการยังต้องผ่านอนุมัติและมี QR Active")}</p><label><input type="checkbox" checked={demoVillasVisible} disabled={loading||busy||!!error} onChange={e=>setDemoVillasVisible(e.target.checked)}/>{uiText("แสดง Demo Villas")}</label><p>{uiText("แยกจาก Demo Mode ของการชำระเงิน ลิงก์ QR เดิมยังตรวจได้ตามสิทธิ์")}</p><button disabled={loading||busy||!!error} className="primary-button" onClick={()=>void save("/admin/settings/demo-villas",{visible:demoVillasVisible})}>{uiText("บันทึกการแสดง Demo Villas")}</button></section>}
 {page==="admin-settings"&&<><div className="button-row"><button onClick={()=>go("admin-reviews")}>{uiText("จัดการรีวิวลูกค้า")}</button><button onClick={()=>go("admin-pending-villas")}>{uiText("ตรวจยืนยันเจ้าของบ้าน")}</button></div><AdminReadiness/><AdminAcceptance/></>}
 {page==="admin-reviews"&&<><p>{uiText("การตรวจรีวิวขึ้นกับสิทธิ์ที่ตั้งค่าไว้รายแพ็กเกจ ใช้กติกาเดียวกันทุกคะแนน")}</p><Reviews mode="admin"/></>}
 {page==="admin-advertising"&&<><p>{uiText("2,990: ภาพเดี่ยว 1 โพสต์ และโฆษณาเล็กก่อน Footer · 4,990: ภาพเดี่ยว 1 โพสต์ + วิดีโอ และ Carousel หน้าแรก · โปรโมทบนทุก Social รวมงบโฆษณา")}</p><Advertising onDirtyChange={setAdsDirty}/></>}
 {page==="admin-packages"&&<AdminPromotions/>}
 </PortalShell>;
}
