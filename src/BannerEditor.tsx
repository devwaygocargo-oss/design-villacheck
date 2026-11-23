import CarouselSettings from "./CarouselSettings";
import {uiText} from "./uiLanguage";
import {localeTag} from "./uiLanguage";
import BannerEnglishEditor from "./BannerEnglishEditor";
import {editorialBanners,selectEditorialBanner} from "../server/banner-display.mjs";
import CmsMediaPicker,{type CmsMedia} from "./CmsMediaPicker";
import { useState } from "react"
import type { CmsContent, HomeBannerItem } from "./cms"
export const cmsHomeBanners=(content:CmsContent):HomeBannerItem[]=>editorialBanners(content.home)
export default function BannerEditor({
  content,
  onChange,media,onUploaded,selectionId,onSelectionChange,hideInventory=false,
}: {
  selectionId?:string
  onSelectionChange?:(id:string)=>void
  hideInventory?:boolean
  media:CmsMedia[]
  onUploaded:(media:CmsMedia)=>void
  content: CmsContent
  onChange: (content: CmsContent) => void
}) {
  const banners = cmsHomeBanners(content)
  const [selectedId,setSelectedId] = useState("")
  const selectedIndex = Math.max(0,banners.findIndex(b=>b.id===(selectionId??selectedId)))
  const select=(id:string)=>{setSelectedId(id);onSelectionChange?.(id)}
  const dateLabel = (value:string) => value ? new Date(value).toLocaleString(localeTag(),{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"}) : "ไม่กำหนด"
  const save = (items: HomeBannerItem[]) =>
    onChange({ ...content, home: { ...content.home, banners: items } })
  const update = (index: number, patch: Partial<HomeBannerItem>) =>
    patch.visible===true?onChange({...content,home:selectEditorialBanner({...content.home,banners},banners[index].id)}):save(banners.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  return (
    <section id="cms-website-banners" className="cms-banner-manager">
      <h2>{uiText("แบนเนอร์เว็บไซต์ / ลิงก์และกำหนดเวลา")}</h2>
      <p>{uiText("รายการที่เปิดใช้และอยู่ในช่วงเวลาจะแสดงตามลำดับนี้ เมื่อยังไม่มีรายการจะใช้ภาพสไลด์เดิม วันเวลาใช้เขตเวลาประเทศไทย")}</p>
      {!hideInventory&&<CarouselSettings/>}
      <p>{uiText("บันทึกด้วยปุ่ม “บันทึกร่าง” แล้วตรวจ Preview ก่อนเสนอเผยแพร่ แบนเนอร์โฆษณาที่พักอยู่ในส่วนโฆษณาด้านบนและตรวจสิทธิ์แพ็กเกจแยกต่างหาก")}</p>
      {!hideInventory&&<div className="cms-banner-table-scroll" role="region" aria-label={uiText("ตารางแบนเนอร์เว็บไซต์")} tabIndex={0}><table className="cms-banner-table"><thead><tr><th>{uiText("ลำดับ / ภาพ")}</th><th>{uiText("หัวข้อ")}</th><th>{uiText("ลิงก์ปลายทาง")}</th><th>{uiText("เริ่ม / สิ้นสุด (เวลาไทย)")}</th><th>{uiText("สถานะ")}</th><th>{uiText("จัดการ")}</th></tr></thead><tbody>{banners.map((b,i)=><tr key={b.id} className={i===selectedIndex?"is-selected":""}><td><span>{i+1}</span>{b.image&&<img src={b.image} alt="" loading="lazy"/>}</td><td>{b.title||uiText("ยังไม่มีหัวข้อ")}</td><td>{b.href||uiText("ไม่ระบุลิงก์")}</td><td>{dateLabel(b.startsAt)}<br/>{dateLabel(b.endsAt)}</td><td>{!b.visible?uiText("ปิดใช้งาน"):b.startsAt&&Date.parse(b.startsAt)>Date.now()?uiText("รอเริ่มแสดง"):b.endsAt&&Date.parse(b.endsAt)<=Date.now()?uiText("สิ้นสุดแล้ว"):uiText("เปิดใช้งาน")}</td><td><button type="button" aria-pressed={i===selectedIndex} onClick={()=>select(b.id)}>{uiText("แก้ไขแบนเนอร์ ")}{i+1}</button></td></tr>)}</tbody></table></div>}
      {banners.map((b, i) => i===selectedIndex && (
        <fieldset className="cms-block-editor cms-banner-detail" key={b.id}>
          <legend>{uiText("แบนเนอร์ ")}{i + 1}</legend>
          <CmsMediaPicker library={media} onUploaded={onUploaded} label={uiText("รูปคอมพิวเตอร์")} value={b.image} onChange={image=>update(i,{image})}/>
          <CmsMediaPicker library={media} onUploaded={onUploaded} label={uiText("รูปมือถือ")} value={b.mobileImage} onChange={mobileImage=>update(i,{mobileImage})}/>
          {([
            ["title", uiText("หัวข้อ")],
            ["description", uiText("คำอธิบาย")],
            ["href", uiText("ลิงก์ปลายทาง HTTPS หรือ #page=…")],
            ["label", uiText("ข้อความปุ่ม")],
          ] as const).map(([key, label]) => (
            <label key={key}>
              {uiText(label)}
              {key==="title"||key==="description"?<textarea rows={3} value={b[key]} onChange={e=>update(i,{[key]:e.target.value})}/>:<input
                value={b[key]}
                onChange={(e) => update(i, { [key]: e.target.value })}
              />}
            </label>
          ))}
          <BannerEnglishEditor value={b.en} onChange={en=>update(i,{en})} media={media} onUploaded={onUploaded}/>
          {(["startsAt", "endsAt"] as const).map((key) => (
            <label key={key}>
              {key === "startsAt" ? uiText("เริ่มแสดง (เวลาไทย)") : uiText("สิ้นสุด (เวลาไทย)")}
              <input
                type="datetime-local"
                value={
                  b[key]
                    ? new Date(Date.parse(b[key]) + 7 * 3600000)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  update(i, {
                    [key]: e.target.value
                      ? new Date(e.target.value + ":00+07:00").toISOString()
                      : "",
                  })
                }
              />
            </label>
          ))}
          <label className="cms-checkbox">
            <input
              type="checkbox"
              checked={b.visible}
              onChange={(e) => update(i, { visible: e.target.checked })}
            />{uiText("เปิดใช้งาน")}</label>
          <div className="button-row">
            <button
              type="button"
              disabled={!i}
              onClick={() => {
                const rows = [...banners]
                ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                save(rows)
              }}
            >{uiText("เลื่อนขึ้น")}</button>
            <button
              type="button"
              disabled={i === banners.length - 1}
              onClick={() => {
                const rows = [...banners]
                ;[rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]
                save(rows)
              }}
            >{uiText("เลื่อนลง")}</button>
            <button
              type="button"
              onClick={() => save(banners.filter((x) => x.id !== b.id))}
            >{uiText("ลบแบนเนอร์")}</button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="outline-button"
        onClick={() => {
          const id = `banner-${crypto.randomUUID()}`
          save([
            ...banners,
            {
              id,
              title: "แบนเนอร์ใหม่",
              description: "",
              image: content.home.images[0],
              mobileImage: "",
              href: "#page=directory",
              label: "ดูรายละเอียด",
              visible: false,
              sponsored: false,
              startsAt: "",
              endsAt: "",
            },
          ])
          select(id)
        }}
      >{uiText("เพิ่มแบนเนอร์")}</button>
    </section>
  )
}
