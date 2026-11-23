import {useUiLanguage} from "./uiLanguage";
export default function ListPagination({page,total,pageSize,onPage,disabled=false,label}:{page:number;total:number;pageSize:number;onPage:(page:number)=>void;disabled?:boolean;label?:string}){
 const {locale}=useUiLanguage(),en=locale==="en",pages=Math.max(1,Math.ceil(total/pageSize));
 if(!total)return null;
 return <nav className="list-pagination" aria-label={label||(en?"List pages":"หน้ารายการ")}>
  <span role="status">{en?`Showing ${(page-1)*pageSize+1}–${Math.min(page*pageSize,total)} of ${total}`:`แสดง ${(page-1)*pageSize+1}–${Math.min(page*pageSize,total)} จาก ${total} รายการ`}</span>
  <button type="button" className="outline-button" disabled={disabled||page<=1} onClick={()=>onPage(page-1)}>{en?"Previous":"ก่อนหน้า"}</button>
  <label><span>{en?"Page":"หน้า"}</span><select disabled={disabled} value={page} onChange={e=>onPage(Number(e.target.value))}>{Array.from({length:pages},(_,i)=><option key={i+1} value={i+1}>{en?`${i+1} of ${pages}`:`${i+1} จาก ${pages}`}</option>)}</select></label>
  <button type="button" className="outline-button" disabled={disabled||page>=pages} onClick={()=>onPage(page+1)}>{en?"Next":"ถัดไป"}</button>
 </nav>;
}
