"use client";
import {useEffect,useState} from "react";
import {api} from "./api";
export type WorkspaceEntry={id:"user"|"merchant"|"admin"|"owner";href:string};
const labels={user:"User",merchant:"Merchant",admin:"Admin",owner:"Business Owner"};
export default function WorkspaceNavigation(){
 const [items,setItems]=useState<WorkspaceEntry[]>([]);
 useEffect(()=>{let active=true;void api<{workspaces:WorkspaceEntry[]}>("/phase2/workspaces").then(r=>{if(active)setItems(r.workspaces)}).catch(()=>{if(active)setItems([])});return()=>{active=false}},[]);
 if(!items.length)return null;
 return <nav className="workspace-switcher" aria-label="เปลี่ยนพื้นที่ทำงาน / Switch workspace"><strong>พื้นที่ทำงาน / Workspaces</strong>{items.map(w=><a key={w.id} href={w.href+(w.id==="owner"&&items.some(x=>x.id==="admin")?"?context=admin":"")}>{labels[w.id]}</a>)}</nav>;
}
