import {useEffect,useId,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {uiText} from "./uiLanguage";
function Confirmation({message,resolve}:{message:string;resolve:(answer:boolean)=>void}){
 const ref=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;dialog.showModal();cancel.current?.focus();return()=>{dialog.close();};},[]);
 return createPortal(<dialog ref={ref} className="confirm-dialog" aria-modal="true" aria-labelledby={id} onKeyDown={e=>{if(e.key!=="Tab")return;const buttons=ref.current?.querySelectorAll<HTMLButtonElement>("button");if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}} onCancel={e=>{e.preventDefault();resolve(false);}}><h2 id={id}>{uiText("ยืนยันการดำเนินการ")}</h2><p>{message}</p><div className="button-row"><button type="button" ref={cancel} className="outline-button" onClick={()=>resolve(false)}>{uiText("ยกเลิก")}</button><button type="button" className="primary-button" onClick={()=>resolve(true)}>{uiText("ยืนยัน")}</button></div></dialog>,document.body);
}
export default function useConfirmDialog(){
 const [message,setMessage]=useState<string|null>(null),pending=useRef<((answer:boolean)=>void)|null>(null);
 useEffect(()=>()=>{pending.current?.(false);pending.current=null;},[]);
 const confirm=(text:string)=>{if(pending.current)return Promise.resolve(false);return new Promise<boolean>(resolve=>{pending.current=resolve;setMessage(text);});};
 const resolve=(answer:boolean)=>{const callback=pending.current;pending.current=null;setMessage(null);callback?.(answer);};
 return{confirm,dialog:message===null?null:<Confirmation message={message} resolve={resolve}/>};
}
