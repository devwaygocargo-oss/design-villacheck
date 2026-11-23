import {useCallback,useEffect,useRef,useState} from "react";

const navigationTimeoutMs=10_000;

export default function useOAuthNavigation(){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const mounted=useRef(false),generation=useRef(0),departed=useRef(false);
 const phase=useRef<"idle"|"preparing"|"navigating">("idle");
 const timer=useRef<number|undefined>(undefined);
 const pending=useRef<AbortController|null>(null);
 const clearTimer=useCallback(()=>{if(timer.current!==undefined){window.clearTimeout(timer.current);timer.current=undefined;}},[]);
 const release=useCallback((message?:string)=>{
  generation.current++;pending.current?.abort();pending.current=null;phase.current="idle";departed.current=false;clearTimer();
  if(mounted.current){setBusy(false);if(message)setError(message);}
 },[clearTimer]);
 useEffect(()=>{
  mounted.current=true;
  const show=(event:PageTransitionEvent)=>{if(event.persisted||departed.current)release();};
  const hide=()=>{departed.current=true;generation.current++;pending.current?.abort();pending.current=null;clearTimer();};
  const focus=()=>{if(departed.current&&phase.current==="navigating")release();};
  const visibility=()=>{if(phase.current!=="navigating")return;if(document.hidden)departed.current=true;else focus();};
  window.addEventListener("pageshow",show);window.addEventListener("pagehide",hide);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",visibility);
  return()=>{mounted.current=false;generation.current++;pending.current?.abort();pending.current=null;clearTimer();window.removeEventListener("pageshow",show);window.removeEventListener("pagehide",hide);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",visibility);};
 },[clearTimer,release]);
 const start=useCallback(async(prepare:(signal:AbortSignal)=>string|Promise<string>)=>{
  if(!mounted.current||phase.current!=="idle")return;
  const controller=new AbortController();pending.current=controller;
  const attempt=++generation.current;phase.current="preparing";departed.current=false;setBusy(true);setError("");
  timer.current=window.setTimeout(()=>release("เปิดหน้าล็อกอินไม่สำเร็จ กรุณาลองอีกครั้ง"),navigationTimeoutMs);
  try{
   const url=await prepare(controller.signal);
   if(!mounted.current||attempt!==generation.current)return;
   phase.current="navigating";window.location.assign(url);
  }catch(cause){if(mounted.current&&attempt===generation.current)release(cause instanceof Error?cause.message:"เชื่อมบัญชีไม่สำเร็จ");}
 },[release]);
 return {busy,error,start};
}
