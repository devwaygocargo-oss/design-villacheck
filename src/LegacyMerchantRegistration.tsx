import {useRef,useState} from "react";
import OtpLogin from "./OtpLogin";
import {api,currentAccount} from "./api";
import {uiText} from "./uiLanguage";
import {MerchantApplicationError,MerchantApplicationInputs,MerchantApplicationSummary,emptyMerchantFields,submitMerchantApplication,validateMerchantFiles,validateMerchantFields,type MerchantApplicationRecord} from "./MerchantApplication";
import type {Account} from "./merchantStore";

export default function PublicMerchantRegistration({onRegistered,onBack}:{onRegistered:(account:Account)=>void|Promise<void>;onBack:()=>void}){
 const [fields,setFields]=useState(emptyMerchantFields),[files,setFiles]=useState<File[]>([]),[consent,setConsent]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(""),[verified,setVerified]=useState<Account|null>(null),[application,setApplication]=useState<MerchantApplicationRecord|null>(null);
 const requestId=useRef(crypto.randomUUID());
 const [destination]=useState(()=>{try{const key="villacheck:merchant-signup-contact",value=sessionStorage.getItem(key);sessionStorage.removeItem(key);const stored=value?JSON.parse(value):null;return stored&&typeof stored.destination==="string"&&stored.destination.length<=254&&Date.now()-stored.created<300000?stored.destination:"";}catch{return "";}});
 const submit=async(account:Account)=>{
  setVerified(account);setBusy(true);setProgress(0);setError("");
  try{validateMerchantFields(fields);await currentAccount();const result=await submitMerchantApplication({action:"submit",requestId:requestId.current,expectedRevision:0,fields,consent},files,setProgress);setApplication(result.application);setFiles([]);}
  catch(e){setError(e instanceof Error?e.message:"merchant.application.failed");}
  finally{setBusy(false);}
 };
 return <section className="public-merchant-registration">
  <p className="merchant-registration-open" role="status">{uiText("merchant.application.open")}</p>
  {destination&&<p className="merchant-registration-contact">{uiText("merchant.registration.required")}{" · "}{destination}</p>}
  {application&&verified?<><h2>{uiText("merchant.application.success")}</h2><MerchantApplicationSummary application={application}/><button type="button" className="primary-button" onClick={()=>void onRegistered(verified)}>{uiText("merchant.application.dashboard")}</button></>:verified?<div><p>{uiText("merchant.application.verifiedRetry")}</p><form className="form-stack" onSubmit={e=>{e.preventDefault();void submit(verified);}}><MerchantApplicationInputs fields={fields} onChange={setFields} files={files} onFiles={next=>{setFiles(next);setError("");}} disabled={busy}/><label className="merchant-application-consent"><input type="checkbox" required checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>{uiText("merchant.application.consent")}</span></label><MerchantApplicationError message={error}/>{busy&&<p role="status">{uiText("merchant.application.uploading")} {progress}%</p>}<button type="submit" className="primary-button" disabled={busy}>{uiText(busy?"merchant.application.uploading":"merchant.application.retry")}</button></form><button type="button" className="outline-button" disabled={busy} onClick={()=>void api<{application:MerchantApplicationRecord|null}>("/merchant/registration").then(result=>{if(result.application){setApplication(result.application);setError("");}}).catch(e=>setError(e.message))}>{uiText("merchant.application.refresh")}</button><button type="button" className="outline-button" disabled={busy} onClick={()=>void onRegistered(verified)}>{uiText("merchant.application.dashboard")}</button></div>:!ready?<form className="form-stack" onSubmit={e=>{e.preventDefault();setError("");try{validateMerchantFields(fields);validateMerchantFiles(files);if(!consent)throw Error(uiText("merchant.application.consentRequired"));setReady(true);}catch(e){setError(e instanceof Error?e.message:"merchant.application.failed");}}}>
   <MerchantApplicationInputs fields={fields} onChange={setFields} files={files} onFiles={next=>{setFiles(next);setError("");}}/>
   <label className="merchant-application-consent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{uiText("merchant.application.consent")}</span></label>
   <p>{uiText("merchant.application.verificationNotice")}</p><MerchantApplicationError message={error}/><button type="submit" className="primary-button">{uiText("merchant.registration.continue")}</button>
  </form>:<>
   <p>{fields.businessName} / {fields.businessNameEn}</p><p>{uiText("merchant.application.verificationNotice")}</p>
   <OtpLogin accountType="merchant" purpose="register" registration={{name:fields.businessName,businessNameEn:fields.businessNameEn}} initialDestination={destination} onBusyChange={setBusy} onAuthenticated={submit}/>
   <button type="button" className="outline-button" disabled={busy} onClick={()=>setReady(false)}>{uiText("merchant.registration.edit")}</button>
  </>}
  {!verified&&<button type="button" className="outline-button" disabled={busy} onClick={onBack}>{uiText("merchant.registration.back")}</button>}
 </section>;
}
