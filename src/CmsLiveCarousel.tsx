import { useEffect, useState } from "react"
import { carouselBanners } from "../server/banner-display.mjs"
import { localizedBanner } from "../server/banner-language.mjs"
import { api } from "./api"
import type { CmsContent, HomeBannerItem } from "./cms"
import { cmsHomeBanners } from "./BannerEditor"
import type { Ad } from "./Advertising"
import type { BannerSelection } from "./CmsBannerInventory"
import { usePublicLanguage } from "./publicLanguage"
import { uiText } from "./uiLanguage"

export default function CmsLiveCarousel({ content, ads, onSelect }: {
  content: CmsContent
  ads: Ad[]
  onSelect: (selection: BannerSelection) => void
}) {
  const { locale } = usePublicLanguage()
  const [slides, setSlides] = useState<{ banner: HomeBannerItem; position: number }[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true, sequence = 0
    const load = async () => {
      const request = ++sequence
      try {
        const [published, advertisements] = await Promise.all([
          api<{ content: CmsContent }>("/public/cms"),
          api<{ advertisements: HomeBannerItem[] }>("/public/advertisements?placement=home"),
        ])
        if (!active || request !== sequence) return
        const items: HomeBannerItem[] = carouselBanners(published.content.home, published.content.presentation, advertisements.advertisements)
        setSlides(items.map((banner, index) => ({ banner, position: index + 1 })).filter(item => item.banner.id !== "villacheck-intro"))
        setError("")
      } catch {
        if (active && request === sequence) setError(uiText("โหลดแบนเนอร์หน้าแรกไม่สำเร็จ กรุณาลองใหม่"))
      } finally {
        if (active && request === sequence) setLoading(false)
      }
    }
    setLoading(true)
    void load()
    const timer = window.setInterval(() => { void load() }, 30000)
    return () => { active = false; window.clearInterval(timer) }
  }, [ads, reload])
  const cmsIds = new Set(cmsHomeBanners(content).map(banner => banner.id))
  const adIds = new Set(ads.map(ad => ad.id))
  return <section className="merchant-panel cms-live-carousel" aria-label={uiText("แบนเนอร์ที่แสดงบน Carousel หน้าแรก")}>
    <div className="cms-live-carousel-heading"><div><h2>{uiText("แบนเนอร์ที่แสดงบน Carousel หน้าแรก")} ({slides.length})</h2><p>{uiText("เรียงตามหน้าเว็บที่เผยแพร่แล้ว ยกเว้นแบนเนอร์แรก · การแก้ไขร่างยังไม่เปลี่ยนรายการนี้")}</p></div><button type="button" disabled={loading} onClick={() => setReload(value => value + 1)}>{uiText("โหลดรายการล่าสุด")}</button></div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">{uiText("กำลังโหลดรายการแบนเนอร์ทั้งหมด…")}</p> : error ? null : slides.length === 0 ? <p>{uiText("ยังไม่มีแบนเนอร์อื่นที่แสดงบน Carousel หน้าแรก")}</p> : <div className="cms-live-carousel-grid">{slides.map(({ banner, position }) => {
      const item = localizedBanner(banner, locale)
      const kind = banner.sponsored ? "ad" : "cms"
      const editable = kind === "ad" ? adIds.has(banner.id) : cmsIds.has(banner.id)
      return <article key={banner.id} className="cms-live-carousel-card" data-live-banner-id={banner.id}>
        <h3>{uiText("สไลด์")} {position}{item.title?.trim() ? ` · ${item.title}` : ""}</h3>
        <div className="cms-live-carousel-images"><figure><img src={item.image} alt="" loading="lazy"/><figcaption>{uiText("ภาพคอมพิวเตอร์")}</figcaption></figure><figure><img src={item.mobileImage || item.image} alt="" loading="lazy"/><figcaption>{uiText("ภาพมือถือ")}</figcaption></figure></div>
        {item.href && <p className="cms-live-carousel-link">{item.href}</p>}
        <button type="button" disabled={!editable} onClick={() => onSelect({ kind, id: banner.id })}>{uiText("แก้ไข")} · {uiText("สไลด์")} {position}</button>
        {!editable && <p>{uiText("ไม่พบรายการนี้ในข้อมูลแก้ไข กรุณาโหลดรายการล่าสุด")}</p>}
      </article>
    })}</div>}
  </section>
}
