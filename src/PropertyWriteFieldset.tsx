import {useEffect,useState,type ReactNode} from 'react';import {api} from './api';import {useUiLanguage} from './uiLanguage';
export default function PropertyWriteFieldset({children,readOnly=false}:{children:ReactNode;readOnly?:boolean}){
 const {locale}=useUiLanguage(),[enabled,setEnabled]=useState<boolean|null>(null);
 useEffect(()=>{let active=true;void api<{businessFeaturesEnabled?:boolean;propertyMediaWorkflowEnabled?:boolean}>('/config').then(config=>{if(active)setEnabled(config.businessFeaturesEnabled!==false||config.propertyMediaWorkflowEnabled===true)}).catch(()=>{if(active)setEnabled(false)});return()=>{active=false}},[]);
 if(readOnly)return <fieldset disabled className="business-write-fieldset" style={{border:0,padding:0,margin:0,minWidth:0}}><p role="status">{locale==='en'?'Subscription expired. Property editing is disabled.':'แพ็กเกจหมดอายุ ปิดการแก้ไขที่พัก'}</p>{children}</fieldset>;
 return enabled===true?<>{children}</>:<fieldset className="business-write-fieldset" disabled style={{border:0,padding:0,margin:0,minWidth:0}} aria-busy={enabled===null}>{enabled===false&&<p role="status">{locale==='en'?'Property submissions are not enabled in this environment.':'ยังไม่เปิดการส่งหรือแก้ไขข้อมูลที่พักในระบบนี้'}</p>}{children}</fieldset>;
}
