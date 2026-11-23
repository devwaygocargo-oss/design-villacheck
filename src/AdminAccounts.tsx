import AdminPrivacyRequests from "./AdminPrivacyRequests";
import AdminMerchantChanges from "./AdminMerchantChanges";
import {useUiLanguage} from "./uiLanguage";
import ListPagination from "./ListPagination";
import {uiText} from "./uiLanguage";
import {localeTag} from "./uiLanguage";
import {useEffect,useState} from "react"
import {api,currentAccount} from "./api"
import {PortalShell,type Page} from "./prototype"
type Row={id:string;name:string;email:string;role:string;phone:string;address:string;business_name:string;business_name_en:string;created:string;last_login:string;access:{status:string;reason:string}}
function Account({row,busy,save}:{row:Row;busy:boolean;save:(id:string,data:unknown)=>Promise<void>}){
 const [editing,setEditing]=useState(false),[access,setAccess]=useState(false),[reason,setReason]=useState(""),[form,setForm]=useState({name:row.name,phone:row.phone||"",address:row.address||"",businessName:row.business_name||"",businessNameEn:row.business_name_en||""})
 const merchant=row.role==='merchant',suspended=row.access.status==='suspended'
 return <article className="merchant-panel"><h2>{row.name}</h2><p>{row.email} · {suspended?uiText("ระงับการเข้าสู่ระบบ"):uiText("ใช้งานได้")}</p>{merchant&&<p>{row.business_name} / {row.business_name_en}</p>}<p>{uiText("เบอร์โทร: ")}{row.phone||uiText("ยังไม่ระบุ")}{uiText(" · ที่อยู่: ")}{row.address||uiText("ยังไม่ระบุ")}</p><p>{uiText("สมัครเมื่อ: ")}{row.created?new Date(row.created).toLocaleString(localeTag()):'—'}{uiText(" · เข้าล่าสุด: ")}{row.last_login?new Date(row.last_login).toLocaleString(localeTag()):'—'}</p>{row.access.reason&&<p>{uiText("เหตุผลเปลี่ยนสถานะล่าสุด: ")}{row.access.reason}</p>}<div className="button-row"><button disabled={busy} onClick={()=>setEditing(!editing)}>{uiText("แก้ไขข้อมูล")}</button><button disabled={busy} onClick={()=>setAccess(!access)}>{suspended?uiText("เปิดการเข้าสู่ระบบ"):uiText("ระงับการเข้าสู่ระบบ")}</button></div>
 {editing&&<form className="portal-form" onSubmit={e=>{e.preventDefault();void save(row.id,{action:'profile',...form})}}>{(['name',...(merchant?['businessName','businessNameEn']:[]),'phone','address'] as (keyof typeof form)[]).map(key=><label key={key}>{({name:uiText("ชื่อผู้ติดต่อ / ชื่อสมาชิก"),businessName:uiText("ชื่อธุรกิจภาษาไทย"),businessNameEn:uiText("ชื่อธุรกิจภาษาอังกฤษ"),phone:uiText("เบอร์โทร"),address:uiText("ที่อยู่")})[key]}<input required={['name','businessName','businessNameEn'].includes(key)} maxLength={key==='address'?2000:key==='phone'?30:200} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<button className="primary-button" disabled={busy}>{uiText("บันทึกข้อมูลบัญชี")}</button></form>}
 {access&&<form className="portal-form" onSubmit={e=>{e.preventDefault();void save(row.id,{action:'access',status:suspended?'active':'suspended',reason})}}><p>{uiText("การระงับจะออกจากระบบทุกอุปกรณ์และปิดการเข้าสู่ระบบของบัญชีนี้ สถานะ QR และแพ็กเกจจัดการแยกในเมนูที่เกี่ยวข้อง")}</p><label>{uiText("เหตุผลเปลี่ยนสิทธิ์เข้าสู่ระบบ")}<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy||!reason.trim()}>{suspended?uiText("ยืนยันเปิดการเข้าสู่ระบบ"):uiText("ยืนยันระงับการเข้าสู่ระบบ")}</button></form>}

 </article>
}
export default function AdminAccounts({role,go}:{role:'user'|'merchant';go:(page:Page)=>void}){
 const {locale}=useUiLanguage(),en=locale==="en";

 const [rows,setRows]=useState<Row[]>([]),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 const [listPage,setListPage]=useState(1);
 const load=async()=>{await currentAccount();const accounts=await api<{accounts:Row[]}>('/admin/accounts?role='+role);setRows(accounts.accounts)}
 useEffect(()=>{setListPage(1);setQuery('');setFilter('all');setLoading(true);void load().catch(e=>setError(e.message)).finally(()=>setLoading(false))},[role])
 const save=async(id:string,data:unknown)=>{setBusy(true);setError('');setMessage('');try{await currentAccount();await api('/admin/accounts/'+id,data);await load();setRevision(n=>n+1);setMessage('บันทึกข้อมูลและสิทธิ์บัญชีแล้ว')}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{setBusy(false)}}
 const visible=rows.filter(r=> (filter==='all'||r.access.status===filter)&&[r.name,r.email,r.business_name,r.business_name_en,r.phone].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
 const currentPage=Math.min(listPage,Math.max(1,Math.ceil(visible.length/10)));
 const displayed=visible.slice((currentPage-1)*10,currentPage*10);
 const accountList=loading?<p>{uiText("กำลังโหลดบัญชี…")}</p>:displayed.map(row=><Account key={row.id+':'+revision} row={row} busy={busy} save={save}/>);
 return <PortalShell role="Admin" page={role==='user'?'admin-users':'admin-owners'} go={go}><h1>{role==='user'?`${uiText("จัดการ ")}User`:en?"Manage business operators":"จัดการผู้ประกอบการ"}</h1><p>{rows.length}{uiText(" บัญชี · แก้ไขข้อมูล และระงับหรือเปิดการเข้าสู่ระบบได้")}</p>{role==='merchant'&&<p>{en?'Merchants register themselves using their existing User account. Account approval is not required.':'ผู้ประกอบการสมัครด้วยบัญชี User เดิมได้เอง ไม่ต้องรออนุมัติบัญชีจาก Admin'}</p>}{error&&<p role="alert">{uiText(error)}</p>}{message&&<p role="status">{uiText(message)}</p>}<div className="merchant-toolbar"><input aria-label={uiText("ค้นหาบัญชี")} placeholder={uiText("ค้นหาชื่อ อีเมล หรือชื่อธุรกิจ ไทย / English")} value={query} onChange={e=>{setQuery(e.target.value);setListPage(1)}}/><select aria-label={uiText("สถานะบัญชี")} value={filter} onChange={e=>{setFilter(e.target.value);setListPage(1)}}><option value="all">{uiText("ทุกสถานะ")}</option><option value="active">{uiText("ใช้งานได้")}</option><option value="suspended">{uiText("ระงับการเข้าสู่ระบบ")}</option></select><button disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>{uiText("โหลดบัญชีล่าสุด")}</button></div>{!loading&&<ListPagination page={currentPage} total={visible.length} pageSize={10} onPage={setListPage} disabled={busy}/>}
 {role==='user'&&<AdminPrivacyRequests/>}{role==='merchant'&&<AdminMerchantChanges/>}{accountList}{!loading&&<ListPagination page={currentPage} total={visible.length} pageSize={10} onPage={next=>{setListPage(next);window.scrollTo({top:0})}} disabled={busy}/>}
 {!loading&&!visible.length&&<p>{uiText("ไม่พบบัญชี")}</p>}</PortalShell>
}
