import {thaiProvinces} from '../server/thai-provinces.mjs';
import {useLocale} from './locale';
export default function ProvinceSelect({value,onChange,required=false,disabled=false}:{value:string;onChange:(value:string)=>void;required?:boolean;disabled?:boolean}){
 const {locale}=useLocale(),en=locale==='en';
 return <select required={required} disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}><option value="">{en?'Select province':'เลือกจังหวัด'}</option>{value&&!thaiProvinces.some(([th]:string[])=>th===value)&&<option value={value}>{value} · {en?'Existing value; please review':'ข้อมูลเดิม กรุณาตรวจสอบ'}</option>}{thaiProvinces.map(([th,english]:string[])=><option key={th} value={th}>{en?english:th}</option>)}</select>;
}
