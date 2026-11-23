"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {bangkokLocalToUtc} from "../server/phase2-time.mjs";
type Job={id:string;villaId:string;source:string;kind:string;channel:string;month:string;status:string;postUrl:string|null;publishedAt:string|null;revision?:number;publishedBy?:string;history?:{status:string;by:string;at:string}[]};
const empty={source:"PACKAGE",kind:"image",channel:"facebook",month:"",status:"scheduled",postUrl:"",publishedAt:""};
export default function Phase2SocialJobs({request,villaId,facebookOnly=true}:{facebookOnly?:boolean;request:<T>(path:string,data?:unknown)=>Promise<T>;villaId:string}){
 const [jobs,setJobs]=useState<Job[]>([]),[selected,setSelected]=useState(""),[form,setForm]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const lock=useRef(false),feedback=useRef<HTMLParagraphElement>(null),generation=useRef(0);
 const load=useCallback(async()=>{const n=++generation.current,r=await request<{jobs:Job[]}>("/phase2/social");if(n===generation.current)setJobs(r.jobs);},[request]);
 useEffect(()=>{setJobs([]);setSelected("");setForm(empty);void load().catch(e=>setError(e.message));return()=>{generation.current++;};},[load,villaId]);
 useEffect(()=>{if(error)feedback.current?.focus();},[error]);
 const existing=jobs.find(j=>j.id===selected);
 function choose(id:string){setSelected(id);setError("");setMessage("");const j=jobs.find(j=>j.id===id);setForm(j?{source:j.source,kind:j.kind,channel:j.channel,month:j.month,status:"published",postUrl:"",publishedAt:""}:empty);}
 async function save(e:FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError("");setMessage("");try{
  const result=await request<{job:Job}>("/phase2/social",{villaId,...form,publishedAt:form.publishedAt?bangkokLocalToUtc(form.publishedAt):undefined,...(existing?{jobId:existing.id,revision:existing.revision||1}:{})});
  await load();setSelected("");setForm(empty);setMessage("บันทึก "+result.job.status+" แล้ว ไม่มีการโพสต์ Social อัตโนมัติ");
 }catch(e){setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}finally{lock.current=false;setBusy(false);}}
 return <section aria-label="Social job tracking"><h2>โควตาคอนเทนต์ Social</h2><p>บันทึกติดตามงานเท่านั้น ไม่โพสต์ Social อัตโนมัติ งานที่นัดไว้เปลี่ยนเป็นเผยแพร่แล้วด้วยรายการและโควตาเดิม</p>
 {error&&<p role="alert" tabIndex={-1} ref={feedback}>{error}</p>}{message&&<p role="status">{message}</p>}
 <label>รายการ Social ที่จะบันทึก<select aria-label="รายการ Social ที่จะบันทึก" disabled={busy} value={selected} onChange={e=>choose(e.target.value)}><option value="">สร้างงานใหม่</option>{jobs.filter(j=>j.villaId===villaId&&j.status==="scheduled").map(j=><option key={j.id} value={j.id}>{j.month} · {j.channel} · {j.kind} · {j.id}</option>)}</select></label>
 <form noValidate onSubmit={e=>void save(e)}><label>งานทีม/แพ็กเกจ<select aria-label="งานทีม/แพ็กเกจ" disabled={busy||Boolean(existing)} value={form.source} onChange={e=>setForm({...form,source:e.target.value,...(facebookOnly&&e.target.value==="PACKAGE"?{channel:"facebook"}:{})})}><option value="PACKAGE">PACKAGE</option><option value="TEAM">TEAM</option></select></label>
 <label>ประเภทชิ้นงาน<select aria-label="ประเภทชิ้นงาน" disabled={busy||Boolean(existing)} value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option value="image">ภาพเดี่ยว</option><option value="video">วิดีโอ</option></select></label>
 <label>ช่องทาง<select aria-label="ช่องทาง" disabled={busy||Boolean(existing)} value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}><option value="facebook">Facebook</option>{(form.source==="TEAM"||!facebookOnly)&&<><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></>}</select></label>
 <label>เดือนที่ใช้สิทธิ์<input type="month" disabled={busy||Boolean(existing)} value={form.month} onChange={e=>setForm({...form,month:e.target.value})}/></label>
 <label>สถานะ<select aria-label="สถานะ" disabled={busy||Boolean(existing)} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="scheduled">Scheduled</option><option value="published">Published</option></select></label>
 <label>ลิงก์โพสต์<input type="url" disabled={busy} value={form.postUrl} onChange={e=>setForm({...form,postUrl:e.target.value})}/></label><label>วันที่เผยแพร่ (เวลาไทย)<input type="datetime-local" disabled={busy} value={form.publishedAt} onChange={e=>setForm({...form,publishedAt:e.target.value})}/></label><button disabled={busy||!villaId||!form.month}>{existing?"ยืนยันเผยแพร่งานเดิม":"บันทึกชิ้นงาน"}</button></form>
 {jobs.filter(j=>j.villaId===villaId).map(j=><article key={j.id}><p>{j.id} · {j.source} · {j.month} · {j.channel} · {j.kind} · {j.status}</p>{j.postUrl&&<a href={j.postUrl} target="_blank" rel="noopener noreferrer">เปิดโพสต์ที่บันทึก</a>}{j.publishedBy&&<p>ผู้บันทึกเผยแพร่: {j.publishedBy} · {j.publishedAt}</p>}{j.history&&<ol aria-label="Social job history">{j.history.map((h,i)=><li key={i}>{h.status} · {h.by} · {h.at}</li>)}</ol>}</article>)}
 </section>;
}
