"use client";
import {useEffect,useState} from "react";
import {api} from "./api";
export type WorkspaceEntry={id:"user"|"merchant"|"admin"|"owner";href:string};
const labels={user:"User",merchant:"Merchant",admin:"Admin",owner:"Business Owner"};
export default function WorkspaceNavigation(){
 const [items,setItems]=useState<WorkspaceEntry[]>([]);
 useEffect(()=>{
  let active=true,revision=0;
  const refresh=async()=>{
   const request=++revision;
   setItems([]);
   try{
    const response=await api<{workspaces:WorkspaceEntry[]}>("/phase2/workspaces");
    let entries=response.workspaces;
    if(!entries.some(w=>w.id==="owner")){
     try{
      const capability=await api<{canBindOwner?:boolean}>("/phase2/catalog");
      if(capability.canBindOwner===true)entries=[...entries,{id:"owner",href:"/owner?context=admin"}];
     }catch{/* Never infer Owner capability from a failed request. */}
    }
    if(active&&request===revision)setItems(entries);
   }catch{if(active&&request===revision)setItems([]);}
  };
  const reload=()=>{void refresh();};
  reload();
  window.addEventListener("auth-session-changed",reload);
  window.addEventListener("focus",reload);
  return()=>{active=false;revision++;window.removeEventListener("auth-session-changed",reload);window.removeEventListener("focus",reload);};
 },[]);
 if(!items.length)return null;
 return <nav className="workspace-switcher" aria-label="เปลี่ยนพื้นที่ทำงาน / Switch workspace"><strong>พื้นที่ทำงาน / Workspaces</strong>{items.map(w=><a key={w.id} href={w.id==="owner"?"/owner?context=admin":w.href}>{labels[w.id]}</a>)}</nav>;
}
