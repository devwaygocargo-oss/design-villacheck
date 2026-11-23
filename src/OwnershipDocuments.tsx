import {t as translateSystem} from "./locale"
import PropertyWriteFieldset from "./PropertyWriteFieldset";
import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {api} from './api'
import {useLocale,formatDate,formatNumber} from './locale'
import './dashboard-documents.css'
type Doc={id:string;kind:string;name:string;status:string;remark:string;mime?:string;uploadedAt?:string;supersededAt?:string;removedAt?:string}
type Review={counts?:{documents:number};revision:number;documents:Doc[];history:{action:string;at:string;remark?:string}[];kinds:Record<string,string>}
const statusKeys:Record<string,string>={pending:'รอตรวจสอบ',accepted:'ผ่านการตรวจ',changes:'รอการแก้ไข',rejected:'ไม่ผ่านการตรวจ'}
export default function OwnershipDocuments({villaId,admin=false,onChanged,onBusyChange}:{villaId:string;admin?:boolean;onChanged?:()=>void;onBusyChange?:(busy:boolean)=>void}){
 const {t,locale}=useLocale()
 const writeLock=useRef(false)
 const [uploadProgress,setUploadProgress]=useState<{done:number;total:number}|null>(null),[uploadMessage,setUploadMessage]=useState('')
 const copy=(th:string,en:string)=>locale==='en'?en:th
 const [state,setState]=useState<Review|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[kind,setKind]=useState('ownership'),[replacement,setReplacement]=useState(''),[busy,setBusy]=useState(false),[remark,setRemark]=useState<Record<string,string>>({})
 useLayoutEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
 const path=`/${admin?'admin':'merchant'}/ownership-documents`
 const load=async(isCurrent:()=>boolean=()=>true)=>{const data=await api<Review>(path+'?villaId='+encodeURIComponent(villaId));if(isCurrent()){setState(data);setError('');setLoading(false)}}
 useEffect(()=>{let current=true;setState(null);setError('');setLoading(true);setReplacement('');void load(()=>current).catch(e=>{if(current){setError(e instanceof Error?e.message:translateSystem('โหลดเอกสารไม่สำเร็จ'));setLoading(false)}});return()=>{current=false}},[villaId,admin])
 async function perform(data:unknown){if(writeLock.current)return;writeLock.current=true;setBusy(true);setError('');setUploadProgress(null);setUploadMessage('');try{await api(path,{...(data as object),villaId,revision:state?.revision});await load();onChanged?.()}catch(e){setError(e instanceof Error?e.message:translateSystem('บันทึกไม่สำเร็จ'))}finally{writeLock.current=false;setBusy(false)}}
 async function uploadFiles(files:File[]){
  if(!files.length||!state||writeLock.current)return
  setError('');setUploadMessage('');setUploadProgress(null)
  const available=Math.max(0,10-(state.counts?.documents??0))
  if(replacement&&files.length!==1){setError(copy('การเปลี่ยนเอกสารเดิมเลือกได้ครั้งละ 1 ไฟล์','Select one file when replacing an existing document'));return}
  if(!replacement&&files.length>available){setError(copy(`เลือกได้อีก ${available} ไฟล์ โดยเอกสารรวมต้องไม่เกิน 10 ไฟล์`,`You can add ${available} more files, up to 10 documents in total`));return}
  const invalid=files.find(file=>file.size>2*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(file.type))
  if(invalid){setError(invalid.name+': '+translateSystem('รองรับ PDF, JPG, PNG ไม่เกิน 2 MB'));return}
  writeLock.current=true;setBusy(true);setUploadProgress({done:0,total:files.length})
  let done=0,revision=state.revision
  try{
   for(const file of files){
    const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error(translateSystem('อ่านไฟล์ไม่สำเร็จ')));reader.readAsDataURL(file)})
    const result=await api<Review>(path,{villaId,revision,action:'upload',kind,additional:!replacement,replacementDocumentId:replacement||undefined,file:{name:file.name,data}})
    revision=result.revision;done++;setUploadProgress({done,total:files.length})
   }
   await load();setReplacement('');setUploadMessage(copy(`อัปโหลดสำเร็จ ${done} ไฟล์`,`Uploaded ${done} files`))
  }catch(e){
   await load().catch(()=>{})
   const detail=e instanceof Error?e.message:translateSystem('บันทึกไม่สำเร็จ')
   setError(copy(`อัปโหลดสำเร็จ ${done}/${files.length} ไฟล์ หยุดที่ ${files[done]?.name||'การโหลดรายการ'}: ${detail} กรุณาตรวจรายการก่อนเลือกไฟล์ที่ยังไม่สำเร็จใหม่`,`Uploaded ${done}/${files.length} files. Stopped at ${files[done]?.name||'refreshing the list'}: ${detail}. Check the list before selecting the remaining files again.`))
  }finally{writeLock.current=false;setBusy(false);if(done)onChanged?.()}
 }
 const documents=state?.documents.filter(d=>!d.supersededAt&&!d.removedAt)||[]
 return <section className="merchant-panel ownership-documents" aria-labelledby={`ownership-documents-${villaId}`}>
  <h2 id={`ownership-documents-${villaId}`}>{translateSystem('เอกสารประกอบการตรวจสอบ')}</h2>
  <p>{translateSystem('เอกสารที่ใช้งาน')} {state?formatNumber(state.counts?.documents??0):'…'}/10 {translateSystem('ไฟล์')} · {translateSystem('ประวัติฉบับเก่ายังคงอยู่')}</p>
  <p>{translateSystem('เอกสารส่วนบุคคลเปิดได้เฉพาะเจ้าของบัญชีและผู้ดูแลที่มีสิทธิ์')} {translateSystem('การติดต่อทางโทรศัพท์ไม่ใช่การอนุมัติกรรมสิทธิ์')}</p>
  {busy&&<progress aria-label={translateSystem('กำลังบันทึกเอกสาร')}/>}
  {busy&&uploadProgress&&<p role="status">{copy('กำลังอัปโหลด','Uploading')} {uploadProgress.done}/{uploadProgress.total}</p>}
  {uploadMessage&&<p role="status">{uploadMessage}</p>}
  {loading&&<p role="status">{translateSystem('กำลังโหลดเอกสาร…')}</p>}
  {error&&<div role="alert"><p>{error}</p><button type="button" className="outline-button" disabled={busy||loading} onClick={()=>{setLoading(true);void load().catch(e=>{setError(e instanceof Error?e.message:translateSystem('โหลดเอกสารไม่สำเร็จ'));setLoading(false)})}}>{translateSystem('ลองใหม่')}</button></div>}
  {state&&<>
   {!admin&&<PropertyWriteFieldset><div className="portal-form">
    <label>{translateSystem('ประเภทเอกสาร')}<select disabled={busy||!!replacement} value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(state.kinds).map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</select></label>
    <label>{translateSystem('การแนบเอกสาร')}<select disabled={busy} value={replacement} onChange={e=>{setReplacement(e.target.value);const document=state.documents.find(d=>d.id===e.target.value);if(document)setKind(document.kind)}}><option value="">{translateSystem('เพิ่มเอกสารใหม่')}</option>{documents.filter(d=>d.status!=='pending').map(d=><option key={d.id} value={d.id}>{translateSystem('เปลี่ยนเอกสาร')} · {d.name}</option>)}</select></label>
    <p>{replacement?copy('เปลี่ยนเอกสารเดิมครั้งละ 1 ไฟล์','Replace one document at a time'):copy(`เลือกหลายไฟล์พร้อมกันได้ · เพิ่มได้อีก ${Math.max(0,10-(state.counts?.documents??0))} ไฟล์ (รวมเอกสารเดิมไม่เกิน 10 ไฟล์)`,`Select multiple files · ${Math.max(0,10-(state.counts?.documents??0))} slots available (10 documents total, including existing files)` )}</p>
    <label>{translateSystem('แนบเอกสาร PDF, JPG หรือ PNG ไม่เกิน 2 MB')}<input type="file" disabled={busy} multiple={!replacement} accept="application/pdf,image/jpeg,image/png" onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';void uploadFiles(files)}}/></label>
   </div></PropertyWriteFieldset>}
   {!documents.length&&<p className="document-empty">{translateSystem('ยังไม่มีเอกสารประกอบ')}</p>}
   <div className="document-card-list">{documents.map(document=>{
    const url=`/api/${admin?'admin/':''}documents/${document.id}`
    return <article key={document.id}>
     <div className="document-file-heading"><div><span className="kicker">{t(state.kinds[document.kind]||document.kind)}</span><h3>{document.name}</h3></div><span className={`document-status document-status-${document.status}`}>{t(statusKeys[document.status]||document.status)}</span></div>
     <dl className="document-file-meta"><div><dt>{translateSystem('ประเภท')}</dt><dd>{document.mime||translateSystem('ไม่ทราบชนิดไฟล์')}</dd></div><div><dt>{translateSystem('วันที่อัปโหลด')}</dt><dd>{document.uploadedAt?formatDate(document.uploadedAt):translateSystem('ไม่พบวันที่อัปโหลดในข้อมูลเดิม')}</dd></div></dl>
     <div className="button-row"><a className="outline-button" href={url+'?preview=1'} target="_blank" rel="noopener noreferrer">{t(document.mime==='application/pdf'?'ดู PDF':'เปิดเอกสาร')}</a><a className="outline-button" href={url} download={document.name}>{translateSystem('ดาวน์โหลด')}</a></div>
     {document.remark&&<p className="document-review-note"><strong>{translateSystem('ข้อแก้ไข')}: </strong>{document.remark}</p>}
     {!admin&&<PropertyWriteFieldset><button type="button" className="text-button" disabled={busy} onClick={()=>{const reason=window.prompt(translateSystem('ระบุเหตุผลนำเอกสารออกจากรายการปัจจุบัน (ประวัติและไฟล์เดิมจะยังคงอยู่)'));if(reason===null)return;if(!reason.trim()){setError(translateSystem('กรุณาระบุเหตุผลนำเอกสารออก'));return}void perform({action:'remove',documentId:document.id,confirm:true,reason:reason.trim()})}}>{translateSystem('นำเอกสารออกจากรายการ')}</button></PropertyWriteFieldset>}
     {admin&&document.status==='pending'&&<PropertyWriteFieldset><label>{translateSystem('หมายเหตุ / ข้อแก้ไข')}<textarea disabled={busy} value={remark[document.id]||''} onChange={e=>setRemark({...remark,[document.id]:e.target.value})}/></label><div className="button-row">{['accepted','changes','rejected'].map(status=><button type="button" key={status} disabled={busy} onClick={()=>void perform({action:'review',documentId:document.id,status,remark:remark[document.id]||''})}>{t(statusKeys[status])}</button>)}</div></PropertyWriteFieldset>}
    </article>
   })}</div>
   <details className="document-history"><summary>{translateSystem('ประวัติตรวจเอกสาร')} ({formatNumber(state.history.length)})</summary>{state.history.map((entry,index)=><p key={index}>{formatDate(entry.at,{hour:'2-digit',minute:'2-digit'})} · {t(entry.action==='review'?'ตรวจเอกสาร':entry.action==='resubmit'?'ส่งเอกสารใหม่':entry.action==='remove'?'นำเอกสารออกจากรายการ':'แนบเอกสาร')} {entry.remark}</p>)}</details>
  </>}
 </section>
}
