import {uiText} from "./uiLanguage";
import {localeTag} from "./uiLanguage";
import BannerEnglishEditor from "./BannerEnglishEditor";
import CmsMediaPicker,{type CmsMedia} from "./CmsMediaPicker";
import { useEffect, useImperativeHandle, useState,type Ref } from "react"
import { api } from "./api"
import SocialMaterials from "./SocialMaterials"
import type { MerchantVilla } from "./merchantStore"
import type { HomeBannerItem } from "./cms"
export type Ad = HomeBannerItem & {
  eligible?:boolean
  villaId: string
  villaName?: string
  placement: string
  approved: boolean
  order: number
}
export type AdvertisingEditorHandle={select:(id:string)=>boolean;reload:()=>Promise<void>}
const adTextLabels={title:"หัวข้อ",description:"คำอธิบาย",href:"ลิงก์ปลายทาง",label:"ข้อความปุ่ม"}
type Job = {
  id: string
  villaId: string
  villaName?: string
  month: string
  type: string
  status: string
  channel: string
  publishedAt: string
  postUrl: string
  links?: Record<string, string>
  notes: string
}
const blankAd: Ad = {
  id: "",
  villaId: "",
  placement: "footer",
  approved: false,
  order: 0,
  image: "",
  mobileImage: "",
  title: "",
  description: "",
  href: "",
  label: "ดูที่พัก",
  visible: false,
  sponsored: true,
  startsAt: "",
  endsAt: "",
}
const blankJob: Job = {
  id: "",
  villaId: "",
  month: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7),
  type: "image",
  status: "pending",
  channel: "",
  publishedAt: "",
  postUrl: "",
  notes: "",
}
export default function Advertising({
  merchant = false, adsOnly=false, homeOnly=false, onDirtyChange,mediaLibrary,onMediaUploaded,editorRef,onLoaded,onLoadError,hideList=false,
}: {
  editorRef?:Ref<AdvertisingEditorHandle>
  onLoaded?:(ads:Ad[])=>void
  onLoadError?:(message:string)=>void
  hideList?:boolean
  mediaLibrary?:CmsMedia[]
  onMediaUploaded?:(media:CmsMedia)=>void
  adsOnly?:boolean
  homeOnly?:boolean
  onDirtyChange?:(dirty:boolean)=>void
  merchant?: boolean
}) {
  const [villas, setVillas] = useState<MerchantVilla[]>([]),
    [ads, setAds] = useState<Ad[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [ad, setAd] = useState<Ad>(blankAd),
    [job, setJob] = useState<Job>(blankJob),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false)
  const [localMedia,setLocalMedia]=useState<CmsMedia[]>([]);
  const mediaUploaded=(item:CmsMedia)=>{if(onMediaUploaded)onMediaUploaded(item);else setLocalMedia(rows=>[item,...rows])};
  const [query,setQuery]=useState(""),[placement,setPlacement]=useState("all"),[baseline,setBaseline]=useState(JSON.stringify(blankAd));
  const adDirty=JSON.stringify(ad)!==baseline;
  useEffect(()=>{onDirtyChange?.(adDirty)},[adDirty,onDirtyChange]);
  const chooseAd=(next:Ad)=>{if(adDirty&&!window.confirm(uiText("มีแบนเนอร์ที่ยังไม่บันทึก ต้องการเปลี่ยนรายการหรือไม่?")))return false;setAd(next);setBaseline(JSON.stringify(next));setMessage("");return true};
  useImperativeHandle(editorRef,()=>({select(id){if(busy)return false;if(id===ad.id)return true;const found=id?ads.find(row=>row.id===id):blankAd;return found?chooseAd({...blankAd,...found}):false},reload:()=>load()}),[ads,adDirty,busy,ad.id]);
  useEffect(()=>{if(homeOnly&&!adDirty&&(!ad.id||ad.placement!=="home")){const first=ads.filter(a=>a.placement==="home").sort((a,b)=>a.order-b.order)[0];if(first)chooseAd({...blankAd,...first});}},[homeOnly,ads]);
  const load = async () => {
    setError("")
    if (!merchant) {
      const [state,data,library]=await Promise.all([api<{villas:MerchantVilla[]}>("/state"),api<{advertisements:Ad[]}>("/admin/advertisements"),mediaLibrary?null:api<{media:CmsMedia[]}>("/admin/cms/media")])
      if(library)setLocalMedia(library.media.map(m=>({...m,url:m.url||"/api/public/cms-media/"+m.id})))
      setVillas(state.villas)
      const rows=data.advertisements.filter(row=>row.placement!=="detail")
      setAds(rows);onLoaded?.(rows)
    }
    if(!adsOnly)setJobs(
      (
        await api<{ jobs: Job[] }>(
          merchant ? "/merchant/social-jobs" : "/admin/social-jobs",
        )
      ).jobs,
    )
  }
  useEffect(() => {
    void load().catch((e) => {setError(e.message);onLoadError?.(e.message)})
  }, [merchant,adsOnly])
  const save = async (path: string, value: unknown) => {
    setBusy(true)
    setError("")
    try {
      const result=await api<{advertisement?:Ad}>(path, value)
      if(result.advertisement){const next={...blankAd,...result.advertisement};setAd(next);setBaseline(JSON.stringify(next));window.dispatchEvent(new Event("villacheck-advertisements-updated"));try{localStorage.setItem("villacheck-advertisements-updated",String(Date.now()));}catch{/* Storage may be unavailable in private browsing. */}}
      await load()
      setMessage("บันทึกแล้ว")
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  return (
    <>{!adsOnly&&<SocialMaterials admin={!merchant}/>}<section className="merchant-panel advertising-panel">
      <h2>{adsOnly?uiText("จัดการโฆษณาทุกตำแหน่ง"):uiText("โฆษณาและคอนเทนต์ Social")}</h2>
      {adsOnly&&<p>{uiText("แบนเนอร์บันทึกแยกจากร่าง CMS เปิดแสดงเมื่ออนุมัติโฆษณา อยู่ในช่วงเวลา และที่พักมีสิทธิ์แพ็กเกจครบ")}</p>}
      <p>{uiText("2,990: ภาพเดี่ยว 1 โพสต์ / เดือน บนทุก Social ของ VillaCheck · 4,990: ภาพเดี่ยว 1 โพสต์ + วิดีโอ 1 ชิ้น / เดือน รวมงบโฆษณาและเผยแพร่บนทุก Social ของ VillaCheck สิทธิ์นับรวมทุกช่องทาง ไม่เพิ่มชิ้นงานตามจำนวนช่องทาง")}</p>
      <p>{uiText("เจ้าของบ้านส่งสื่อผ่าน Facebook เดือนละ 1 ครั้ง · 2,990 ส่งเฉพาะรูปภาพ · 4,990 ส่งรูปภาพและวิดีโอ เพื่อใช้ทำแบนเนอร์และโปรโมทตามสิทธิ์")}</p>
      {error && <p role="alert">{uiText(error)}</p>}
      {message && <p role="status">{uiText(message)}</p>}
      {!merchant && (
        <>
          <h3>{uiText("ตารางแบนเนอร์โฆษณา")}</h3>
          <p>{uiText("หน้าแรกหมุนเวียนทุกรายการที่มีสิทธิ์ตามลำดับ หน้ารายละเอียดสุ่มหนึ่งรายการเมื่อเข้าหน้าและคงไว้ระหว่างอ่าน")}</p>
          {!hideList&&<div className="merchant-toolbar"><input aria-label={uiText("ค้นหาโฆษณา")} placeholder={uiText("ค้นหาหัวข้อหรือชื่อที่พัก")} value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label={uiText("กรองตำแหน่งโฆษณา")} value={homeOnly?"home":placement} disabled={homeOnly} onChange={e=>setPlacement(e.target.value)}><option value="all">{uiText("ทุกตำแหน่ง")}</option><option value="home">{uiText("Carousel หน้าแรก")}</option><option value="footer">{uiText("ก่อน Footer")}</option></select></div>}
          <div className={`ad-management-layout${hideList?" ad-management-single":""}`}>
          {!hideList&&<aside className="ad-campaign-list" aria-label={uiText("รายการแบนเนอร์")}>
            <div className="ad-list-heading"><strong>{uiText("รายการโฆษณา")}</strong><span>{ads.filter(a=>(homeOnly?a.placement==="home":placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase())).length}{uiText(" รายการ")}</span></div>
            <button type="button" className="ad-create-button" onClick={()=>chooseAd({...blankAd})}>{uiText("+ เพิ่มโฆษณาใหม่")}</button>
            {ads.filter(a=>(homeOnly?a.placement==="home":placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase())).map(a=><button type="button" className={`ad-campaign-card${ad.id===a.id?" is-selected":""}`} aria-pressed={ad.id===a.id} aria-label={`${a.title} · ${a.placement}`} key={a.id} onClick={()=>chooseAd({...blankAd,...a})}>{a.image&&<img src={a.image} alt="" loading="lazy"/>}<span className="ad-campaign-copy"><strong>{a.title}</strong><small>{a.villaName||uiText("ไม่ระบุที่พัก")}</small><span className="ad-campaign-meta"><span>{{home:uiText("Carousel หน้าแรก"),detail:uiText("หน้ารายละเอียด"),footer:uiText("ก่อน Footer")}[a.placement]||a.placement}</span><span>{!a.visible?uiText("ปิดแสดงผล"):!a.approved?uiText("รออนุมัติ"):uiText("อนุมัติแล้ว")}</span></span></span></button>)}
            {!ads.some(a=>(homeOnly?a.placement==="home":placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase()))&&<p>{uiText("ไม่พบโฆษณาตามเงื่อนไข")}</p>}
          </aside>}
          <form
            className="portal-form ad-editor-form"
            onSubmit={(e) => {
              e.preventDefault()
              void save("/admin/advertisements", ad)
            }}
          >
            <div className="ad-editor-heading"><span>{uiText("แก้ไขแบนเนอร์")}</span><h3>{ad.id?ad.title:uiText("โฆษณาใหม่")}</h3><p>{uiText("เลือกที่พัก กำหนดเนื้อหาและช่วงเวลา แล้วบันทึกแบนเนอร์")}</p></div>
            <fieldset className="ad-form-section"><legend>{uiText("1. ที่พักและตำแหน่ง")}</legend><div className="ad-form-grid">
            <label>{uiText("ที่พัก")}<select
                required
                aria-label={uiText("ที่พัก")}
                value={ad.villaId}
                onChange={(e) => setAd({ ...ad, villaId: e.target.value })}
              >
                <option value="">{uiText("เลือกที่พัก")}</option>
                {villas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {uiText(v.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>{uiText("ตำแหน่ง")}<select
                aria-label={uiText("ตำแหน่ง")}
                value={ad.placement}
                onChange={(e) => setAd({ ...ad, placement: e.target.value })}
              >

                <option value="home">{uiText("หน้าแรก (4,990)")}</option>
                <option value="footer">{uiText("โฆษณาเล็กก่อน Footer · 1 ชิ้น (2,990 ขึ้นไป)")}</option>
              </select>
            </label>
            </div></fieldset><fieldset className="ad-form-section"><legend>{uiText("2. รูปภาพโฆษณา")}</legend><div className="ad-form-grid">
            <CmsMediaPicker library={mediaLibrary??localMedia} onUploaded={mediaUploaded} label={uiText("ภาพคอมพิวเตอร์")} value={ad.image} onChange={image=>setAd(current=>({...current,image}))}/>
            <CmsMediaPicker library={mediaLibrary??localMedia} onUploaded={mediaUploaded} label={uiText("ภาพมือถือ")} value={ad.mobileImage} onChange={mobileImage=>setAd(current=>({...current,mobileImage}))}/>
            </div></fieldset><fieldset className="ad-form-section"><legend>{uiText("3. ข้อความและลิงก์")}</legend><div className="ad-form-grid">
            {([
              "title",
              "description",
              "href",
              "label",
            ] as const).map((k) => (
              <label key={k}>
                {
                  uiText(adTextLabels[k])
                }
                {k==="title"||k==="description"?<textarea aria-label={uiText(adTextLabels[k])} rows={3} value={ad[k]} onChange={e=>setAd({...ad,[k]:e.target.value})}/>:<input
                  aria-label={uiText(adTextLabels[k])}
                  value={ad[k]}
                  onChange={(e) => setAd({ ...ad, [k]: e.target.value })}
                />}
              </label>
            ))}
            </div><BannerEnglishEditor value={ad.en} onChange={en=>setAd({...ad,en})} media={mediaLibrary??localMedia} onUploaded={mediaUploaded}/></fieldset><fieldset className="ad-form-section"><legend>{uiText("4. กำหนดเวลาและการแสดงผล")}</legend><div className="ad-form-grid">
            {(["startsAt", "endsAt"] as const).map((k) => (
              <label key={k}>
                {k === "startsAt" ? uiText("เริ่มแสดง (เวลาไทย)") : uiText("สิ้นสุด (เวลาไทย)")}
                <input
                  required
                  type="datetime-local"
                  value={
                    ad[k]
                      ? new Date(Date.parse(ad[k]) + 7 * 3600000)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    setAd({
                      ...ad,
                      [k]: e.target.value
                        ? new Date(e.target.value + ":00+07:00").toISOString()
                        : "",
                    })
                  }
                />
              </label>
            ))}
            <label>{uiText("ลำดับ")}<input
                type="number"
                min="0"
                value={ad.order}
                onChange={(e) =>
                  setAd({ ...ad, order: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={ad.visible}
                onChange={(e) => setAd({ ...ad, visible: e.target.checked })}
              />{uiText("เปิดใช้งาน")}</label>
            <label>
              <input
                type="checkbox"
                checked={ad.approved}
                onChange={(e) => setAd({ ...ad, approved: e.target.checked })}
              />{uiText("Admin อนุมัติโฆษณา")}</label>
            </div></fieldset><div className="ad-save-bar"><span>{uiText("การแก้ไขจะมีผลหลังบันทึก")}</span><button className="primary-button" disabled={busy}>{uiText("บันทึกแบนเนอร์")}</button>
            </div>
          </form>
          </div>
        </>
      )}
      {!adsOnly&&<>
      <h3>{uiText("สิทธิ์คอนเทนต์รายเดือน")}</h3>
      {!jobs.length && <p>{uiText("ยังไม่มีงานคอนเทนต์")}</p>}
      {jobs.map((j) => (
        <article key={j.id}>
          <strong>
            {j.villaName} · {j.month} ·{" "}
            {j.type === "image" ? uiText("ภาพเดี่ยว") : uiText("วิดีโอ")} · {j.status}
          </strong>
          <p>
            {j.channel || uiText("ทุก Social ของ VillaCheck")}{" "}
            {j.publishedAt &&
              new Date(j.publishedAt).toLocaleString(localeTag(), {
                timeZone: "Asia/Bangkok",
              })}
          </p>
          {j.postUrl && (
            <a href={j.postUrl} target="_blank" rel="noopener noreferrer">{uiText("ดูโพสต์ที่เผยแพร่ ↗")}</a>
          )}
          {Object.entries(j.links || {}).filter(([,url])=>url).map(([channel,url])=><p key={channel}><a href={url} target="_blank" rel="noopener noreferrer">{channel} ↗</a></p>)}
          {!merchant && <button onClick={() => setJob(j)}>{uiText("แก้ไขงาน")}</button>}
        </article>
      ))}
      {!merchant && (
        <form
          className="portal-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save("/admin/social-jobs", job)
          }}
        >
          <button type="button" onClick={() => setJob({ ...blankJob })}>{uiText("เพิ่มงานใหม่")}</button>
          <label>{uiText("ที่พัก")}<select
              required
              value={job.villaId}
              onChange={(e) => setJob({ ...job, villaId: e.target.value })}
            >
              <option value="">{uiText("เลือกที่พัก")}</option>
              {villas.map((v) => (
                <option key={v.id} value={v.id}>
                  {uiText(v.name)}
                </option>
              ))}
            </select>
          </label>
          <label>{uiText("เดือนที่ใช้สิทธิ์")}<input
              type="month"
              required
              value={job.month}
              onChange={(e) => setJob({ ...job, month: e.target.value })}
            />
          </label>
          <label>{uiText("ประเภท")}<select
              value={job.type}
              onChange={(e) => setJob({ ...job, type: e.target.value })}
            >
              <option value="image">{uiText("ภาพเดี่ยว")}</option>
              <option value="video">{uiText("วิดีโอ")}</option>
            </select>
          </label>
          <label>{uiText("สถานะ")}<select
              value={job.status}
              onChange={(e) => setJob({ ...job, status: e.target.value })}
            >
              <option value="pending">{uiText("รอดำเนินการ")}</option>
              <option value="production">{uiText("กำลังผลิต")}</option>
              <option value="review">{uiText("รอตรวจ")}</option>
              <option value="published">{uiText("เผยแพร่")}</option>
            </select>
          </label>
          <label>{uiText("ช่องทาง")}<input
              value={job.channel}
              onChange={(e) => setJob({ ...job, channel: e.target.value })}
            />
          </label>
          <label>{uiText("วันเผยแพร่ (เวลาไทย)")}<input
              type="datetime-local"
              value={
                job.publishedAt
                  ? new Date(Date.parse(job.publishedAt) + 7 * 3600000)
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                setJob({
                  ...job,
                  publishedAt: e.target.value
                    ? new Date(e.target.value + ":00+07:00").toISOString()
                    : "",
                })
              }
            />
          </label>
          <label>{uiText("ลิงก์โพสต์")}<input
              type="url"
              value={job.postUrl}
              onChange={(e) => setJob({ ...job, postUrl: e.target.value })}
            />
          </label>
          {["Facebook","Instagram","TikTok"].map(channel=><label key={channel}>{uiText("ลิงก์ ")}{channel}<input type="url" required={job.status === "published"} value={job.links?.[channel] || ""} onChange={e=>setJob({...job,links:{...job.links,[channel]:e.target.value}})}/></label>)}
          <label>{uiText("บันทึกงาน / งบโฆษณาที่ตกลง")}<textarea
              value={job.notes}
              onChange={(e) => setJob({ ...job, notes: e.target.value })}
            />
          </label>
          <button className="primary-button" disabled={busy}>{uiText("บันทึกงาน")}</button>
        </form>
      )}
      </>}
    </section></>
  )
}
