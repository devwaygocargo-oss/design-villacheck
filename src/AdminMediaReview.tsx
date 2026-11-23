"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {api,ApiError} from './api';import {useUiLanguage,uiText} from './uiLanguage';import PropertyVideoPlayer from './PropertyVideoPlayer';
import styles from './AdminMediaReview.module.css';
type Media={id:string;name:string;kind:string;url:string;uploadedAt:string|null;takenAt:string|null;reviewedAt:string|null;provider?:string};
type Data={media:Media[];coverUrl?:string};
const reviewed=(m:Media)=>Number.isFinite(Date.parse(m.reviewedAt||''))&&(!Number.isFinite(Date.parse(m.uploadedAt||''))||Date.parse(m.reviewedAt!)>=Date.parse(m.uploadedAt!));
export default function AdminMediaReview({villaId,onChanged,onBusyChange,revision=0,management}:{villaId?:string;onChanged?:()=>void;onBusyChange?:(busy:boolean)=>void;revision?:number;management?:ReactNode}){
 const {locale}=useUiLanguage(),en=locale==='en',text=(th:string,english:string)=>en?english:th;
 const [data,setData]=useState<Data>({media:[]}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[filter,setFilter]=useState('all'),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[broken,setBroken]=useState(false),[manage,setManage]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),feedback=useRef<HTMLParagraphElement>(null),lock=useRef(false),generation=useRef(0);
 const date=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat(en?'en-GB':'th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):text('ไม่ระบุ','Not provided');
 async function fetchMedia(){if(!villaId)throw Error(text('กรุณาเลือกที่พักก่อนตรวจสื่อ','Select a property before reviewing media'));return api<Data>('/admin/property-media?villaId='+encodeURIComponent(villaId));}
 useEffect(()=>{let active=true;generation.current++;setLoading(true);setError('');setMessage('');setSelected(null);setData({media:[]});setManage(false);void fetchMedia().then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(uiText(e.message));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;generation.current++;};},[villaId]);
 useEffect(()=>{let active=true;if(revision)void fetchMedia().then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(uiText(e.message));});return()=>{active=false;};},[revision]);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 const current=data.media.find(m=>m.id===selected),pending=data.media.filter(m=>!reviewed(m)),done=data.media.length-pending.length;
 const isCover=(m:Media)=>m.id==='cover'||m.url===data.coverUrl;
 const label=(m:Media)=>isCover(m)?text('รูปปก','Cover photo'):m.kind==='video'?text('วิดีโอ','Video'):text('รูปภาพ','Photo');
 const visible=data.media.filter(m=>filter==='all'||(filter==='pending'?!reviewed(m):reviewed(m)));
 useEffect(()=>{setBroken(false);if(selected&&dialog.current&&!dialog.current.open)dialog.current.showModal();if(!selected&&dialog.current?.open)dialog.current.close();},[selected]);
 useEffect(()=>{if(error&&dialog.current?.open)feedback.current?.focus();},[error]);
 async function reload(){if(lock.current)return;setLoading(true);setError('');try{setData(await fetchMedia());}catch(e){setError(e instanceof Error?uiText(e.message):text('โหลดสื่อไม่สำเร็จ','Unable to load media'));}finally{setLoading(false);}}
 async function confirm(){if(!current||reviewed(current)||lock.current||broken)return;lock.current=true;setBusy(true);setError('');setMessage('');const version=generation.current,id=current.id;
  try{await api('/admin/property-media',{villaId,mediaId:id});if(generation.current!==version)return;
   // Success is recorded only after POST. If refresh fails, never invite another POST.
   setData(old=>({...old,media:old.media.map(m=>m.id===id?{...m,reviewedAt:new Date().toISOString()}:m)}));
   setMessage(text('บันทึกผลตรวจสื่อนี้แล้ว','Media review saved'));try{const value=await fetchMedia();if(generation.current===version)setData(value);}catch{if(generation.current===version)setMessage(text('บันทึกแล้ว แต่โหลดสถานะล่าสุดไม่สำเร็จ กรุณารีเฟรชรายการ','Saved, but latest status could not be loaded. Refresh the list.'));}onChanged?.();
  }catch(e){if(generation.current===version){setError(e instanceof Error?uiText(e.message):text('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง','Unable to save. Try again.'));if(e instanceof ApiError&&e.status===409)try{const value=await fetchMedia();if(generation.current===version){setData(value);onChanged?.();}}catch{/* Keep the validation message and allow explicit refresh. */}}}
  finally{lock.current=false;if(generation.current===version)setBusy(false);}
 }
 const next=pending.find(m=>m.id!==selected);
 return <section className={styles.review} aria-label={text('ตรวจรูปปก รูปภาพ และวิดีโอ','Review cover, photos and videos')}>
  <header className={styles.header}><div><span className={styles.eyebrow}>{text('การตรวจสอบสื่อ','MEDIA REVIEW')}</span><h2>{text('ตรวจรูปภาพและวิดีโอ','Review photos and videos')}</h2><p>{text('เปิดดูทีละรายการ แล้วกดยืนยันเมื่อได้ตรวจสอบแล้ว','Open each item and confirm after inspecting it.')}</p></div><button type="button" className={styles.secondary} disabled={busy||loading} onClick={()=>void reload()}>{text('รีเฟรชรายการ','Refresh')}</button></header>
  {!loading&&<><div className={styles.progress}><strong>{text(`ตรวจแล้ว ${done} จาก ${data.media.length} รายการ`,`${done} of ${data.media.length} reviewed`)}</strong><span>{pending.length?text(`รอตรวจอีก ${pending.length} รายการ`,`${pending.length} pending`):text(data.media.length?'ตรวจสื่อครบแล้ว':'ยังไม่มีรายการสื่อ',data.media.length?'All media reviewed':'No media yet')}</span></div><progress className={styles.bar} value={done} max={Math.max(1,data.media.length)} aria-label={text('ความคืบหน้าการตรวจสื่อ','Media review progress')}/></>}
  <p className={styles.note}>{text('การยืนยันสื่อเป็นขั้นตอนตรวจรูป/วิดีโอ การอนุมัติ Villa ยังต้องตรวจข้อมูลและเอกสารให้ครบ','Media confirmation reviews photos/videos. Villa approval still requires its details and documents.')}</p>
  {loading&&<p role="status">{text('กำลังโหลดสื่อ…','Loading media…')}</p>}
  {!selected&&error&&<p role="alert" className={styles.error}>{error}</p>}
  {!selected&&message&&<p role="status" className={styles.success}>{message}</p>}
  <div className={styles.filters} role="group" aria-label={text('กรองสถานะสื่อ','Filter media status')}>{[['all',text('ทั้งหมด','All')],['pending',text('รอตรวจ','Pending')],['done',text('ตรวจแล้ว','Reviewed')]].map(([value,name])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{name} <span>{value==='all'?data.media.length:value==='pending'?pending.length:done}</span></button>)}</div>
  <div className={styles.grid}>{visible.map(m=><article className={styles.card} key={m.id} aria-label={label(m)+' '+m.name}>
   <button type="button" className={styles.preview} onClick={()=>{setSelected(m.id);setError('');setMessage('');}} aria-label={text('เปิดตรวจ','Inspect')+' '+label(m)+' '+m.name}>{m.kind==='image'?<img src={m.url} alt={m.name} loading="lazy"/>:<span className={styles.videoCover}><span aria-hidden="true">▷</span>{text('เปิดดูวิดีโอ','Open video')}</span>}<span className={styles.type}>{label(m)}</span></button>
   <div className={styles.cardBody}><span className={reviewed(m)?styles.done:styles.pending}>{reviewed(m)?text('✓ ตรวจแล้ว','✓ Reviewed'):text('◷ รอตรวจ','◷ Pending')}</span><h3>{m.name}</h3><p>{text('อัปโหลด ','Uploaded ')}{date(m.uploadedAt)}</p><button type="button" className={styles.secondary} onClick={()=>{setSelected(m.id);setError('');setMessage('');}}>{reviewed(m)?text('ดูสื่อและผลตรวจ','View media and review'):text('เปิดตรวจรายการนี้','Inspect this item')}</button></div>
  </article>)}</div>
  {!loading&&!error&&!visible.length&&<div className={styles.empty}>{data.media.length?text('ไม่มีสื่อตามสถานะที่เลือก','No media with this status'):text('ยังไม่มีสื่อให้ตรวจ กรุณาให้ผู้ประกอบการแนบรูปปกและสื่อก่อน','No media to review. Ask the Merchant to attach cover/media first.')}</div>}
  {management&&<details className={styles.management} open={manage} onToggle={e=>setManage(e.currentTarget.open)}><summary>{text('เพิ่มไฟล์หรือจัดการสื่อเพิ่มเติม','Upload or manage media')}</summary>{manage&&management}</details>}
  <dialog ref={dialog} className={styles.dialog} aria-label={text('ตรวจสื่อทีละรายการ','Inspect media item')} onCancel={e=>{if(busy)e.preventDefault();else setSelected(null);}} onClose={()=>{if(!busy)setSelected(null);}}>
   {current&&<><header className={styles.modalHeader}><div><span className={styles.eyebrow}>{label(current)}</span><h2>{current.name}</h2></div><button autoFocus type="button" className={styles.close} disabled={busy} onClick={()=>setSelected(null)} aria-label={text('ปิดหน้าตรวจสื่อ','Close media inspection')}>×</button></header>
    <div className={styles.stage}>{current.kind==='image'?<img key={current.url} src={current.url} alt={current.name} onError={()=>setBroken(true)}/>:<PropertyVideoPlayer key={current.id} video={current} poster={data.coverUrl}/>}</div>
    <div className={styles.modalBody}><span className={reviewed(current)?styles.done:styles.pending}>{reviewed(current)?text('✓ ตรวจแล้ว','✓ Reviewed'):text('◷ รอตรวจ','◷ Pending')}</span><dl className={styles.dates}><div><dt>{text('อัปโหลด','Uploaded')}</dt><dd>{date(current.uploadedAt)}</dd></div><div><dt>{text('วันที่ถ่าย','Captured')}</dt><dd>{date(current.takenAt)}</dd></div>{current.reviewedAt&&<div><dt>{text('บันทึกผลตรวจ','Reviewed')}</dt><dd>{date(current.reviewedAt)}</dd></div>}</dl>
     {broken&&<p role="alert" className={styles.error}>{text('โหลดรูปไม่สำเร็จ กรุณาปิดแล้วเปิดใหม่ก่อนยืนยัน','Image failed to load. Close and reopen before confirming.')}</p>}
     {error&&<p ref={feedback} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}{message&&<p role="status" className={styles.success}>{message}</p>}
     {!reviewed(current)&&<p className={styles.note}>{current.kind==='video'?text('กรุณาเล่นวิดีโอและตรวจเนื้อหาก่อนยืนยัน การเปิดหน้านี้ยังไม่ถือว่าตรวจแล้ว','Play and inspect the video before confirming. Opening this view does not mark it reviewed.'):text('ตรวจรูปให้ชัดเจนก่อนยืนยัน การเปิดดูรูปยังไม่ถือว่าตรวจแล้ว','Inspect the photo before confirming. Opening it does not mark it reviewed.')}</p>}
    </div><footer className={styles.actions}>{!reviewed(current)?<button type="button" className={styles.primary} disabled={busy||broken} onClick={()=>void confirm()}>{busy?text('กำลังบันทึก…','Saving…'):text('ยืนยันว่าได้ตรวจสื่อนี้แล้ว','Confirm media reviewed')}</button>:next?<button type="button" className={styles.primary} disabled={busy} onClick={()=>{setSelected(next.id);setMessage('');setError('');}}>{text('ตรวจรายการถัดไปที่รอ','Inspect next pending item')} →</button>:<span className={styles.success}>{text('ตรวจสื่อครบแล้ว กลับไปตรวจผลการพิจารณา Villa ได้','All media reviewed. Return to the Villa decision after checking documents.')}</span>}<button type="button" className={styles.secondary} disabled={busy} onClick={()=>setSelected(null)}>{text('กลับรายการสื่อ','Back to media list')}</button></footer>
   </>}
  </dialog>
 </section>;
}
