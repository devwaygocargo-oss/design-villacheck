"use client";
import {useRef,useState} from "react";
import {loadOmise,safeProviderUrl} from "./OmiseCheckout";
export type Phase2Checkout={enabled:boolean;publicKey:string|null;attempt:{status:string;qrImage:string|null;authorizeUri:string|null}|null};
export default function Phase2Payment({orderId,amount,canPay,checkout,request,updated}:{orderId:string;amount:number;canPay:boolean;checkout:Phase2Checkout;request:<T>(path:string,data?:unknown)=>Promise<T>;updated:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[payment,setPayment]=useState(checkout.attempt),lock=useRef(false);
 async function act(action:"checkout"|"status"|"cancel"){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{
   let source:string|undefined;
   if(action==="checkout"){
    if(!canPay||!checkout.enabled||!/^pkey_test_[A-Za-z0-9]+$/.test(checkout.publicKey||""))throw Error("Omise Test ยังไม่พร้อม");
    const sdk=await loadOmise();sdk.setPublicKey(checkout.publicKey!);
    source=await new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("สร้างวิธีชำระไม่สำเร็จ กรุณาตรวจสถานะก่อนลองใหม่")),15000);sdk.createSource("promptpay",{amount,currency:"THB"},(status,value)=>{clearTimeout(timer);if(status===200&&value.livemode===false&&/^src_test_[a-z0-9]+$/.test(value.id||""))resolve(value.id!);else reject(Error("สร้าง Omise Test source ไม่สำเร็จ"));});});
   }
   const result=await request<{checkout:{qrImage:string|null;authorizeUri:string|null};order:{status:string}}>("/phase2/payment",{orderId,action,...(source?{source}:{})});
   setPayment({...result.checkout,status:result.order.status});updated();
  }catch(e){setError(e instanceof Error?e.message:"ตรวจสอบชำระเงินไม่สำเร็จ");}finally{lock.current=false;setBusy(false);}
 }
 const qr=safeProviderUrl(payment?.qrImage,"qr"),authorize=safeProviderUrl(payment?.authorizeUri,"authorize");
 return <div><h4>Omise Sandbox</h4><p>ใช้ทดสอบเท่านั้น ห้ามใช้แอปธนาคารจริงชำระ QR ทดสอบ</p>{!checkout.enabled&&<p>BLOCKED — รอ Omise Test keys และการตั้งค่าที่ได้รับอนุญาต</p>}{error&&<p role="alert">{error}</p>}{busy&&<p role="status">กำลังตรวจสอบกับ Server</p>}{payment&&<p>สถานะผู้ให้บริการ: {payment.status}</p>}{canPay&&!payment&&<button type="button" disabled={busy||!checkout.enabled} onClick={()=>void act("checkout")}>เริ่ม Omise Sandbox</button>}{canPay&&!payment&&<button type="button" disabled={busy||!checkout.enabled} onClick={()=>void act("cancel")}>ยกเลิกก่อนเริ่มชำระ</button>}{qr&&<img src={qr} width={256} height={256} style={{maxWidth:"100%",height:"auto"}} alt="Omise Test QR" referrerPolicy="no-referrer"/>}{authorize&&<a href={authorize} rel="noreferrer">ไปหน้ายืนยัน Omise Test</a>}<button type="button" disabled={busy||!checkout.enabled} onClick={()=>void act("status")}>ตรวจผล Omise จาก Server</button></div>;
}
