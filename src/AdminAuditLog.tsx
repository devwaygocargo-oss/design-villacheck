"use client";
import {useEffect,useState} from 'react';
import {useUiLanguage} from "./uiLanguage";
import {api,currentAccount} from './api';
export default function AdminAuditLog(){
 const {locale}=useUiLanguage();const t=(th:string,en:string)=>locale==="en"?en:th;
 const [rows,setRows]=useState<{id:string;kind:string;targetId:string;actorId:string|null;at:string;outcome:string;reason:string;effectiveRole?:string;effectivePermission?:string;previousStatus?:string;newStatus?:string;requestId?:string;action?:string}[]>([]),[error,setError]=useState('');
 useEffect(()=>{void currentAccount().then(()=>api<{decisions:typeof rows}>('/admin/audit-log')).then(r=>setRows(r.decisions)).catch(e=>setError(e.message));},[]);
 return <section><h1>{t("ประวัติการอนุมัติชำระเงินและ KYC","Payment and KYC decision audit")}</h1>{error&&<p role="alert">{error}</p>}<p>{t("แสดงผู้ดำเนินการ เวลา ผลการตรวจ และสถานะก่อน–หลัง ไม่อนุญาตแก้ไขหรือลบประวัติผ่านหน้านี้","Shows actor, time, outcome and status transition. Records cannot be edited or deleted here.")}</p>{rows.map(r=><article key={r.id}><p>{r.kind} · {r.outcome} · {new Date(r.at).toLocaleString(locale==='en'?'en-GB':'th-TH',{timeZone:'Asia/Bangkok'})}</p><p>{t("ผู้ดำเนินการ:","Actor:")} {r.actorId||t('ผู้ให้บริการที่ผ่านการตรวจสอบ','Verified provider')} · {t("รายการ:","Target:")} {r.targetId}</p>{r.effectiveRole&&<p>{t("สิทธิ์ที่ใช้:","Permission used:")} {r.effectiveRole} · {r.effectivePermission}</p>}{r.previousStatus&&<p>{t("สถานะ:","Status:")} {r.previousStatus} → {r.newStatus} · {r.action}</p>}{r.requestId&&<p>{t("เลขติดตามคำขอ:","Correlation ID:")} {r.requestId}</p>}<p>{r.reason}</p></article>)}</section>;
}
