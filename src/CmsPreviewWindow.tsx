import {useUiLanguage,uiText} from "./uiLanguage";
import { useEffect,useState,type ReactNode } from "react"
import { createPortal } from "react-dom"

export default function CmsPreviewWindow({target,children,onClose}:{target:Window;children:ReactNode;onClose:()=>void}) {
 const {locale}=useUiLanguage();
 const [root,setRoot]=useState<HTMLElement|null>(null)
 useEffect(()=>{target.document.documentElement.lang=locale;target.document.title=uiText("Preview ก่อนเผยแพร่")+" · VillaCheck";target.document.documentElement.className=document.documentElement.className;},[locale,target,root]);
 useEffect(()=>{
  let container:HTMLElement|null=null
  const initialize=()=>{
   if(target.closed||target.location.pathname!=="/cms-preview.html")return
   const doc=target.document
   document.head.querySelectorAll('link[rel="stylesheet"],style').forEach(node=>{const copy=node.cloneNode(true) as HTMLElement;if(copy instanceof HTMLLinkElement)copy.href=(node as HTMLLinkElement).href;doc.head.appendChild(copy)})
   doc.body.style.margin="0"
   container=doc.createElement("main");container.id="cms-browser-preview";doc.body.appendChild(container);setRoot(container)
  }
  // Mount after navigation so preview resources belong to the loaded document.
  target.addEventListener("load",initialize,{once:true})
  if(target.document.readyState==="complete"&&target.location.pathname==="/cms-preview.html")initialize()
  const timer=window.setInterval(()=>{if(target.closed)onClose()},500)
  return()=>{window.clearInterval(timer);target.removeEventListener("load",initialize);container?.remove()}
 },[target,onClose])
 return root?createPortal(<div onSubmitCapture={e=>{e.preventDefault();e.stopPropagation()}} onClickCapture={e=>{if((e.target as HTMLElement).closest("a")){e.preventDefault();e.stopPropagation()}}}>{children}</div>,root):null
}
