import {responsiveBannerImage} from "../server/banner-image-policy.mjs";
import {carouselIntervalMs} from "../server/carousel-timing.mjs";
import {uiText,translateUi} from "./uiLanguage";
import {localizedBanner} from "../server/banner-language.mjs";
import {usePublicLanguage} from "./publicLanguage";
import {onPublicVillaRefresh} from "./publicVillaRefresh";
import {carouselBanners,introBanner} from "../server/banner-display.mjs";
import {cmsDefaults} from "../server/cms-defaults.mjs";
import { useEffect, useRef, useState } from "react"
import { api } from "./api"
import type { HomeBannerItem } from "./cms"
import { useCms,usePresentation } from "./cms"
export default function HomeBanner() {
  const {locale}=usePublicLanguage();
  const { home } = useCms()
  const presentation=usePresentation()
  const [now, setNow] = useState(Date.now())
  const [advertisements, setAdvertisements] = useState<HomeBannerItem[]>([])
  useEffect(() => {
    let active = true, sequence = 0
    const load = () => {
      const request = ++sequence;
      void api<{ advertisements: HomeBannerItem[] }>(
        "/public/advertisements?placement=home",
      )
        .then((d) => {
          if (active && request === sequence) setAdvertisements(d.advertisements)
        })
        .catch(() => { if(active && request === sequence)setAdvertisements([]) })
    }
    const unsubscribe=onPublicVillaRefresh(load)
    const changed=(event:StorageEvent)=>{if(event.key==="villacheck-advertisements-updated")load()};
    window.addEventListener("villacheck-advertisements-updated",load);window.addEventListener("storage",changed);
    load()
    const timer = setInterval(load, 30000)
    return () => {
      active = false
      unsubscribe()
      clearInterval(timer)
      window.removeEventListener("villacheck-advertisements-updated",load);window.removeEventListener("storage",changed);
    }
  }, [])
  const scheduled=carouselBanners(home,presentation,advertisements,now);
  const fallback=introBanner({...home,title:home.title?.trim()?home.title:cmsDefaults.home.title,description:home.description?.trim()?home.description:cmsDefaults.home.description,introImage:"/illustrations/qr-evidence.svg",introMobileImage:"",introVisible:true,en:{...home.en,title:home.en?.title?.trim()||translateUi(cmsDefaults.home.title,"en"),description:home.en?.description?.trim()||translateUi(cmsDefaults.home.description,"en")}});
  const planned=scheduled.length||home.sections?.find(s=>s.id==="hero")?.visible===false||home.introVisible===false?scheduled:[fallback];
  const slides: HomeBannerItem[] = planned.map((banner:HomeBannerItem)=>localizedBanner(banner.id==="villacheck-intro"&&!banner.title?.trim()&&!banner.description?.trim()&&(!banner.image||banner.image==="/villa-placeholder.svg")?fallback:banner,locale))
  const [readyImages, setReadyImages] = useState<Set<string>>(()=>new Set())
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [explicitPlay, setExplicitPlay] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const activeDot = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const changed = () => setReduced(query.matches)
    changed(); query.addEventListener("change", changed)
    return () => query.removeEventListener("change", changed)
  }, [])
  const touch = useRef<{x:number;y:number} | null>(null)
  const current = index % Math.max(slides.length, 1)
  const imageKey=(slide:HomeBannerItem)=>JSON.stringify([slide.id,slide.image,slide.mobileImage]);
  const currentReady=Boolean(slides[current]&&readyImages.has(imageKey(slides[current])));
  const imageReady=(slide:HomeBannerItem)=>setReadyImages(previous=>{const key=imageKey(slide);if(previous.has(key))return previous;const next=new Set(previous);next.add(key);return next;});
  const move = (step: number) =>
    setIndex((i) => (i + step + slides.length) % Math.max(slides.length, 1))
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (
      !currentReady || paused || ((hovered || focused) && !explicitPlay) || reduced ||
      slides.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      carouselIntervalMs(home.slideIntervalMs),
    )
    return () => clearInterval(timer)
  }, [paused, hovered, focused, explicitPlay, reduced, slides.length, home.slideIntervalMs, current, currentReady])
  useEffect(() => {
    const dot = activeDot.current, strip = dot?.parentElement
    if (dot && strip) strip.scrollLeft = dot.offsetLeft - strip.clientWidth / 2 + dot.clientWidth / 2
  }, [current])
  if (!slides.length) return null
  return (
    <div
      className="vc-banner"
      role="region"
      aria-roledescription="carousel"
      aria-label={uiText("แบนเนอร์ VillaCheck")}
      tabIndex={slides.length > 1 ? 0 : undefined}
      onMouseEnter={() => { setHovered(true); setExplicitPlay(false) }}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if (!(e.target as Element).closest(".vc-banner-pause")) setExplicitPlay(false)
      }}
      onFocusCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setExplicitPlay(false); setFocused(true) }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) { setFocused(false) }
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
          e.preventDefault(); setExplicitPlay(false)
          if (e.key === "Home") setIndex(0)
          else if (e.key === "End") setIndex(slides.length - 1)
          else move(e.key === "ArrowLeft" ? -1 : 1)
        }
      }}
      onTouchStart={(e) => {
        setExplicitPlay(false)
        touch.current = {x:e.touches[0].clientX,y:e.touches[0].clientY}
      }}
      onTouchCancel={() => { touch.current = null }}
      onTouchEnd={(e) => {
        if (touch.current !== null) {
          const dx = e.changedTouches[0].clientX - touch.current.x
          const dy = e.changedTouches[0].clientY - touch.current.y
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { move(dx < 0 ? 1 : -1) }
          touch.current = null
        }
      }}
    >
      {slides.map((slide, i) => (
        <article
          key={slide.id}
          data-banner-id={slide.id}
          className={`vc-banner-slide ${i === current ? "active" : ""}`}
          style={slide.id==="villacheck-intro"&&slide.image==="/illustrations/qr-evidence.svg"?{backgroundColor:"#0d2e59"}:undefined}
          aria-hidden={i !== current}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} / ${slides.length}`}
        >
          {(i===current||readyImages.has(imageKey(slide))||(currentReady&&i===(current+1)%slides.length))&&<picture>
            {slide.mobileImage && (
              <source media="(max-width: 767px)" srcSet={responsiveBannerImage(slide.mobileImage).srcSet||slide.mobileImage} sizes="100vw" />
            )}
            <img
              {...responsiveBannerImage(slide.image)}
              style={slide.id==="villacheck-intro"&&slide.image==="/illustrations/qr-evidence.svg"?{opacity:0.2}:undefined}
              alt={slide.title}
              loading="eager"
              fetchPriority={i===current?"high":"low"}
              decoding="async"
              width={1440}
              height={464}
              onLoad={()=>imageReady(slide)}
              onError={()=>imageReady(slide)}
            />
          </picture>}
          <div className="container vc-banner-copy">
            {slide.sponsored && (
              <span className="vc-ad-label">
                {locale==="en" ? (slide.demo ? "Advertisement · THB 4,990/month" : "Advertisement · Not a verification status") : (slide.demo ? uiText("โฆษณา · แพ็กเกจ 4,990 บาท/เดือน") : uiText("พื้นที่โฆษณา · ไม่ใช่สถานะการตรวจสอบ"))}
              </span>
            )}
            {slide.id==="villacheck-intro" && (locale==="en"?home.en?.eyebrow:home.eyebrow)?.trim() && <span className="kicker">{locale==="en"?home.en?.eyebrow:home.eyebrow}</span>}
            {slide.title?.trim() && <h2>{slide.title}</h2>}
            {slide.description?.trim() && <p>{slide.description}</p>}
            {slide.href && slide.label?.trim() && (
              <a
                className="sun-button"
                tabIndex={i === current ? 0 : -1}
                href={slide.href}
                {...(slide.href.startsWith("https:")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {slide.label} →
              </a>
            )}
          </div>
        </article>
      ))}
      {slides.length > 1 && (
          <div className="vc-banner-controls">
            <div className="vc-banner-dots" role="group" aria-label={uiText("เลือกแบนเนอร์")}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                ref={i === current ? activeDot : undefined}
                aria-label={uiText(`แบนเนอร์ ${i + 1}`)}
                aria-current={i === current ? "true" : undefined}
                className={i === current ? "active" : ""}
                onClick={() => setIndex(i)}
              />
            ))}
            </div>
            <button
              type="button"
              disabled={reduced}
              aria-pressed={paused || reduced}
              className="vc-banner-pause"
              aria-label={reduced ? uiText("ปิดสไลด์อัตโนมัติตามการตั้งค่าลดการเคลื่อนไหว") : paused ? uiText("เล่นสไลด์") : uiText("หยุดสไลด์")}
              onClick={() => { setPaused(!paused); setExplicitPlay(paused) }}
            >
              {paused || reduced ? "▶" : "Ⅱ"}
            </button>
          </div>
      )}
    </div>
  )
}
