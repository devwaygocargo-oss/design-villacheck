import AdminMediaReview from "./AdminMediaReview";
import {uploadPropertyFile,type PreparedPropertyFile} from "./propertyUpload";
import {youtubeVideoId} from "./youtube";
import PropertyVideoPlayer from "./PropertyVideoPlayer";
import {useUiLanguage,uiText} from "./uiLanguage";
import {t as translateSystem} from "./locale"
import {t} from "./locale"
import {onPublicVillaRefresh} from './publicVillaRefresh'
import MediaUploadQueue from "./MediaUploadQueue"
import {localeTag} from "./locale"
import VillaMediaGallery from "./VillaMediaGallery"
import DemoPhoto from "./DemoPhoto"
import PropertyWriteFieldset from "./PropertyWriteFieldset";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react"
import { api } from "./api"
type Media = {
  provider?:string
  id: string
  name: string
  kind: string
  url: string
  uploadedAt: string | null
  takenAt: string | null
  reviewedAt: string | null
}
const date = (value: string | null) =>
  value
    ? new Date(
        value.length === 10 ? value + "T00:00:00+07:00" : value,
      ).toLocaleDateString(localeTag(), {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "ไม่ระบุ"
function PropertyMediaContent({
  qr,
  villaId,
  mode = "public",
  onChanged,
  onBusyChange,
}: {
  qr?: string
  villaId?: string
  mode?: "public" | "merchant" | "admin"
  onChanged?:()=>void
  onBusyChange?:(busy:boolean)=>void
}) {
  const [batchBusy,setBatchBusy]=useState(false);
  const countsRef=useRef({images:0,videos:0,cover:false});
  const mediaIdsRef=useRef(new Set<string>());
  const {locale}=useUiLanguage(),en=locale==='en';
  const [youtubeLink,setYoutubeLink]=useState('');
  const preparedFiles=useRef(new Map<string,PreparedPropertyFile>());
  const [loading,setLoading]=useState(true);
  const [demoImage,setDemoImage]=useState(false);
  const [coverUrl,setCoverUrl]=useState("");
  const [counts,setCounts]=useState({images:0,videos:0});
  const [media, setMedia] = useState<Media[]>([]),
    [latest, setLatest] = useState<string | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [takenAt, setTakenAt] = useState(""),
    [busy, setBusy] = useState(false)
  useLayoutEffect(()=>{onBusyChange?.(busy||batchBusy);return()=>onBusyChange?.(false)},[busy,batchBusy,onBusyChange])
  const path =
    mode === "public"
      ? `/public/property-media?qr=${encodeURIComponent(qr || "")}`
      : `/${mode}/property-media?villaId=${villaId}`
  const pathRef=useRef(path);
  useLayoutEffect(()=>{pathRef.current=path;setBatchBusy(false);setBusy(false);setTakenAt("");setMessage("");countsRef.current={images:0,videos:0,cover:false};mediaIdsRef.current.clear();setCounts({images:0,videos:0})},[path]);
  const [publicRevision,setPublicRevision]=useState(0)
  useEffect(()=>mode==='public'?onPublicVillaRefresh(()=>setPublicRevision(value=>value+1)):undefined,[mode])
  const load = async (isCurrent:()=>boolean=()=>true) => {
    const data = await api<{
      demoImage?:boolean
      media: Media[]
      coverUrl?:string
      counts?:{images:number;videos:number}
      latestUpdatedAt: string | null
    }>(
      path,
    )
    if(!isCurrent())return
    setError("")
    setDemoImage(data.demoImage===true);setMedia(data.media);setCoverUrl(data.coverUrl||"");setCounts(data.counts||{images:data.media.filter(m=>m.kind==="image").length,videos:data.media.filter(m=>m.kind==="video").length})
    countsRef.current={images:data.counts?.images??data.media.filter(m=>m.kind==="image").length,videos:data.counts?.videos??data.media.filter(m=>m.kind==="video").length,cover:Boolean(data.coverUrl)};
    mediaIdsRef.current=new Set(data.media.map(m=>m.id));
    setLatest(data.latestUpdatedAt)
  }
  useEffect(() => {
    let cancelled=false
    setLoading(true);setMedia([]);setCoverUrl("");setError("")
    void load(()=>!cancelled).catch((e) => {if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  }, [path,publicRevision])
  const upload = async (file?: File,replacingId?:string,progress?:(stage:"reading"|"uploading",percent?:number)=>void,uploadRequestId=crypto.randomUUID()) => {
    if (!file) return {ok:false,error:"No file selected"}
    setError("")
    setBusy(true)
    setMessage("")
    try {
      if(!["image/jpeg","image/png","video/mp4"].includes(file.type))throw Error("รองรับ JPG, PNG หรือ MP4 เท่านั้น");
      if(!replacingId&&((file.type==="video/mp4"&&countsRef.current.videos>=2)||(file.type!=="video/mp4"&&(countsRef.current.images-(countsRef.current.cover?1:0))>=10)))throw Error(file.type==="video/mp4"?"เพิ่มวิดีโอได้ไม่เกิน 2 รายการ":"รูปภาพเพิ่มเติมต้องไม่เกิน 10 รูป โดยแยกจากรูปหน้าปก 1 รูป");
      if(file.size>(file.type==='video/mp4'?25:5)*1024*1024)throw Error(file.type==='video/mp4'?'วิดีโอต้องไม่เกิน 25 MB':'รูปภาพต้องไม่เกิน 5 MB')
      setMessage(translateSystem("กำลังอ่านไฟล์…"));progress?.("reading",0)
      let prepared=preparedFiles.current.get(uploadRequestId);
      if(!prepared){prepared=await uploadPropertyFile(file,percent=>progress?.('uploading',percent));preparedFiles.current.set(uploadRequestId,prepared);}
      if(pathRef.current!==path)return {ok:false,error:"Upload cancelled after property changed"};
      setMessage(translateSystem("กำลังอัปโหลดไฟล์…"));progress?.("uploading")
      const result=await api<{media:Media;replayed?:boolean}>(`/${mode}/property-media`, {
        villaId,uploadRequestId,
        action:replacingId?"replace":"upload",mediaId:replacingId,
        takenAt,
        file: { name: prepared.name, type: prepared.type, uploadId:prepared.uploadId },
      })
      if(pathRef.current!==path)return {ok:true};
      setMedia(rows=>rows.some(row=>row.id===result.media.id)?rows:[...rows.filter(row=>row.id!==replacingId),result.media]);
      if(!replacingId&&!mediaIdsRef.current.has(result.media.id)){const previous=countsRef.current;countsRef.current={...previous,images:previous.images+(result.media.kind==='image'?1:0),videos:previous.videos+(result.media.kind==='video'?1:0)};setCounts({images:countsRef.current.images,videos:countsRef.current.videos})}
      mediaIdsRef.current.add(result.media.id);
      setLatest(result.media.uploadedAt);
      try{await load()}catch{setMessage(translateSystem("อัปโหลดแล้ว แต่ยังรีเฟรชรายการไม่ได้ กรุณาลองโหลดข้อมูลอีกครั้ง"));onChanged?.();return {ok:true}}
      onChanged?.()
      setMessage(translateSystem("อัปโหลดสื่อแล้ว รอ Admin ตรวจอนุมัติก่อนเผยแพร่ วันที่อัปโหลดบันทึกอัตโนมัติ"));return {ok:true}
    } catch (e) {
      setMessage("")
      const reason=e instanceof Error?uiText(e.message):translateSystem("อัปโหลดไม่สำเร็จ");if(pathRef.current===path)setError(reason);return {ok:false,error:reason}
    } finally {
      if(pathRef.current===path)setBusy(false)
    }
  }
  if(mode==="public")return <>{loading?<p role="status">{translateSystem("กำลังโหลดรูปภาพและวิดีโอ / Loading media…")}</p>:error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setPublicRevision(v=>v+1)}>{translateSystem("ลองอีกครั้ง / Retry")}</button></div>:<VillaMediaGallery media={media} coverUrl={coverUrl} demo={demoImage}/>}</>
  return (
    <PropertyWriteFieldset><section className="merchant-panel">
      <h2>{translateSystem("รูปภาพและวิดีโอ")}</h2><p>{translateSystem("รูปหน้าปก")}{" "}{coverUrl?1:0}{translateSystem("/1 · รูปภาพเพิ่มเติม")}{" "}{Math.max(0,counts.images-(coverUrl?1:0))}{translateSystem("/10 · วิดีโอ")}{" "}{counts.videos}/2</p>
      <p>{translateSystem("อัปเดตรูปภาพ/วิดีโอล่าสุดเมื่อ")}{" "}{date(latest)}</p>
      {busy&&<progress aria-label={translateSystem("กำลังดำเนินการกับไฟล์")}/>}{error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="button" disabled={busy||batchBusy} onClick={()=>{setLoading(true);void load().catch(e=>setError(e instanceof Error?e.message:translateSystem("โหลดข้อมูลไม่สำเร็จ"))).finally(()=>setLoading(false))}}>{translateSystem("รีเฟรชรายการสื่อ")}</button>
      {(
        <div className="portal-form">
          <label>
            {translateSystem("วันที่ถ่ายภาพหรือวิดีโอ (ไม่ทราบเว้นว่าง)")}<input
              type="date"
              disabled={busy||batchBusy}
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
            />
          </label>
          <MediaUploadQueue key={path} disabled={busy||loading} remainingImages={Math.max(0,10-(counts.images-(coverUrl?1:0)))} remainingVideos={Math.max(0,2-counts.videos)} onRunning={setBatchBusy} onUpload={(file,progress,requestId)=>upload(file,undefined,progress,requestId)}/>
          <div className="property-youtube-entry"><label>{en?'YouTube video link':'ลิงก์วิดีโอ YouTube'}<input type="url" value={youtubeLink} disabled={busy||batchBusy||counts.videos>=2} onChange={e=>setYoutubeLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label><button type="button" className="outline-button" disabled={busy||batchBusy||counts.videos>=2} onClick={async()=>{setError('');if(!youtubeVideoId(youtubeLink)){setError(en?'Enter a valid HTTPS YouTube video link.':'กรุณาใช้ลิงก์ YouTube แบบ HTTPS ที่ถูกต้อง');return}setBusy(true);try{await api('/'+mode+'/property-media',{villaId,action:'youtube',youtubeUrl:youtubeLink,uploadRequestId:crypto.randomUUID()});setYoutubeLink('');await load();onChanged?.();setMessage(en?'Video submitted for review.':'ส่งวิดีโอให้ทีมตรวจสอบแล้ว')}catch(error){setError(error instanceof Error?uiText(error.message):(en?'Unable to add video.':'เพิ่มวิดีโอไม่สำเร็จ'))}finally{setBusy(false)}}}>{en?'Add YouTube video':'เพิ่มวิดีโอ YouTube'}</button></div>
          <p>
            {translateSystem("รูปหน้าปก 1 รูป และรูปภาพเพิ่มเติมสูงสุด 10 รูป และวิดีโอสูงสุด 2 รายการตามสิทธิ์บัญชี วันที่อัปโหลดแยกจากวันที่ถ่ายจริง")}</p>
        </div>
      )}
      {demoImage&&!media.some(m=>m.kind==="image")&&<figure className="demo-empty-gallery"><DemoPhoto demo alt={translateSystem("ภาพตัวอย่างประกอบการทดสอบ ไม่ใช่ภาพที่อัปโหลด")}/><figcaption>{translateSystem("ภาพประกอบ DEMO ไม่ใช่ภาพยืนยันที่พัก · ไม่นับเป็นไฟล์อัปโหลด")}</figcaption></figure>}
      <div className="villa-grid property-media-grid">
        {media.map((m) => (
          <figure key={m.id} style={{ margin: 0 }}>
            {m.kind === "video" ? (
              <PropertyVideoPlayer video={m} poster={coverUrl}/>
            ) : (
              <a href={m.url} target="_blank" rel="noopener noreferrer">
                <DemoPhoto
                  demo={demoImage}
                  src={m.url}
                  alt={m.name}
                  style={{
                    width: "100%",
                    aspectRatio: "4/3",
                    objectFit: "cover",
                    borderRadius: 12,
                  }}
                />
              </a>
            )}
            <figcaption>
              <strong>{m.url===coverUrl||m.id==="cover"?translateSystem("รูปปก · "):""}{m.name}</strong>
              <p>
                {translateSystem("อัปโหลด:")}{" "}{date(m.uploadedAt)}
                <br />
                {translateSystem("ถ่าย:")}{" "}{date(m.takenAt)}
                {m.reviewedAt && (
                  <>
                    <br />
                    {translateSystem("ทีมตรวจสื่อ:")}{" "}{date(m.reviewedAt)}
                  </>
                )}
              </p>
            </figcaption>
            {mode==='merchant'&&m.kind==='image'&&m.url!==coverUrl&&<div className="button-row">{[-1,1].map(direction=><button key={direction} disabled={busy||batchBusy} onClick={async()=>{const images=media.filter(item=>item.kind==='image'&&item.url!==coverUrl),from=images.findIndex(item=>item.id===m.id),to=from+direction;if(to<0||to>=images.length)return;[images[from],images[to]]=[images[to],images[from]];setBusy(true);setError('');try{await api('/merchant/property-media',{villaId,action:'reorder',mediaIds:images.map(item=>item.id)});await load();onChanged?.();setMessage(translateSystem("บันทึกลำดับรูปภาพแล้ว รอตรวจสอบก่อนเผยแพร่"))}catch(e){setError(e instanceof Error?e.message:translateSystem("บันทึกลำดับไม่สำเร็จ"))}finally{setBusy(false)}}}>{direction<0?translateSystem("เลื่อนรูปก่อนหน้า"):translateSystem("เลื่อนรูปถัดไป")}</button>)}</div>}
            {mode === "merchant" && <button disabled={busy||batchBusy} onClick={async()=>{
              if(!window.confirm(m.kind==="video"?translateSystem("ต้องการลบวิดีโอนี้ใช่หรือไม่?"):translateSystem("ต้องการลบรูปนี้ใช่หรือไม่?")))return;
              setBusy(true);setError("")
              try{await api("/merchant/property-media",{villaId,mediaId:m.id,action:"remove"});await load();onChanged?.();setMessage(translateSystem("นำสื่อออกจากรายการแล้ว ที่พักรอตรวจสอบก่อนเผยแพร่ กรุณาโหลดสถานะล่าสุด"))}
              catch(e){setError(e instanceof Error?e.message:translateSystem("นำสื่อออกไม่สำเร็จ"))}finally{setBusy(false)}
            }}>{m.kind==="video"?translateSystem("ลบวิดีโอ"):translateSystem("ลบรูป")}</button>}
            {mode==="merchant"&&m.id!=="cover"&&<label>{translateSystem("เปลี่ยน")}{m.kind==="video"?translateSystem("วิดีโอ"):translateSystem("รูป")}<input type="file" disabled={busy||batchBusy} accept={m.kind==="video"?"video/mp4":"image/jpeg,image/png"} onChange={e=>{void upload(e.target.files?.[0],m.id);e.target.value="";}}/></label>}
            {mode==="merchant"&&m.kind==="image"&&m.url!==coverUrl&&m.id!=="cover"&&<button disabled={busy||batchBusy} onClick={async()=>{setBusy(true);setError("");try{await api("/merchant/property-media",{villaId,mediaId:m.id,action:"set-cover"});await load();onChanged?.();setMessage(translateSystem("เลือกรูปปกแล้ว รอตรวจสอบก่อนเผยแพร่"));}catch(e){setError(e instanceof Error?e.message:translateSystem("เปลี่ยนรูปปกไม่สำเร็จ"));}finally{setBusy(false);}}}>{translateSystem("ใช้เป็นรูปปก")}</button>}

          </figure>
        ))}
      </div>
      {!media.length && <p>{translateSystem("ยังไม่มีรูปภาพหรือวิดีโอ")}</p>}
    </section></PropertyWriteFieldset>
  )
}

export default function PropertyMedia(props:ComponentProps<typeof PropertyMediaContent>){
 const [revision,setRevision]=useState(0);
 if(props.mode==='admin')return <PropertyWriteFieldset><AdminMediaReview villaId={props.villaId} onChanged={props.onChanged} onBusyChange={props.onBusyChange} revision={revision} management={<PropertyMediaContent {...props} onChanged={()=>{setRevision(value=>value+1);props.onChanged?.();}}/>}/></PropertyWriteFieldset>;
 return <PropertyMediaContent {...props}/>;
}
