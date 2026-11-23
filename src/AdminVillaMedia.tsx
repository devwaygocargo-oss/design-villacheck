import {useState} from "react";
import {useUiLanguage} from "./uiLanguage";
import PropertyMedia from "./PropertyMedia";

export default function AdminVillaMedia({villaId,defaultOpen=false,onChanged}:{villaId:string;defaultOpen?:boolean;onChanged?:()=>void}) {
 const {locale}=useUiLanguage();
 const [open,setOpen]=useState(defaultOpen);
 return <details className="admin-villa-media" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>{locale==="en"?"Review property photos and videos":"ตรวจรูปภาพและวิดีโอของที่พัก"}</summary>
  {open&&<PropertyMedia key={villaId} villaId={villaId} mode="admin" onChanged={onChanged}/>}
 </details>;
}
