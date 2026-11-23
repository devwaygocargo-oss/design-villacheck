import {useSyncExternalStore} from "react";
import english from "./systemEnglish.json";
import thai from "./systemThai.json";
export type Locale="th"|"en";
export const localeStorageKey="villacheck:locale";
let selected:Locale="th", initialized=false;
const listeners=new Set<()=>void>();
function initialize(){
 if(initialized||typeof window==="undefined")return;
 initialized=true;
 try{selected=localStorage.getItem(localeStorageKey)==="en"?"en":"th";}catch{/* Use session state when storage is unavailable. */}
 document.documentElement.lang=selected;
}
export function getLocale():Locale{initialize();return selected;}
export function setLocale(locale:Locale){
 initialize();selected=locale;
 if(typeof document!=="undefined")document.documentElement.lang=locale;
 try{localStorage.setItem(localeStorageKey,locale);}catch{/* The selection still works for this session. */}
 listeners.forEach(notify=>notify());
}
function subscribe(notify:()=>void){
 initialize();listeners.add(notify);
 const storage=(event:StorageEvent)=>{if(event.key===localeStorageKey)setLocale(event.newValue==="en"?"en":"th");};
 window.addEventListener("storage",storage);
 return()=>{listeners.delete(notify);window.removeEventListener("storage",storage);};
}
const en:Record<string,string>=english,th:Record<string,string>=thai;
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const templates=Object.entries(en).filter(([key])=>/\{\w+\}/.test(key)).sort(([a],[b])=>b.replace(/\{\w+\}/g,"").length-a.replace(/\{\w+\}/g,"").length).map(([key,value])=>{
 const names:string[]=[];
 const parts=key.split(/(\{\w+\})/g).map(part=>{if(/^\{\w+\}$/.test(part)){names.push(part.slice(1,-1));return "(.+?)";}return escape(part);});
 return {pattern:new RegExp("^"+parts.join("")+"$"),names,value};
});
export function translateUi(value:string,locale:Locale):string{
 const normalized=value.trim().replace(/\s+/g," ");
 if(locale==="th")return (th[value]??value).replace(/\bMerchants?\b/gi,"ผู้ประกอบการ").replace(/\bUsers?\b/gi,"ผู้ใช้").replace(/ผู้ใช้งาน/g,"ผู้ใช้");
 const exact=en[value]??en[normalized];
 if(exact!==undefined){
  const leading=value.match(/^\s+/)?.[0]||"",trailing=value.match(/\s+$/)?.[0]||"";
  return (leading&&!/^\s/.test(exact)?leading:"")+exact+(trailing&&!/\s$/.test(exact)?trailing:"");
 }
 if(!/[\u0e00-\u0e7f]/.test(value))return value;
 for(const {pattern,names,value:template} of templates){const match=value.match(pattern);if(match)return template.replace(/\{(\w+)\}/g,(part,name)=>{const index=names.indexOf(name);return index<0?part:match[index+1];});}
 return value;
}
// Call only for interface copy; never pass form values or stored user content.
export function uiText(value:string):string;
export function uiText<T>(value:T):T;
export function uiText(value:unknown):unknown{return typeof value==="string"?translateUi(value,getLocale()):value;}
export function localeTag(){return getLocale()==="en"?"en-GB":"th-TH";}
export function useUiLanguage(){const locale=useSyncExternalStore(subscribe,getLocale,()=>"th" as const);return{locale,setLocale,text:(value:string)=>translateUi(value,locale)};}
