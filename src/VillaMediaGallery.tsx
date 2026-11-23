import PropertyVideoPlayer from "./PropertyVideoPlayer";
import {uiText} from "./uiLanguage";
import {useEffect,useRef,useState,type KeyboardEvent,type TouchEvent} from 'react'
import DemoPhoto from './DemoPhoto'
import './villa-gallery.css'
type Media={id:string;url:string;name:string;kind:string;poster?:string;provider?:string}
export default function VillaMediaGallery({media,coverUrl,demo=false}:{media:Media[];coverUrl:string;demo?:boolean}){
 const images=[...new Map(media.filter(m=>m.kind==='image'&&m.url).map(m=>[m.url,m])).values()];images.sort((a,b)=>Number(b.url===coverUrl)-Number(a.url===coverUrl))
 const videos=media.filter(m=>m.kind==='video'&&m.url).slice(0,2)
 const [index,setIndex]=useState(0)
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement>(null),touch=useRef<{x:number;y:number}|null>(null)
 const identity=images.map(m=>m.url).join('\n')
 useEffect(()=>{setIndex(0);dialog.current?.close()},[identity])
 useEffect(()=>{const modal=dialog.current;if(!modal)return;const restore=()=>{document.body.style.overflow=previous;opener.current?.focus()},previous=document.body.style.overflow;modal.addEventListener('close',restore);return()=>{modal.removeEventListener('close',restore);document.body.style.overflow=previous}},[])
 const selected=Math.min(index,Math.max(images.length-1,0)),active=images[selected]
 const move=(n:number)=>{if(images.length>1)setIndex(i=>(i+n+images.length)%images.length)}
 const keyboard=(e:KeyboardEvent)=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||images.length<2)return;e.preventDefault();e.stopPropagation();if(e.key==='Home')setIndex(0);else if(e.key==='End')setIndex(images.length-1);else move(e.key==='ArrowRight'?1:-1)}
 const start=(e:TouchEvent)=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}
 const end=(e:TouchEvent)=>{const point=touch.current;touch.current=null;if(!point||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-point.x,dy=e.changedTouches[0].clientY-point.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))move(dx<0?1:-1)}
 const controls=()=>images.length>1&&<><button type="button" className="villa-photo-prev" aria-label={uiText("ภาพก่อนหน้า")} onClick={()=>move(-1)}>‹</button><button type="button" className="villa-photo-next" aria-label={uiText("ภาพถัดไป")} onClick={()=>move(1)}>›</button></>
 return <section className="villa-public-media" aria-label={uiText("รูปภาพและวิดีโอที่พัก")}>
 {active?<><div className="villa-photo-slider" role="region" aria-roledescription="carousel" aria-label={uiText("รูปภาพที่พัก")} tabIndex={0} onKeyDown={keyboard} onTouchStart={start} onTouchEnd={end} onTouchCancel={()=>{touch.current=null}}>
 <button ref={opener} type="button" className="villa-photo-cover gallery-open" aria-label={uiText("เปิดแกลเลอรีเต็มหน้าจอ")} onClick={()=>{dialog.current?.showModal();document.body.style.overflow='hidden'}}><DemoPhoto key={active.url} src={active.url} demo={demo} alt={active.name} loading="eager" decoding="async"/><span className="gallery-open-label">{uiText("ดูรูปภาพทั้งหมด")}</span></button>
 {controls()}<p className="villa-photo-count" aria-live="polite" aria-atomic="true">{selected+1} / {images.length}</p></div>
 {images.length>1&&<div className="villa-photo-thumbnails" role="group" aria-label={uiText("เลือกรูปภาพ")}>{images.map((m,i)=><button type="button" key={m.url} aria-label={uiText(`ภาพที่ ${i+1}`)} aria-current={i===selected?'true':undefined} onClick={()=>setIndex(i)}><DemoPhoto src={m.url} demo={demo} alt={m.name} loading="lazy" decoding="async" width={160} height={100}/></button>)}</div>}
 <dialog ref={dialog} className="villa-gallery-lightbox" aria-label={uiText("แกลเลอรีรูปภาพ")} onKeyDown={keyboard} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}>
 <button type="button" className="gallery-close" autoFocus aria-label={uiText("ปิดแกลเลอรี")} onClick={()=>dialog.current?.close()}>×</button>
 <div className="gallery-full-image" onTouchStart={start} onTouchEnd={end} onTouchCancel={()=>{touch.current=null}}><DemoPhoto key={active.url} src={active.url} demo={demo} alt={active.name} decoding="async"/>{controls()}</div>
 <p aria-live="polite">{selected+1} / {images.length}</p></dialog></>:<figure className="gallery-empty"><DemoPhoto demo={demo} alt={uiText("ยังไม่มีรูปภาพที่เผยแพร่")}/><figcaption>{demo?uiText("ภาพประกอบ DEMO ไม่ใช่ภาพยืนยันที่พัก"):uiText("ยังไม่มีรูปภาพที่เผยแพร่")}</figcaption></figure>}
 {videos.length>0&&<section className="villa-video-gallery" aria-label={uiText("วิดีโอที่พัก")}><h2>{uiText("วิดีโอที่พัก")}</h2><div className="villa-video-grid">{videos.map(v=><figure key={v.id}><PropertyVideoPlayer video={v} poster={coverUrl}/><figcaption>{v.name}</figcaption></figure>)}</div></section>}
 </section>
}
