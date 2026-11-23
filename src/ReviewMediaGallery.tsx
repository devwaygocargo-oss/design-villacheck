import {uiText} from "./uiLanguage"
export type ReviewAttachment={id:string;name:string;url:string;mime:string;kind:"image"|"video";size:number}
export default function ReviewMediaGallery({items=[],onRemove,disabled=false}:{items?:ReviewAttachment[];onRemove?:(id:string)=>void;disabled?:boolean}){
 if(!items.length)return null
 return <div className="review-media-grid" aria-label={uiText("ไฟล์แนบรีวิว")}>{items.map(item=><figure key={item.id} data-review-media={item.kind}>{item.kind==="image"?<a href={item.url} target="_blank" rel="noreferrer" aria-label={uiText("ดูรูปรีวิว")+" "+item.name}><img src={item.url} alt={item.name} loading="lazy" decoding="async"/></a>:<><video src={item.url} controls playsInline preload="metadata" aria-label={uiText("วิดีโอรีวิว")+" "+item.name}/><a href={item.url} target="_blank" rel="noreferrer">{uiText("เปิดหรือดาวน์โหลดวิดีโอ")}</a></>}<figcaption>{item.name}</figcaption>{onRemove&&<button type="button" disabled={disabled} onClick={()=>onRemove(item.id)} aria-label={uiText("นำไฟล์ออก")+" "+item.name}>{uiText("นำไฟล์ออก")}</button>}</figure>)}</div>
}
