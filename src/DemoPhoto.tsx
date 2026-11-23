import {uiText} from "./uiLanguage";
import {useState,type ImgHTMLAttributes} from 'react'
const genericFallback='/villa-placeholder.svg'
// Display fallback only: never written to forms, quotas, media records or review snapshots.
export default function DemoPhoto({src,demo=false,alt='',className='',onError,...props}:ImgHTMLAttributes<HTMLImageElement>&{demo?:boolean}){
 const [failed,setFailed]=useState<string|null>(null)
 const fallback=genericFallback
 const original=typeof src==='string'&&src.trim()?src:fallback
 const resolved=failed===original?fallback:original
 const illustrative=demo&&resolved.startsWith('/demo/')
 return <img {...props} src={resolved} width={props.width||1600} height={props.height||1000} alt={illustrative?uiText("ภาพประกอบ DEMO ไม่ใช่ภาพยืนยันที่พัก · ")+alt:alt} className={'demo-photo '+className} data-demo-image={illustrative?'true':undefined} data-demo-fallback={!src||failed===original?'true':undefined} onError={e=>{onError?.(e);if(resolved!==fallback)setFailed(original)}}/>
}
