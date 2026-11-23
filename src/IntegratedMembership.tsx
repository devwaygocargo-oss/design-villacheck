"use client";
import {useEffect,useState} from "react";
import {api,currentAccount,logoutWorkspace,ApiError} from "./api";
import Phase2Workspace from "./Phase2Workspace";
import BusinessRoleManager from './BusinessRoleManager';
import type {WorkspaceEntry} from "./WorkspaceNavigation";
import type {Page} from "./prototype";
type Role="user"|"merchant"|"admin";
export default function IntegratedMembership({role}:{role:Role}){
 const [state,setState]=useState("loading");
 useEffect(()=>{let active=true;void api<{workspaces:WorkspaceEntry[]}>("/phase2/workspaces").then(r=>{if(active)setState(r.workspaces.some(w=>w.id===role)?"ready":"denied")}).catch(()=>{if(active)setState("denied")});return()=>{active=false}},[role]);
 if(state==="loading")return <p role="status">กำลังตรวจสอบสิทธิ์ / Checking access…</p>;
 if(state!=="ready")return <section><h1>ไม่มีสิทธิ์เข้าพื้นที่นี้ / Access denied</h1><p>ใช้บัญชีเดิมที่ได้รับสิทธิ์และยืนยันตัวตนแล้ว</p><a href={role==="admin"?"/admin/login":"/login"}>เข้าสู่ระบบ / Sign in</a></section>;
 return <Phase2Workspace key={role} embedded workspaceRole={role}/>;
}
export function MembershipDashboardCard({role,go}:{role:Role;go:(p:Page)=>void}){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{let active=true;void currentAccount().then(()=>api<{workspaces:WorkspaceEntry[]}>("/phase2/workspaces")).then(r=>{if(active)setVisible(r.workspaces.some(w=>w.id===role))}).catch(()=>{});return()=>{active=false}},[role]);
 if(!visible)return null;
 return <section className="merchant-panel membership-dashboard-card"><h2>แพ็กเกจและสิทธิ์สมาชิก / Membership</h2><p>ดูแพ็กเกจ สิทธิ์ Trial และวันหมดอายุในบัญชีเดิม ยังไม่เปิดรับชำระเงิน</p><button className="primary-button" onClick={()=>go(role==="admin"?"admin-membership":role==="merchant"?"owner-membership":"user-membership")}>ดูแพ็กเกจและสิทธิ์ / View membership</button></section>;
}
export function OwnerWorkspace(){
 const [manageRoles,setManageRoles]=useState(false),[canBindOwner,setCanBindOwner]=useState(false);
 useEffect(()=>{let active=true;void currentAccount().then(a=>{if(active)setManageRoles(Boolean(a.businessPermissions?.includes('roles.manage')));}).catch(()=>{});return()=>{active=false};},[]);
 const [state,setState]=useState<{workspace?:string;escalations?:{id:string;kind:string;status:string;revision:number}[];denied?:boolean;failed?:boolean}|null>(null);
 const [portal,setPortal]=useState<"admin"|"user">("user"),[dashboard,setDashboard]=useState("/dashboard"),[busy,setBusy]=useState(false),[actionsReady,setActionsReady]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;void (async()=>{
  try{const data=await api<{workspace:string;escalations:{id:string;kind:string;status:string;revision:number}[]}>("/phase2/owner-workspace");if(active)setState(data);}
  catch(e){if(!active)return;if(e instanceof ApiError&&e.status===401){window.location.replace("/owner/login");return;}if(!(e instanceof ApiError)||e.status!==403){setState({failed:true});return;}setState({denied:true});try{const c=await api<{canBindOwner?:boolean}>("/phase2/catalog");if(active)setCanBindOwner(c.canBindOwner===true);}catch{/* A failed capability check never enables access. */}}
  try{const access=await api<{sessionPortal:"admin"|"user";workspaces:WorkspaceEntry[]}>("/phase2/workspaces");if(active){setActionsReady(true);setPortal(access.sessionPortal==="admin"?"admin":"user");setDashboard(access.workspaces.find(w=>w.id==="admin")?.href||access.workspaces.find(w=>w.id==="merchant")?.href||"/dashboard");}}catch{/* Owner information remains withheld; no permission is inferred. */}
 })();return()=>{active=false}},[]);
 async function confirmOwner(){if(busy||!canBindOwner)return;setBusy(true);setError("");try{await currentAccount();await api("/phase2/owner-session",{});window.location.reload();}catch(e){setError(e instanceof Error?e.message:"Unable to confirm Owner access");setBusy(false);}}
 async function signOut(){if(busy||!actionsReady)return;setBusy(true);setError("");try{await logoutWorkspace(portal);window.location.replace(portal==="admin"?"/admin/login":"/login");}catch(e){if(e instanceof ApiError&&e.status===401)window.location.replace(portal==="admin"?"/admin/login":"/login");else{setError("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่ / Unable to sign out. Please retry.");setBusy(false);}}}
 if(!state)return <p role="status">กำลังตรวจสอบสิทธิ์ / Checking access…</p>;
 if(state.failed)return <section><h1>โหลดพื้นที่ Owner ไม่สำเร็จ / Owner workspace unavailable</h1><p role="alert">กรุณาลองใหม่ ไม่สามารถยืนยันสิทธิ์ได้ / Unable to verify access.</p><button onClick={()=>window.location.reload()}>ลองใหม่ / Retry</button><a href="/dashboard">กลับ Dashboard / Back to Dashboard</a></section>;
 const actions=<div className="button-row owner-access-actions"><button disabled={busy||!actionsReady} onClick={()=>void signOut()}>เปลี่ยนบัญชี / Switch Account</button><button disabled={busy||!actionsReady} onClick={()=>void signOut()}>ออกจากระบบ / Logout</button>{actionsReady?<a href={dashboard}>กลับ Dashboard / Back to Dashboard</a>:<span role="status">กำลังตรวจสอบ Session / Checking session…</span>}{error&&<p role="alert">{error}</p>}</div>;
 if(state.denied)return <section><h1>Business Owner — Access denied</h1><p>บัญชีนี้ยังไม่มีสิทธิ์ Business Owner ที่ได้รับอนุมัติ การเป็น Admin ไม่ได้ให้สิทธิ์ Owner โดยอัตโนมัติ</p>{canBindOwner&&<button disabled={busy} onClick={()=>void confirmOwner()}>ยืนยันสิทธิ์ Business Owner / Confirm Owner access</button>}{actions}</section>;
 return <section><h1>Business Owner workspace</h1><p>Owner มีสิทธิ์งานประจำวันของ Admin และสิทธิ์ตั้งค่าธุรกิจเพิ่มเติม การเปิดการเงินและการเผยแพร่ยังต้องผ่านเงื่อนไขระบบแยก</p>{actions}<p><a href="/admin">งานดูแลระบบ</a> · <a href="/admin#page=admin-receiving-bank">บัญชีรับเงิน</a> · <a href="/admin#page=admin-packages">ราคาแพ็กเกจ</a> · <a href="/admin#page=admin-settings">ตั้งค่าระบบ</a></p>{manageRoles&&<BusinessRoleManager/>}<h2>รายการส่งต่อ / Escalations</h2>{state.escalations?.length?state.escalations.map(e=><article key={e.id}><p>{e.kind} — {e.status}</p></article>):<p>ไม่มีรายการ / No escalations</p>}</section>;
}
