"use client";
import Phase2Payment,{type Phase2Checkout} from "./Phase2Payment";
import {useEffect,useState} from "react";

export type Phase2Order={id:string;villaId:string;packageId:string;totalSatang:number;status:string;providerReference:string;createdAt:string;updatedAt?:string;listSatang:number;vatSatang:number;vatMode:string;vatBasisPoints:number;billingCycle:string;netSatang:number;vatRoundingPolicy:string;billingDays:number;policyRevision:number;provider:string;currency:string};
type Detail={checkout:Phase2Checkout|null;order:Phase2Order;events:{id?:string;at:string;status?:string;amountSatang?:number;currency?:string}[];grant:{id:string;billingStartsAt?:string;startsAt:string;endsAt:string;state:string}|null};
const date=(v:string)=>new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"}).format(new Date(v));
const money=(n:number)=>new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB"}).format(n/100);

export default function Phase2Orders({orders,villas,canAdmin,busy,request,simulate,updated}:{orders:Phase2Order[];villas:{id:string;name:string}[];canAdmin:boolean;busy:boolean;request:<T>(path:string,data?:unknown)=>Promise<T>;updated:()=>void;simulate:(id:string,status:string)=>void}){
 const [query,setQuery]=useState(""),[status,setStatus]=useState(""),[selected,setSelected]=useState(""),[detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{setSelected("");setDetail(null);setQuery("");setStatus("");},[request]);
 useEffect(()=>{
  let active=true;setDetail(null);setError("");if(!selected){setLoading(false);return;}
  setLoading(true);void request<Detail>("/phase2/orders?orderId="+encodeURIComponent(selected)).then(r=>{if(active)setDetail(r);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"โหลดรายการไม่สำเร็จ");}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[selected,request,orders]);
 const term=query.trim().toLowerCase(),name=(id:string)=>villas.find(v=>v.id===id)?.name||id;
 const filtered=orders.filter(o=>(!status||o.status===status)&&(!term||[o.id,o.providerReference,o.packageId,o.villaId,name(o.villaId)].some(v=>v?.toLowerCase().includes(term)))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
 return <section aria-label="คำสั่งซื้อและกระทบยอด"><h2>คำสั่งซื้อและกระทบยอด / Orders</h2>
  <label>ค้นหาคำสั่งซื้อ / Search orders<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="เลขคำสั่งซื้อ เลขอ้างอิง ที่พัก หรือแพ็กเกจ"/></label>
  <label>สถานะคำสั่งซื้อ / Order status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">ทุกสถานะ</option>{["pending","succeeded","cancelled","failed"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
  <p aria-live="polite">พบ {filtered.length} จาก {orders.length} รายการ</p>
  {filtered.length===0&&<p>ไม่พบคำสั่งซื้อตามเงื่อนไข</p>}
  {filtered.map(o=><article key={o.id} data-phase2-order={o.id}><h3>{name(o.villaId)} — {o.packageId}</h3><p>{o.id}<br/>{money(o.totalSatang)} — {o.status}<br/>สร้าง {date(o.createdAt)}</p><button type="button" aria-expanded={selected===o.id} disabled={busy} onClick={()=>setSelected(selected===o.id?"":o.id)}>รายละเอียด / Details</button>
   {selected===o.id&&<div>{loading&&<p role="status">กำลังโหลดรายละเอียด</p>}{error&&<p role="alert">{error}</p>}{detail&&<>
    <p>ผู้ให้บริการ: {detail.order.provider}<br/>เลขอ้างอิง: {detail.order.providerReference}<br/>สกุลเงิน: {detail.order.currency}<br/>ราคาแพ็กเกจ: {money(detail.order.listSatang)}<br/>VAT: {money(detail.order.vatSatang)} ({detail.order.vatMode}, {detail.order.vatBasisPoints/100}%)<br/>ยอดรวม: {money(detail.order.totalSatang)}<br/>รอบเดือนตามเงื่อนไขที่ยืนยัน: {detail.order.billingDays} วัน · กติกาฉบับ {detail.order.policyRevision}</p>
    {detail.checkout&&<Phase2Payment key={o.id} orderId={o.id} amount={o.totalSatang} canPay={!canAdmin&&o.provider==="OMISE_TEST"&&o.status==="pending"} checkout={detail.checkout} request={request} updated={updated}/>}
    <h4>ผลเปิดสิทธิ์ / Granted period</h4>{detail.grant?<p>{detail.grant.state}<br/>เริ่มใช้ฟีเจอร์ {date(detail.grant.startsAt)}<br/>{detail.grant.billingStartsAt&&<>เริ่มรอบบิล {date(detail.grant.billingStartsAt)}<br/></>}สิ้นสุด {date(detail.grant.endsAt)}<br/>เลขสิทธิ์: {detail.grant.id}</p>:<p>ยังไม่เปิดสิทธิ์จากคำสั่งซื้อนี้</p>}
    <h4>ประวัติผลชำระทดสอบ / Sandbox events</h4>{detail.events.length===0?<p>ยังไม่ได้รับผลชำระ</p>:<ol>{detail.events.map((e,i)=><li key={e.id||i}>{date(e.at)} — {e.status||"บันทึกเดิมไม่ระบุสถานะ"}{e.amountSatang!==undefined&&<> · {money(e.amountSatang)}</>}</li>)}</ol>}
   </>}</div>}
   {canAdmin&&o.provider==="LOCAL_SIMULATOR"&&o.status==="pending"&&["pending","succeeded","cancelled","failed"].map(s=><button key={s} type="button" disabled={busy} onClick={()=>simulate(o.id,s)}>Simulate {s}</button>)}
  </article>)}
 </section>;
}
