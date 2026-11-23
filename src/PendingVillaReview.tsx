import {useEffect,useRef,useState} from "react";
import {localeTag,uiText,useUiLanguage} from "./uiLanguage";
import DemoPhoto from "./DemoPhoto";
import PrivateDocumentPreview from "./PrivateDocumentPreview";
import OwnershipDocuments from "./OwnershipDocuments";
import AdminVillaMedia from "./AdminVillaMedia";
import VillaEntitlements from "./VillaEntitlements";
import type {MerchantVilla} from "./merchantStore";
import type {PackagePlan} from "./packagePlans";
import type {Page} from "./prototype";
import "./pending-review.css";

const verificationLevels=["REGISTERED","BASIC_CHECKED","VERIFIED","PREMIUM_VERIFIED"];
type Props={villa:MerchantVilla;busy:boolean;onReview:(villa:MerchantVilla,status:string,reason:string,level:string)=>Promise<void>;plan?:PackagePlan;packageError:string;go:(page:Page,item?:string)=>void;feedback:string;onMediaChanged?:()=>void};

export default function PendingVillaReview({villa,busy,onReview,plan,packageError,go,feedback,onMediaChanged}:Props){
 const {locale}=useUiLanguage(),en=locale==="en";
 const copy=(th:string,english:string)=>en?english:th;
 const [reason,setReason]=useState(""),[level,setLevel]=useState(villa.packageId==="basic"?"BASIC_CHECKED":"VERIFIED");
 const [tab,setTab]=useState("overview"),[failedCover,setFailedCover]=useState<string|null>(null),[coverAttempt,setCoverAttempt]=useState(0);
 const reasonInput=useRef<HTMLTextAreaElement>(null),feedbackRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(feedback){feedbackRef.current?.focus({preventScroll:true});feedbackRef.current?.scrollIntoView({block:"nearest"});}},[feedback]);
 const maximumIndex=verificationLevels.indexOf(plan?.maximumVerificationLevel||"");
 const allowedLevels=verificationLevels.slice(0,maximumIndex+1);
 useEffect(()=>{const levels=verificationLevels.slice(0,maximumIndex+1);setLevel(current=>levels.includes(current)?current:levels[levels.length-1]||"REGISTERED");},[maximumIndex]);
 const request=villa.reviewRequest,hasCover=!!villa.photoUrl&&villa.photoUrl!=="/villa-placeholder.svg",coverFailed=failedCover===villa.photoUrl;
 const reviewedAt=Date.parse(villa.photoReviewedAt||""),uploadedAt=Date.parse(villa.photoUploadedAt||"");
 const coverReviewed=hasCover&&Number.isFinite(reviewedAt)&&(!Number.isFinite(uploadedAt)||reviewedAt>=uploadedAt);
 const feedbackNotice=feedback?<p ref={feedbackRef} tabIndex={-1} role="status" className="form-message pending-review-feedback">{uiText(feedback)}</p>:null;
 const tabs=[["overview",copy("ข้อมูลที่พัก","Property details")],["documents",copy("เอกสาร","Documents")],["media",copy("รูปภาพและวิดีโอ","Photos and videos")],["decision",copy("ผลการพิจารณา","Review decision")]];
 const prefix="pending-"+villa.id;
 const decide=(status:string)=>{if(["changes","rejected"].includes(status)&&!reason.trim())reasonInput.current?.focus();void onReview(villa,status,reason,level);};
 const fields=[
  [uiText("Merchant"),villa.merchant],[uiText("อีเมล"),villa.email],[uiText("เบอร์โทร"),villa.phone],
  [uiText("ธนาคาร"),villa.bankName],[uiText("ชื่อบัญชี"),villa.accountName],[uiText("เลขบัญชี"),villa.accountNumber],
  [uiText("QR เดิม"),villa.qr||uiText("ยังไม่มี QR")],
 ];
 return <article className="merchant-panel pending-villa pending-review" aria-label={copy("รออนุมัติ ","Pending review: ")+villa.name}>
  <header className="pending-review-hero">
   <figure className="pending-review-cover">
    <figcaption>{copy("รูปหน้าปก","Cover photo")}</figcaption>
    <div className="pending-review-cover-frame">
     {hasCover?<DemoPhoto key={villa.photoUrl+coverAttempt} src={villa.photoUrl} demo={villa.demoImage} alt={copy("รูปหน้าปก ","Cover photo: ")+villa.name} onError={()=>setFailedCover(villa.photoUrl)}/>:<p className="pending-review-no-cover">{copy("ยังไม่ได้แนบรูปหน้าปก","No cover photo attached")}</p>}
    </div>
    {hasCover&&<a className="pending-review-cover-link" href={villa.photoUrl} target="_blank" rel="noopener noreferrer">{copy("เปิดรูปปกขนาดเต็ม ↗","Open full-size cover ↗")}</a>}
    {hasCover&&coverFailed&&<div role="status" className="pending-review-cover-error"><p>{copy("โหลดรูปหน้าปกไม่สำเร็จ","Unable to load the cover photo")}</p><button type="button" className="outline-button" onClick={()=>{setFailedCover(null);setCoverAttempt(value=>value+1)}}>{copy("โหลดรูปอีกครั้ง","Retry image")}</button></div>}
   </figure>
   <div className="pending-review-summary">
    <span className="pending-review-status">{request?.startedAt?copy("อยู่ระหว่างการพิจารณา","Under review"):copy("รอตรวจสอบ","Awaiting review")}</span>
    <h2>{en?villa.nameEn||villa.name:villa.name}</h2>
    <dl className="pending-review-facts">
     <div><dt>{uiText("จังหวัด")}</dt><dd>{uiText(villa.province)}</dd></div>
     <div><dt>{uiText("จำนวนผู้เข้าพักสูงสุด")}</dt><dd>{villa.guestCapacity==null?uiText("ไม่ได้ระบุ"):copy(villa.guestCapacity+" คน",villa.guestCapacity+" guests")}</dd></div>
     <div><dt>{uiText("แพ็กเกจ")}</dt><dd>{uiText(villa.package)}</dd></div>
    </dl>
    <div className="pending-review-reason"><strong>{copy("รายการที่ต้องตรวจ","What needs review")}</strong><p>{uiText(request?.summary||"รอตรวจเอกสารกรรมสิทธิ์และข้อมูล Villa")}</p><small>{uiText("ส่งตรวจ: ")}{request?.submittedAt?new Date(request.submittedAt).toLocaleString(localeTag(),{timeZone:"Asia/Bangkok"}):uiText("ไม่มีประวัติเวลาส่งตรวจเดิม")}{request?.submittedBy?uiText(` · ผู้ส่ง: ${request.submittedBy}`):""}</small></div>
    <div className="button-row"><button type="button" className="outline-button" onClick={()=>go("admin-villa-page",villa.id)}>{uiText("จัดการหน้ารายละเอียด")}</button>{!request?.startedAt&&<button type="button" className="primary-button" disabled={busy} onClick={()=>void onReview(villa,"begin","",level)}>{copy("เริ่มตรวจรายการนี้","Start review")}</button>}</div>
   </div>
  </header>
  {tab!=="decision"&&feedbackNotice}
  <div className="pending-review-tabs" role="tablist" aria-label={copy("ส่วนตรวจสอบที่พัก","Property review sections")}>
   {tabs.map(([id,label],index)=><button key={id} id={prefix+"-tab-"+id} type="button" role="tab" aria-selected={tab===id} aria-controls={prefix+"-panel-"+id} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={event=>{const next=event.key==="ArrowRight"?(index+1)%tabs.length:event.key==="ArrowLeft"?(index+tabs.length-1)%tabs.length:event.key==="Home"?0:event.key==="End"?tabs.length-1:-1;if(next<0)return;event.preventDefault();setTab(tabs[next][0]);document.getElementById(prefix+"-tab-"+tabs[next][0])?.focus();}}>{label}</button>)}
  </div>
  <section className="pending-review-panel" role="tabpanel" id={prefix+"-panel-overview"} aria-labelledby={prefix+"-tab-overview"} hidden={tab!=="overview"} tabIndex={0}>
   {!!request?.changes.length&&<div className="pending-change-table" role="region" aria-label={uiText("ตารางข้อมูลที่เปลี่ยน เลื่อนแนวนอนได้")} tabIndex={0}><table><caption>{uiText("ข้อมูลที่เปลี่ยนเพื่อให้ Admin ตรวจสอบ")}</caption><thead><tr><th>{uiText("รายการ")}</th><th>{uiText("ก่อนแก้ไข")}</th><th>{uiText("ข้อมูลที่ส่งใหม่")}</th></tr></thead><tbody>{request.changes.map(change=><tr key={change.field}><th>{uiText(change.label)}</th><td>{change.before||uiText("ไม่ได้ระบุ")}</td><td>{change.after||uiText("ไม่ได้ระบุ")}</td></tr>)}</tbody></table></div>}
   <h3>{copy("ผู้ประกอบการและข้อมูลรับเงิน","Operator and payment account")}</h3>
   <dl className="pending-villa-fields">{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||uiText("ไม่ได้ระบุ")}</dd></div>)}</dl>
   {villa.propertyDescription&&<div><h3>{copy("รายละเอียดที่พัก","Property description")}</h3><p className="cms-prose">{villa.propertyDescription}</p></div>}
   <details className="pending-review-package"><summary>{copy("แพ็กเกจและสิทธิ์ของที่พัก","Package and property entitlements")}</summary><VillaEntitlements villa={villa} plan={plan} error={packageError} go={go}/></details>
  </section>
  <section className="pending-review-panel" role="tabpanel" id={prefix+"-panel-documents"} aria-labelledby={prefix+"-tab-documents"} hidden={tab!=="documents"} tabIndex={0}>
   <div className="pending-review-original-document"><h3>{villa.packageId==="basic"?uiText("เอกสารเบื้องต้นที่แนบ"):uiText("เอกสารกรรมสิทธิ์ที่แนบ")}</h3><p>{villa.document.name}</p>
    {/dummy|demo|sample/i.test(villa.document.name)&&<p className="form-message" role="note">{uiText("DUMMY / เอกสารจำลองสำหรับทดสอบเท่านั้น ไม่ใช่หลักฐานกรรมสิทธิ์จริง")}</p>}
    <div className="button-row"><a className="outline-button" href={`${villa.document.data}?preview=1`} target="_blank" rel="noreferrer">{uiText("เปิดดูเอกสารที่แนบ")}</a><a className="outline-button" href={villa.document.data} download={villa.document.name}>{uiText("ดาวน์โหลดเอกสาร")}</a></div>
    {villa.document.type.startsWith("image/")&&<PrivateDocumentPreview className="merchant-document" src={villa.document.data+"?preview=1"} alt={uiText(`เอกสารกรรมสิทธิ์ ${villa.name}`)}/>}
    {villa.document.type==="application/pdf"&&<details><summary>{uiText("แสดง PDF ที่แนบ")}</summary><iframe className="pending-document-preview" title={uiText(`เอกสาร ${villa.document.name}`)} src={`${villa.document.data}?preview=1`}/></details>}
   </div>
   {villa.packageId==="basic"&&<p className="form-message">{uiText("Basic Verify ตรวจข้อมูลเบื้องต้น ไม่ต้องยืนยันเจ้าของบ้าน ไม่ต้องส่งภาพใบหน้าหรือทะเบียนบ้านสำหรับขั้นตอนยืนยันเจ้าของบ้าน")}</p>}
   <OwnershipDocuments villaId={villa.id} admin/>
  </section>
  <section className="pending-review-panel" role="tabpanel" id={prefix+"-panel-media"} aria-labelledby={prefix+"-tab-media"} hidden={tab!=="media"} tabIndex={0}><AdminVillaMedia villaId={villa.id} defaultOpen onChanged={onMediaChanged}/></section>
  <section className="pending-review-panel" role="tabpanel" id={prefix+"-panel-decision"} aria-labelledby={prefix+"-tab-decision"} hidden={tab!=="decision"} tabIndex={0}>
   <h3>{copy("บันทึกผลการตรวจสอบ","Record your review")}</h3><p>{copy("ตรวจข้อมูล เอกสาร และรูปภาพให้ครบก่อนเลือกผลการพิจารณา","Check the property details, documents and photos before recording your decision.")}</p>
   <div className="portal-form pending-review-decision"><label>{uiText("ระดับที่ Admin ตรวจจริง")}<select disabled={busy||!allowedLevels.length} value={level} onChange={e=>setLevel(e.target.value)}>{allowedLevels.map(value=><option key={value} value={value}>{uiText(value)}</option>)}</select></label><label>{uiText("เหตุผลขอแก้ไขหรือไม่อนุมัติ")}<textarea ref={reasonInput} rows={4} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    {packageError&&<p role="alert">{copy("โหลดแพ็กเกจไม่สำเร็จ กรุณาโหลดหน้าใหม่ก่อนอนุมัติ","Package details could not be loaded. Reload before approving.")}</p>}
    {!coverReviewed&&<div className="form-message" role="note"><p>{hasCover?copy("ต้องตรวจและยืนยันรูปปกปัจจุบันก่อนอนุมัติ Villa","Review and confirm the current cover photo before approving the Villa"):copy("ต้องให้ Merchant แนบรูปปกก่อนอนุมัติ Villa","Ask the Merchant to attach a cover photo before approving the Villa")}</p>{hasCover&&<button type="button" className="outline-button" disabled={busy} onClick={()=>setTab("media")}>{copy("ไปตรวจรูปปก","Review cover photo")}</button>}</div>}
    {feedbackNotice}
    <div className="button-row"><button type="button" className="primary-button" disabled={busy||!plan||!!packageError||!allowedLevels.includes(level)||!coverReviewed} onClick={()=>decide("approved")}>{uiText("อนุมัติ Villa")}</button><button type="button" className="outline-button" disabled={busy} onClick={()=>decide("changes")}>{uiText("ขอเอกสารเพิ่มเติม / แก้ไข")}</button><button type="button" className="danger-button" disabled={busy} onClick={()=>decide("rejected")}>{uiText("ไม่อนุมัติ")}</button></div>
   </div>
  </section>
 </article>;
}
