import {uiText} from "./uiLanguage";
import {localeTag} from "./uiLanguage";
import { useEffect, useState } from "react";
import { api } from "./api";
export type PaymentQrData={id:string;status:string;expiresAt:string;generatedAt:string;qrData:string|null;payload:string|null;serverTime:string;kind:string};
export default function PaymentQr({paymentId,initial}:{paymentId:string;initial:PaymentQrData|null}) {
 const [remaining,setRemaining]=useState(0);
 const [qr,setQr]=useState(initial),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const refresh=()=>void api<{paymentQr:PaymentQrData|null}>(`/payments/${paymentId}/status`).then(v=>setQr(v.paymentQr)).catch(e=>setError(e.message));
 useEffect(()=>{refresh();const timer=window.setInterval(refresh,15000);return()=>clearInterval(timer);},[paymentId]);
 useEffect(()=>{if(!qr)return;const offset=Date.parse(qr.serverTime)-Date.now();const tick=()=>{const seconds=Math.max(0,Math.ceil((Date.parse(qr.expiresAt)-Date.now()-offset)/1000));setRemaining(seconds);if(seconds===0 && qr.status==="ACTIVE")refresh();};tick();const timer=window.setInterval(tick,1000);return()=>clearInterval(timer);},[qr]);
 return <section className="payment-qr-panel"><h3>{uiText("Payment QR")}{qr?.kind==="DEMO_PAYMENT"?"(DEMO)":""}</h3><p>{uiText("QR เปิดหน้าชำระเงิน VillaCheck และแนบสลิป · ไม่ใช่ QR โอนเงินของธนาคาร")}</p>{qr?.status==="ACTIVE"&&qr.qrData&&remaining>0&&<><img style={{width:144,height:144,maxWidth:"100%",objectFit:"contain"}} width="144" height="144" src={qr.qrData} alt="Payment page QR"/><p>{uiText("เหลือ ")}{Math.floor(remaining/3600)}:{String(Math.floor(remaining/60)%60).padStart(2,"0")}:{String(remaining%60).padStart(2,"0")}{uiText(" · หมดอายุ ")}{new Date(qr.expiresAt).toLocaleString(localeTag())}</p><a href={qr.payload!}>{uiText("เปิดหน้าชำระเงิน")}</a></>}<p>{uiText("สถานะจาก Backend: ")}{qr?.status||uiText("ยังไม่มี QR")}</p>{qr?.status!=="PAID"&&<button disabled={busy} onClick={async()=>{setBusy(true);try{setQr(await api<PaymentQrData>(`/payments/${paymentId}/qr`,{}));setError("");}catch(e){setError(e instanceof Error?e.message:"สร้าง QR ไม่สำเร็จ");}finally{setBusy(false);}}}>{uiText("สร้าง Payment QR ใหม่ (3 ชั่วโมง)")}</button>}{error&&<p role="alert">{uiText(error)}</p>}</section>;
}
