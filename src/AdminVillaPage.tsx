import VillaArchiveAction from "./VillaArchiveAction";
import useConfirmDialog from './useConfirmDialog';
import RegistryBankVerification from "./RegistryBankVerification";
import Reviews from "./Reviews";
import {uiText} from "./uiLanguage";
import OwnerVerification from "./OwnerVerification";
import {lastAdminPage} from "./navigation";
import {useEffect,useState} from 'react'
import {api} from './api'
import {PortalShell,type Page} from './prototype'
import PropertyMedia from './PropertyMedia'
import type {Details} from './PropertyDetails'
type Villa={id:string;name:string;package_id:string;qr:string|null;status:string;guest_capacity:number|null;details:Details|null}
const empty:Details={isDemo:false,description:'',location:'',guestCapacity:1,bedrooms:1,bathrooms:1,amenities:[],rules:[],checkIn:'',checkOut:'',notice:''}
export default function AdminVillaPage({id,go}:{id:string;go:(page:Page,item?:string)=>void}){
 const {confirm,dialog}=useConfirmDialog();
 const [villa,setVilla]=useState<Villa|null>(null),[draft,setDraft]=useState<Details>(empty),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{let active=true;void api<{villas:Villa[]}>('/admin/villa-pages?villaId='+encodeURIComponent(id)).then(data=>{if(!active)return;const v=data.villas[0];if(!v)throw Error('ไม่พบที่พัก');setVilla(v);const initial=v.details||{...empty,guestCapacity:v.guest_capacity??1};setDraft(initial);setSaved(JSON.stringify(initial))}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[id])
 const dirty=JSON.stringify(draft)!==saved
 const back=async()=>{if(!dirty||await confirm(uiText('มีข้อมูลที่ยังไม่บันทึก ต้องการกลับหรือไม่?'))){const previous=lastAdminPage();go(previous.page,previous.item)}}
 return <PortalShell role="Admin" page="admin-villa-page" go={go}>{dialog}<div className="portal-head"><div><h1>{uiText("จัดการหน้ารายละเอียดที่พัก")}</h1><p>{villa?.name||uiText("กำลังโหลดข้อมูล…")}{uiText(" · ใช้ได้ทุกแพ็กเกจ · ไม่มีโฆษณาในหน้าที่พัก")}</p></div><button type="button" onClick={back}>{uiText("กลับหน้าก่อนหน้า")}</button></div>{error&&<p role="alert">{uiText(error)}</p>}{message&&<p role="status">{uiText(message)}</p>}{villa&&<><VillaArchiveAction id={id} name={villa.name} admin onChanged={()=>window.location.reload()}/><p>{uiText("แพ็กเกจ: ")}{villa.package_id}</p>{villa.package_id==="basic"?<section className="merchant-panel"><p>{uiText("Basic Verify ไม่ต้องยืนยันเจ้าของบ้าน")}</p></section>:<div id="villa-owner-verification"><OwnerVerification admin villaId={id}/></div>}<form className="merchant-panel portal-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{const result=await api<{details:Details}>('/admin/villa-pages',{id,details:draft});setDraft(result.details);setSaved(JSON.stringify(result.details));setMessage('บันทึกหน้ารายละเอียดแล้ว')}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{setBusy(false)}}}>
 {([['description',uiText("เกี่ยวกับที่พัก")],['location',uiText("ทำเลที่พัก")],['checkIn',uiText("เวลาเช็กอิน")],['checkOut',uiText("เวลาเช็กเอาต์")],['notice',uiText("หมายเหตุ")]] as const).map(([key,label])=><label key={key}>{uiText(label)}<textarea aria-label={label} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
 {([['guestCapacity',uiText("จำนวนผู้เข้าพัก")],['bedrooms',uiText("ห้องนอน")],['bathrooms',uiText("ห้องน้ำ")]] as const).map(([key,label])=><label key={key}>{uiText(label)}<input aria-label={label} type="number" min="0" max="10000" required value={draft[key]??""} onChange={e=>setDraft({...draft,[key]:e.target.value===""?1:Number(e.target.value)})}/></label>)}
 {([['amenities',uiText("สิ่งอำนวยความสะดวก")],['rules',uiText("ข้อกำหนดการเข้าพัก")]] as const).map(([key,label])=><label key={key}>{uiText(label)}{uiText(" (หนึ่งรายการต่อบรรทัด)")}<textarea aria-label={label} value={draft[key].join('\n')} onChange={e=>setDraft({...draft,[key]:e.target.value.split('\n')})}/></label>)}
 <div className="button-row"><button className="primary-button" disabled={busy||!dirty}>{uiText("บันทึกหน้ารายละเอียด")}</button>{villa.qr&&<button type="button" className="outline-button" onClick={()=>go("admin-verify",villa.qr||"")}>{uiText("ดูรายละเอียด")}</button>}</div><p>{uiText("บันทึกแล้วมีผลกับหน้าที่พักทันที และเก็บประวัติการเปลี่ยนแปลงไว้")}</p></form><RegistryBankVerification villaId={id}/><PropertyMedia villaId={id} mode="admin"/><Reviews villaId={id} mode="admin"/></>}</PortalShell>
}
