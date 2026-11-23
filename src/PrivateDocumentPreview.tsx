import {useState} from "react";
import {useLocale} from "./locale";
// A failed preview must not obscure the review or imply a valid document.
// The caller retains the original open/download links and the private bytes.
export default function PrivateDocumentPreview({src,alt,className,loading}:{src:string;alt:string;className?:string;loading?:"eager"|"lazy"}) {
 const {locale}=useLocale();
 const [failedSource,setFailedSource]=useState<string|null>(null);
 if(failedSource===src)return <p role="status" className="document-preview-unavailable">{locale==="en"?"Unable to display this document preview. Open or download the original file to review it.":"ไม่สามารถแสดงภาพตัวอย่างเอกสารนี้ได้ กรุณาเปิดหรือดาวน์โหลดไฟล์ต้นฉบับเพื่อตรวจสอบ"}</p>;
 return <img src={src} alt={alt} className={className} loading={loading} onError={()=>setFailedSource(src)}/>;
}
