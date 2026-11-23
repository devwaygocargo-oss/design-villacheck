"use client";
import {useEffect} from "react";
import {api} from "../../src/api";
import type {WorkspaceEntry} from "../../src/WorkspaceNavigation";
export default function MembershipCompatibility(){
 useEffect(()=>{let active=true;void api<{workspaces:WorkspaceEntry[]}>("/phase2/workspaces").then(({workspaces})=>{if(!active)return;const target=workspaces.find(w=>w.id==="admin")||workspaces.find(w=>w.id==="merchant")||workspaces.find(w=>w.id==="user")||workspaces.find(w=>w.id==="owner");window.location.replace(target?target.href+(target.id==="owner"?"":"#page="+(target.id==="admin"?"admin-membership":target.id==="merchant"?"owner-membership":"user-membership")):"/login")}).catch(()=>{if(active)window.location.replace("/login")});return()=>{active=false}},[]);
 return <main><h1>กำลังเปิดพื้นที่บัญชี / Opening your workspace…</h1></main>;
}
