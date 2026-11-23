import {useUiLanguage} from "./uiLanguage";
export default function VillaPagination({items,selectedId,onSelect,disabled=false,label}:{items:{id:string;name:string}[];selectedId:string;onSelect:(id:string)=>void;disabled?:boolean;label:string}){
 const {locale}=useUiLanguage(),en=locale==="en";
 if(!items.length)return null;
 const index=Math.max(0,items.findIndex(item=>item.id===selectedId));
 return <nav className="villa-pagination" aria-label={label}>
  <button type="button" className="outline-button" disabled={disabled||index===0} onClick={()=>onSelect(items[index-1].id)}>{en?"Previous":"ก่อนหน้า"}</button>
  <label><span>{en?"Select Villa":"เลือก Villa"}</span><select value={items[index].id} disabled={disabled} onChange={event=>onSelect(event.target.value)}>{items.map((item,i)=><option key={item.id} value={item.id}>{i+1}. {item.name}</option>)}</select></label>
  <span role="status">{en?`Villa ${index+1} of ${items.length}`:`Villa ${index+1} จาก ${items.length}`}</span>
  <button type="button" className="outline-button" disabled={disabled||index===items.length-1} onClick={()=>onSelect(items[index+1].id)}>{en?"Next":"ถัดไป"}</button>
 </nav>;
}
