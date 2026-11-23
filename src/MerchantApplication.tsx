import {useEffect,useId,useRef,useState} from "react";
import {api,currentAccount} from "./api";
import {uiText,localeTag} from "./uiLanguage";

export type MerchantApplicationFields={businessName:string;businessNameEn:string;contactName:string;address:string};
export type MerchantApplicationRecord={userId:string;revision:number;status:"pending"|"approved"|"changes"|"rejected";fields:MerchantApplicationFields;verifiedContacts:{email:string;phone:string};documents:{id:string;name:string;mime:string;size:number;url:string}[];reason:string;submittedAt:string};
const labels={pending:"merchant.application.pending",approved:"merchant.application.approved",changes:"merchant.application.changes",rejected:"merchant.application.rejected"};
export const emptyMerchantFields:MerchantApplicationFields={businessName:"",businessNameEn:"",contactName:"",address:""};
export function validateMerchantFields(fields:MerchantApplicationFields){if(Object.values(fields).some(value=>!value.trim()))throw Error(uiText("merchant.application.fieldsRequired"));}
export function validateMerchantFiles(files:File[]){if(files.length<1||files.length>3)throw Error(uiText("merchant.application.fileCount"));if(files.some(f=>f.size===0))throw Error(uiText("merchant.application.fileEmpty"));if(files.some(f=>f.size>5*1024*1024)||files.reduce((sum,f)=>sum+f.size,0)>15*1024*1024)throw Error(uiText("merchant.application.fileSize"));if(files.some(f=>!["application/pdf","image/jpeg","image/png"].includes(f.type)))throw Error(uiText("merchant.application.fileTypes"));}
export async function submitMerchantApplication(payload:Record<string,unknown>,files:File[],onProgress?:(percent:number)=>void){
 validateMerchantFiles(files);const path="/merchant/registration",ids:string[]=[],total=files.reduce((sum,file)=>sum+file.size,0);let completed=0;
 try{
  for(const [fileIndex,file]of files.entries()){
   const upload=await api<{uploadId:string;chunkBytes:number;received:number}>(path,{action:"upload_start",requestId:payload.requestId,expectedRevision:payload.expectedRevision,fileIndex,name:file.name,mime:file.type,size:file.size},{signal:AbortSignal.timeout(30000)});ids.push(upload.uploadId);
   if(upload.chunkBytes!==512*1024||!Number.isInteger(upload.received)||upload.received<0||upload.received>file.size||upload.received!==file.size&&upload.received%upload.chunkBytes!==0)throw Error(uiText("merchant.application.failed"));
   onProgress?.(Math.round((completed+upload.received)/total*100));
   for(let offset=upload.received;offset<file.size;offset+=upload.chunkBytes){
    const blob=file.slice(offset,offset+upload.chunkBytes),base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error(uiText("merchant.application.fileRead")));reader.readAsDataURL(blob);});
    await api(path,{action:"upload_part",uploadId:upload.uploadId,index:Math.floor(offset/upload.chunkBytes),base64},{signal:AbortSignal.timeout(30000)});onProgress?.(Math.round((completed+offset+blob.size)/total*100));
   }
   completed+=file.size;
  }
  return await api<{application:MerchantApplicationRecord}>(path,{...payload,uploadIds:ids},{signal:AbortSignal.timeout(30000)});
 }catch(error){await Promise.all(ids.map(uploadId=>api(path,{action:"upload_cancel",uploadId},{signal:AbortSignal.timeout(5000)}).catch(()=>{})));throw error;}
}
export function MerchantApplicationError({message}:{message:string}){
 const ref=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(message){ref.current?.focus({preventScroll:true});ref.current?.scrollIntoView({block:"center",behavior:"smooth"});}},[message]);
 return message?<p ref={ref} role="alert" tabIndex={-1} className="merchant-application-error">{uiText(message)}</p>:null;
}
export function MerchantApplicationInputs({fields,onChange,files,onFiles,disabled=false}:{fields:MerchantApplicationFields;onChange:(fields:MerchantApplicationFields)=>void;files:File[];onFiles:(files:File[])=>void;disabled?:boolean}){
 const errorId=useId();let fileError="";if(files.length){try{validateMerchantFiles(files);}catch(e){fileError=e instanceof Error?e.message:"merchant.application.failed";}}
 return <div className="merchant-application-fields">
  {(["businessName","businessNameEn","contactName"] as const).map(key=><label className="login-field" key={key}><span>{uiText("merchant.application."+key)}</span><input name={key} required maxLength={200} autoComplete={key==="contactName"?"name":"organization"} disabled={disabled} value={fields[key]} onChange={e=>onChange({...fields,[key]:e.target.value})}/></label>)}
  <label className="login-field"><span>{uiText("merchant.application.address")}</span><textarea name="address" required maxLength={2000} autoComplete="street-address" disabled={disabled} value={fields.address} onChange={e=>onChange({...fields,address:e.target.value})}/></label>
  <label className={"merchant-application-upload"+(fileError?" has-error":"")}><span>{uiText("merchant.application.documents")}</span><input name="registrationDocuments" type="file" accept="application/pdf,image/jpeg,image/png" multiple required={!files.length} disabled={disabled} aria-invalid={Boolean(fileError)} aria-describedby={fileError?errorId:undefined} onChange={e=>onFiles(Array.from(e.target.files||[]))}/><small>{uiText("merchant.application.fileHelp")}</small>{fileError&&<span id={errorId} role="alert" className="merchant-application-file-error">{uiText(fileError)}</span>}</label>
  {files.length>0&&<ul className="merchant-application-files">{files.map((f,i)=><li key={f.name+":"+i}>{f.name} ({Math.ceil(f.size/1024)} KB)</li>)}</ul>}
 </div>;
}
export function MerchantApplicationSummary({application}:{application:MerchantApplicationRecord}){
 return <div className="merchant-application-summary"><p role="status"><strong>{uiText(labels[application.status])}</strong></p><p>{uiText("merchant.application.loginContact")}{" "}{[application.verifiedContacts.email,application.verifiedContacts.phone].filter(Boolean).join(" / ")}</p>{application.reason&&<p>{uiText("merchant.application.reason")}{" "}{application.reason}</p>}<p>{uiText("merchant.application.submittedAt")}{" "}{new Date(application.submittedAt).toLocaleString(localeTag())}</p><ul>{application.documents.map(doc=><li key={doc.id}><a href={doc.url+"?preview=1"} target="_blank" rel="noreferrer">{doc.name}</a></li>)}</ul><p>{uiText("merchant.application.private")}</p><p>{uiText("merchant.application.approvalNotice")}</p></div>;
}
export default function MerchantApplication(){
 const [application,setApplication]=useState<MerchantApplicationRecord|null>(null),[fields,setFields]=useState<MerchantApplicationFields>(emptyMerchantFields),[files,setFiles]=useState<File[]>([]),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[loaded,setLoaded]=useState(false),[error,setError]=useState("");
 const requestId=useRef(crypto.randomUUID());
 const [enabled,setEnabled]=useState(false);
 const load=async()=>{const config=await api<{merchantRegistrationDocumentsEnabled?:boolean}>("/config");if(config.merchantRegistrationDocumentsEnabled!==true){setEnabled(false);return;}setEnabled(true);await currentAccount();const result=await api<{application:MerchantApplicationRecord|null}>("/merchant/registration");setApplication(result.application);if(result.application)setFields(result.application.fields);setLoaded(true);};
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 if(!enabled&&!error)return null;
 const editable=!application||["changes","rejected"].includes(application.status);
 return <section className="merchant-panel merchant-application-panel"><h2>{uiText("merchant.application.title")}</h2>{(!loaded||!editable)&&<MerchantApplicationError message={error}/>}{application&&<MerchantApplicationSummary application={application}/>}<button type="button" disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>{uiText("merchant.application.refresh")}</button>
  {loaded&&editable&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setProgress(0);setError("");try{validateMerchantFields(fields);await currentAccount();const result=await submitMerchantApplication({action:"submit",requestId:requestId.current,expectedRevision:application?.revision||0,fields,consent},files,setProgress);setApplication(result.application);setFiles([]);setConsent(false);requestId.current=crypto.randomUUID();}catch(e){setError(e instanceof Error?e.message:"merchant.application.failed");}finally{setBusy(false);}}}>
   <MerchantApplicationInputs fields={fields} onChange={setFields} files={files} onFiles={next=>{setFiles(next);setError("");}} disabled={busy}/><label className="merchant-application-consent"><input type="checkbox" required checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>{uiText("merchant.application.consent")}</span></label><MerchantApplicationError message={error}/>{busy&&<p role="status">{uiText("merchant.application.uploading")} {progress}%</p>}<button className="primary-button" disabled={busy||!consent||!files.length}>{uiText(busy?"merchant.application.uploading":"merchant.application.submit")}</button>
  </form>}
 </section>;
}
