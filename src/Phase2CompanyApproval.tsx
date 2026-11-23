"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type PendingRequest={id:string;villaId:string;packageId:string;status:string;requestedAt:string};
type Preview={requestId:string;netSatang:number;vatSatang:number;totalSatang:number;period:{startsAt:string;endsAt:string};simulationOnly:true};
type Props={villas:{id:string;name:string}[];villaId:string;packages:{id:string}[];canAdmin:boolean;canMerchant:boolean;busy:boolean;request:<T>(path:string,data?:unknown)=>Promise<T>;run:(work:()=>Promise<unknown>)=>Promise<void>};
export default function Phase2CompanyApproval({villas,villaId,packages,canAdmin,canMerchant,busy,request,run}:Props){
 const [items,setItems]=useState<PendingRequest[]>([]),[plan,setPlan]=useState("basic"),[preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState("");
 const intent=useRef<{fingerprint:string;key:string}|null>(null);
 const refresh=useCallback(async()=>{const result=await request<{requests:PendingRequest[]}>("/phase2/company-approval-requests");setItems(result.requests);},[request]);
 useEffect(()=>{let current=true;void request<{requests:PendingRequest[]}>("/phase2/company-approval-requests").then(r=>{if(current)setItems(r.requests);}).catch(e=>{if(current)setError(e instanceof Error?e.message:"โหลดคำขอไม่สำเร็จ");});return()=>{current=false;};},[request]);
 const date=(value:string)=>new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
 const money=(n:number)=>new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB"}).format(n/100);
 return <section aria-label="Company approval preparation"><h2>คำขอให้บริษัทตรวจสอบ / Company review requests</h2><p>คำขอยังไม่อนุมัติแพ็กเกจ ไม่สร้างสิทธิ์ และไม่มีการเรียกเก็บเงิน</p>{error&&<p role="alert">{error}</p>}
 {canMerchant&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{setError("");const fingerprint=villaId+":"+plan;if(intent.current?.fingerprint!==fingerprint)intent.current={fingerprint,key:crypto.randomUUID()};await request("/phase2/company-approval-requests",{villaId,packageId:plan,requestKey:intent.current.key});intent.current=null;await refresh();});}}><label>แพ็กเกจที่ขอตรวจสอบ / Requested package<select aria-label="Requested approval package" value={plan} onChange={e=>setPlan(e.target.value)}>{packages.map(p=><option key={p.id} value={p.id}>{p.id}</option>)}</select></label><button disabled={busy||!villaId}>ส่งคำขอตรวจสอบ / Submit review request</button></form>}
 {items.length===0&&<p>ยังไม่มีคำขอตรวจสอบ / No pending requests</p>}{items.map(item=><article key={item.id}><h3>{villas.find(v=>v.id===item.villaId)?.name||"ที่พักไม่อยู่ในรายการปัจจุบัน"}</h3><p>{item.packageId} · รอตรวจสอบ / Pending review</p>{canAdmin&&<button disabled={busy} onClick={()=>void run(async()=>{setPreview(null);const result=await request<{preview:Preview}>("/phase2/company-approval-preview",{requestId:item.id});setPreview(result.preview);})}>ดูตัวอย่าง VAT / Preview VAT</button>}</article>)}
 {preview&&<div role="region" aria-label="Nonfinancial approval preview"><h3>ตัวอย่างเท่านั้น / Preview only</h3><p>ราคาก่อน VAT: {money(preview.netSatang)} · VAT: {money(preview.vatSatang)} · รวม: {money(preview.totalSatang)}</p><p>ตัวอย่างระยะ 30 วัน: {date(preview.period.startsAt)} → {date(preview.period.endsAt)} (เวลาไทย)</p><p>ไม่ใช่ใบแจ้งหนี้หรือการอนุมัติ · ยังไม่เริ่มสิทธิ์และไม่เรียกเก็บเงิน</p></div>}
 </section>;
}
