import CmsNavigation,{cmsSections,type CmsTab} from "./CmsNavigation";
import {articleContentBlocks,articleEditorBlocks} from "./articleContent";
import CmsMediaPicker from "./CmsMediaPicker";
import useConfirmDialog from './useConfirmDialog';
import { uploadCmsImage } from "./cmsMediaUpload"
import CarouselSettings from "./CarouselSettings";
import {uiText} from "./uiLanguage";
import {usePublicLanguage} from "./publicLanguage";
import {translateMenu} from "./menuLanguage";
import {notifyCmsPublished} from "./cms-publish-sync";
import CmsIntroBannerEditor from "./CmsIntroBannerEditor";
import CmsChangeHistory from "./CmsChangeHistory";
import Advertising,{type Ad,type AdvertisingEditorHandle} from "./Advertising";
import CmsLiveCarousel from "./CmsLiveCarousel";
import CmsBannerInventory,{type BannerSelection} from "./CmsBannerInventory";
import CmsPresentationEditor from "./CmsPresentationEditor";
import CmsPreviewWindow from "./CmsPreviewWindow";
import HomeDiscoveryEditor from "./HomeDiscoveryEditor";
import { publicDestinations } from "../server/cms-home-config.mjs";
import BannerEditor,{cmsHomeBanners} from "./BannerEditor";
import { useCallback, useEffect, useRef, useState } from "react"
import { api, currentAccount } from "./api"
import { PortalShell, type Page } from "./prototype"
import {
  CmsScope,
  CmsPublicPage,
  type CmsBlock,
  type CmsContent,
  type CmsState,
} from "./cms"

const sectionLabels:Record<string,string>={hero:"Carousel / ค้นหา / เมนูลัด",promotion:"แพ็กเกจแนะนำ",how:"ขั้นตอนการใช้งาน",provinces:"ค้นหาตามจังหวัด",showcase:"ที่พักแนะนำ",qr:"แนะนำ QR",merchant:"สำหรับเจ้าของที่พัก",pricing:"แนะนำ Member Room",news:"ข่าวสารและอัปเดต",custom:"Section ที่เพิ่มเอง"};
const makeId = () => `item-${crypto.randomUUID()}`
const blankBlock = (): CmsBlock => ({
  id: makeId(),
  type: "text",
  title: "",
  body: "",
  image: "",
  alt: "",
  href: "",
  label: "",
  visible: true,
})
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  return (
    <label>
      {uiText(label)}
      {multiline ? (
        <textarea
          aria-label={label}
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}
function ImageField({
  value,
  onChange,
  media,
  label = "รูปภาพ",
}: {
  value: string
  onChange: (value: string) => void
  media: Media[]
  label?: string
}) {
  return <CmsMediaPicker label={label} value={value} onChange={onChange} library={media} />
}
function BlockEditor({
  blocks,
  onChange,
  media,
  title="Section เพิ่มเติม",
  limit=40,
  imageLanguage,
}: {
  blocks: CmsBlock[]
  onChange: (rows: CmsBlock[]) => void
  media: Media[]
  title?:string
  limit?:number
  imageLanguage?:"th"|"en"
}) {
  const update = (i: number, patch: Partial<CmsBlock>) =>
    onChange(blocks.map((b, j) => (i === j ? { ...b, ...patch } : b)))
  const move = (i: number, step: number) => {
    const rows = [...blocks],
      j = i + step
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
    onChange(rows)
  }
  return (
    <section className="cms-editor-section">
      <h2>{uiText(title)}</h2>
      <p>{uiText("เปลี่ยนลำดับ ซ่อน หรือเพิ่มข้อความ รูปภาพ และปุ่มลิงก์ได้")}</p>
      {blocks.map((b, i) => (
        <fieldset className="cms-block-editor" key={b.id}>
          <legend>{uiText("Section")}{i + 1}</legend>
          <div className="button-row">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >{uiText("↑ ขึ้น")}</button>
            <button
              type="button"
              disabled={i === blocks.length - 1}
              onClick={() => move(i, 1)}
            >{uiText("↓ ลง")}</button>
            <button
              type="button"
              onClick={() => onChange(blocks.filter((x) => x.id !== b.id))}
            >{uiText("ลบ Section")}</button>
          </div>
          <label>{uiText("รูปแบบ")}<select
              value={b.type}
              onChange={(e) =>
                update(i, { type: e.target.value as CmsBlock["type"] })
              }
            >
              <option value="text">{uiText("ข้อความ")}</option>
              <option value="image">{uiText("รูปภาพและข้อความ")}</option>
              <option value="cta">{uiText("ปุ่มลิงก์และข้อความ")}</option>
            </select>
          </label>
          <label className="cms-checkbox">
            <input
              type="checkbox"
              checked={b.visible}
              onChange={(e) => update(i, { visible: e.target.checked })}
            />{uiText("แสดง Section")}</label>
          <Field
            label={uiText("หัวข้อ")}
            value={b.title}
            onChange={(title) => update(i, { title })}
          />
          <Field
            label={uiText("เนื้อหา")}
            multiline
            value={b.body}
            onChange={(body) => update(i, { body })}
          />
          {b.type === "image" && (
            <>
              <ImageField
                label={imageLanguage?`${imageLanguage==="en"?"Content image":"รูปเนื้อหา"} ${blocks.slice(0,i+1).filter(row=>row.type==="image").length} (${imageLanguage.toUpperCase()})`:undefined}
                value={b.image}
                onChange={(image) => update(i, { image })}
                media={media}
              />
              <Field
                label={uiText("คำอธิบายภาพสำหรับผู้ใช้โปรแกรมอ่านหน้าจอ")}
                value={b.alt}
                onChange={(alt) => update(i, { alt })}
              />
            </>
          )}
          {b.type === "cta" && (
            <>
              <Field
                label={uiText("ข้อความบนปุ่ม")}
                value={b.label}
                onChange={(label) => update(i, { label })}
              />
              <Field
                label={uiText("ลิงก์ (HTTPS หรือ #page=pricing เป็นต้น)")}
                value={b.href}
                onChange={(href) => update(i, { href })}
              />
            </>
          )}
        </fieldset>
      ))}
      <button type="button" disabled={blocks.length>=limit} onClick={() => onChange([...blocks, blankBlock()])}>{uiText("+ เพิ่ม Section")}</button>
    </section>
  )
}
type Media = { id: string; name: string; mime: string; url: string; source?:string }
type Tab = CmsTab;
export default function AdminCms({
  go,
  renderHome,renderPreview,
}: {
  go: (page: Page, item?: string) => void
  renderPreview?:(page:Page,reference:string)=>React.ReactNode
  renderHome: React.ReactNode
}) {
  const {confirm,dialog}=useConfirmDialog();
  const {locale}=usePublicLanguage();
  const menuText=(value:string)=>translateMenu(value,locale);
  const [state, setState] = useState<CmsState | null>(null),
    [content, setContent] = useState<CmsContent | null>(null),
    [media, setMedia] = useState<Media[]>([]),
    [tab, setTab] = useState<Tab>("home"),
    [selected, setSelected] = useState("about"),
    [articleId, setArticleId] = useState(""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(false)
  const [previewPage,setPreviewPage]=useState<Page>("home"),[previewReference,setPreviewReference]=useState(""),[previewReferenceInput,setPreviewReferenceInput]=useState("");
  const [adsDirty,setAdsDirty]=useState(false),[visitedAds,setVisitedAds]=useState(false);
  const [bannerAds,setBannerAds]=useState<Ad[]>([]),[bannerSelection,setBannerSelection]=useState<BannerSelection|null>(null),[bannerAdsLoaded,setBannerAdsLoaded]=useState(false)
  const bannerAdEditor=useRef<AdvertisingEditorHandle>(null)
  const receiveBannerAds=useCallback((rows:Ad[])=>{setBannerAds(rows);setBannerAdsLoaded(true)},[])
  const selectBanner=(item:BannerSelection)=>{if(item.kind==="ad"&&!bannerAdEditor.current?.select(item.id))return;setBannerSelection(item)}
  useEffect(()=>{if(!bannerSelection)return;const frame=window.requestAnimationFrame(()=>document.getElementById(bannerSelection.kind==="ad"?"cms-property-ads":"cms-website-banners")?.scrollIntoView({behavior:"smooth",block:"start"}));return()=>window.cancelAnimationFrame(frame)},[bannerSelection])
  const [previewWindow,setPreviewWindow] = useState<Window|null>(null)
  const previewTarget = useRef<Window|null>(null)
  const closePreview = useCallback(()=>{
    const target=previewTarget.current;previewTarget.current=null
    setPreview(false);setPreviewWindow(null)
    if(target&&!target.closed)target.close()
  },[])
  useEffect(()=>()=>{previewTarget.current?.close()},[])
  const openPreview = () => {
    if(previewTarget.current&&!previewTarget.current.closed){previewTarget.current.focus();return}
    const target=window.open("/cms-preview.html","_blank")
    if(!target){setError("เบราว์เซอร์บล็อกแท็บ Preview กรุณาอนุญาตป๊อปอัปสำหรับเว็บไซต์นี้แล้วลองอีกครั้ง");return}
    previewTarget.current=target;setPreviewWindow(target);setPreview(true);setError("")
  }
  const accept = (r: CmsState) => {
    setState(r)
    setContent(r.draft.content)
    setDirty(false)
  }
  const [coreSettingsAllowed,setCoreSettingsAllowed]=useState(false);
  const load = async () => {
    const user = await currentAccount()
    setCoreSettingsAllowed(Boolean(user.businessPermissions?.includes("system.configure")))
    if (user.role !== "admin") throw Error("เฉพาะ Admin")
    accept(await api<CmsState>("/admin/cms"))
    await refreshMedia()
  }
  const refreshMedia=async()=>{const r=await api<{media:Media[]}>("/admin/cms/media");setMedia(r.media.map(m=>({...m,url:m.url||`/api/public/cms-media/${m.id}`})))}

  useEffect(() => {
    void load().catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || adsDirty) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty,adsDirty])
  const change = (next: CmsContent) => {
    setContent(next)
    setDirty(true)
    setMessage("")
  }
  const mutate = async (
    action: "save" | "publish" | "restore",
    version?: number,
  ) => {
    if (!state || !content) return
    setBusy(true)
    setError("")
    try {
      const r = await api<CmsState>(`/admin/cms/${action}`, {
        revision: state.draft.revision,
        ...(action === "save"
          ? { content }
          : action === "restore"
            ? { version }
            : {}),
      })
      accept(r)
      if(action==="publish")notifyCmsPublished()
      setMessage(
        action === "publish" ? "เผยแพร่สำเร็จแล้ว เว็บไซต์แสดงข้อมูลเวอร์ชันล่าสุด" : action === "restore"
            ? "คืนเวอร์ชันเป็นร่างแล้ว ตรวจ Preview และเผยแพร่เมื่อพร้อม"
            : "บันทึกร่างแล้ว เว็บจริงยังไม่เปลี่ยน",
      )

    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  const upload = async (file: File) => {
    setBusy(true)
    setError("")
    try {
      const r = await uploadCmsImage(file)
      setMedia((rows) => [r, ...rows])
      setMessage("อัปโหลดแล้ว เลือกรูปนี้ในหน้าเว็บหรือบทความได้")
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  const [homePanel,setHomePanel]=useState("hero");
  const [cmsSite,setCmsSite]=useState("");
  useEffect(()=>setCmsSite(window.location.host),[]);
  const chooseSection=(key:Tab)=>{setTab(key);if(content&&key==="articles"&&!content.articles.some(article=>article.id===articleId))setArticleId(content.articles[0]?.id||"");if(key==="media"||key==="advertising")void refreshMedia().catch(e=>setError(e.message));if(key==="advertising")setVisitedAds(true)};
  const currentSection=cmsSections.find(section=>section.id===tab)!;

  const p = content?.pages.find((p) => p.slug === selected),
    a = content?.articles.find((a) => a.id === articleId)
  return (
    <PortalShell
      role="Admin"
      page="admin-cms"
      go={async (target, item) => {
        if (
          !(dirty || adsDirty) ||
          await confirm(uiText("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจาก CMS หรือไม่?"))
        )
          go(target, item)
      }}
    >
      {dialog}<div className="portal-head">
        <div>
          <h1>{uiText("จัดการเว็บไซต์ CMS")}</h1>
          <p>{uiText("เลือกส่วนที่ต้องการแก้ไข แล้วบันทึกร่างก่อนเผยแพร่")}</p>{cmsSite&&<small className="cms-site-badge">{uiText("กำลังแก้ไขเว็บไซต์")}: {cmsSite}</small>}
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            if (!dirty || await confirm(uiText("ละทิ้งการแก้ไขที่ยังไม่บันทึกและโหลดล่าสุด?")))
              void load().catch((e) => setError(e.message))
          }}
        >{uiText("โหลดข้อมูลล่าสุด")}</button>
      </div>
      {error && (
        <p role="alert" className="form-message error-state">
          {uiText(error)}
        </p>
      )}
      {message && <p role="status">{uiText(message)}</p>}
      {!content || !state ? (
        <p>
          {error
            ? uiText("ไม่สามารถโหลด CMS กรุณาเข้าสู่ระบบด้วยบัญชี Admin")
            : uiText("กำลังโหลด CMS…")}
        </p>
      ) : (
        <>
          <div className="cms-toolbar cms-workflow-toolbar">
            <div className="cms-workflow-status"><strong className={"cms-status-badge "+(dirty?"is-dirty":state.draft.revision!==state.published.revision?"is-draft":"is-published")} role="status">{uiText(dirty?"มีการแก้ไขที่ยังไม่บันทึก":state.draft.revision!==state.published.revision?"มีร่างรอเผยแพร่":"เผยแพร่ล่าสุดแล้ว")}</strong>
            <span>{uiText("ร่าง v")}{state.draft.revision}{uiText(" · เผยแพร่ v")}{state.published.revision}
              {dirty ? uiText(" · ยังไม่บันทึก") : ""}
            </span><small>{uiText(dirty?"บันทึกร่างก่อนจึงจะเผยแพร่ได้":"Preview เพื่อตรวจหน้าเว็บก่อนเผยแพร่")}</small></div>
            <div className="button-row">
              <button
                disabled={busy || !dirty}
                onClick={() => void mutate("save")}
              >{uiText("บันทึกร่าง")}</button>
              <button className="outline-button cms-preview-button" disabled={busy} onClick={openPreview}>{uiText("Preview ก่อนเผยแพร่ ↗ (แท็บใหม่)")}</button>
              <button
                className="primary-button"
                disabled={
                  busy ||
                  dirty ||
                  !state.draft.revision ||
                  state.draft.revision === state.published.revision
                }
                onClick={async () => {
                  if (await confirm(uiText("เผยแพร่ร่างที่บันทึกไว้ขึ้นเว็บไซต์จริง?")))
                    void mutate("publish")
                }}
              >{uiText("เผยแพร่")}</button>
            </div>
          </div>
          <div className="cms-console-layout">
          <CmsNavigation active={tab} onSelect={chooseSection} coreSettingsAllowed={coreSettingsAllowed}/>
          <div className={`cms-workspace${preview?" has-preview":""}`}><header className="cms-editor-intro"><h2>{uiText("กำลังแก้ไข")}: {menuText(currentSection.label)}</h2><p>{uiText(currentSection.help)}</p></header>
          {tab==="advertising"&&<><CarouselSettings/>{!bannerAdsLoaded&&<p role="status">{uiText("กำลังโหลดรายการแบนเนอร์ทั้งหมด…")}</p>}<CmsLiveCarousel content={content} ads={bannerAds} onSelect={selectBanner}/><CmsBannerInventory content={content} ads={bannerAds} selection={bannerSelection} onSelect={selectBanner} onReload={()=>{setError("");void bannerAdEditor.current?.reload().catch(e=>setError(e.message))}} onCreate={kind=>{if(kind==="ad"){selectBanner({kind:"ad",id:""});return}const id=`banner-${crypto.randomUUID()}`;change({...content,home:{...content.home,banners:[...cmsHomeBanners(content),{id,image:content.home.images[0]||"",mobileImage:"",title:"แบนเนอร์ใหม่",description:"",href:"#page=directory",label:"ดูรายละเอียด",visible:false,sponsored:false,startsAt:"",endsAt:""}]}});setBannerSelection({kind:"cms",id})}}/></>}

          {preview && previewWindow && (<CmsPreviewWindow target={previewWindow} onClose={closePreview}>
            <section id="cms-draft-preview" className="cms-browser-preview" aria-label={uiText("เนื้อหาก่อนเผยแพร่")}>
              <div className="cms-preview-heading"><div><h2>{uiText("Preview ก่อนเผยแพร่")}</h2><p>{uiText("แสดงข้อมูลร่างล่าสุด รวมการแก้ไขที่ยังไม่ได้บันทึก · เว็บไซต์จริงยังไม่เปลี่ยน · กลับไปแก้ไขในแท็บ CMS ได้")}</p>{adsDirty&&<p role="status">{uiText("มีโฆษณาที่ยังไม่บันทึก กรุณาบันทึกแบนเนอร์แต่ละรายการก่อนดู Preview โฆษณาล่าสุด")}</p>}</div><button type="button" className="outline-button" onClick={closePreview}>{uiText("ปิด Preview")}</button></div>
              {tab==="presentation"&&<><label>{uiText("หน้าสำหรับ Preview")}<select aria-label={uiText("หน้าสำหรับ Preview")} value={previewPage} onChange={e=>setPreviewPage(e.target.value as Page)}>{([["home","หน้าแรก"],["directory","ค้นหาที่พัก"],["scan","สแกน QR"],["login","เข้าสู่ระบบ User"],["owner-auth","เข้าสู่ระบบ Merchant"],["user-registration","สมัคร User"],["owner-registration","สมัคร Merchant"],["verify","หน้าที่พัก / QR"],["villa-report","แจ้งปัญหา"],["contact","ติดต่อเรา"]] as [Page,string][]).map(([value,label])=><option key={value} value={value}>{uiText(label)}</option>)}</select></label>{previewPage==="verify"&&<div><label>{uiText("QR ที่พักสำหรับ Preview")}<input value={previewReferenceInput} onChange={e=>setPreviewReferenceInput(e.target.value)} placeholder="VC-…"/></label><button type="button" onClick={()=>setPreviewReference(previewReferenceInput)}>{uiText("แสดงที่พัก")}</button></div>}</>}
              {tab==="presentation"&&previewPage!=="home"&&renderPreview?<CmsScope content={content}><div onSubmitCapture={e=>{e.preventDefault();e.stopPropagation()}} onClickCapture={e=>{if((e.target as HTMLElement).closest("button")){e.preventDefault();e.stopPropagation()}}}>{renderPreview(previewPage,previewReference)}</div></CmsScope> : ["home","steps","navigation","site","presentation","advertising"].includes(tab) ? (
                <CmsScope content={content}>{renderHome}</CmsScope>
              ) : (
                <CmsPublicPage
                  page={
                    tab === "articles"
                      ? a
                        ? "article-detail"
                        : "articles"
                      : tab === "faqs"
                        ? "help"
                        : selected
                  }
                  item={a?.id || ""}
                  content={content}
                  preview
                  go={(target, item) => {
                    if (target === "article-detail") {
                      setTab("articles")
                      setArticleId(item || "")
                    } else if (target === "articles") {
                      setArticleId("")
                    } else {
                      setTab("home")
                    }
                  }}
                />
              )}
            </section></CmsPreviewWindow>
          )}
          {visitedAds&&<div id="cms-property-ads" className="cms-ad-workspace" hidden={tab!=="advertising"||bannerSelection?.kind!=="ad"}><Advertising adsOnly hideList editorRef={bannerAdEditor} onLoaded={receiveBannerAds} onLoadError={message=>{setError(message);setBannerAdsLoaded(true)}} onDirtyChange={setAdsDirty} mediaLibrary={media} onMediaUploaded={item=>setMedia(rows=>[item,...rows])}/></div>}
          <fieldset
            disabled={busy}
            style={tab==="advertising"&&bannerSelection?.kind!=="cms"?{display:"none"}:undefined}
            className={`merchant-panel portal-form cms-editor cms-editor-${tab}`}
          >
            {tab === "steps" && <>
              <section className="cms-three-step-settings">
                {content.home.sections.filter(section=>section.id==="how").map(section=><div key={section.id}>
                  <label className="cms-checkbox"><input type="checkbox" checked={section.visible} onChange={e=>change({...content,home:{...content.home,sections:content.home.sections.map(row=>row.id===section.id?{...row,visible:e.target.checked}:row)}})}/>{uiText("แสดงตรวจสอบใน 3 ขั้นตอนบนหน้าแรก")}</label>
                  <label>{uiText("หัวข้อส่วนตรวจสอบใน 3 ขั้นตอน")}<input value={section.title} onChange={e=>change({...content,home:{...content.home,sections:content.home.sections.map(row=>row.id===section.id?{...row,title:e.target.value}:row)}})}/></label>
                  <label>{uiText("คำอธิบายส่วนตรวจสอบใน 3 ขั้นตอน")}<textarea value={section.description} onChange={e=>change({...content,home:{...content.home,sections:content.home.sections.map(row=>row.id===section.id?{...row,description:e.target.value}:row)}})}/></label>
                </div>)}
              </section>
              <CmsPresentationEditor servicesOnly content={content} onChange={change} media={media} onUploaded={item=>setMedia(rows=>[item,...rows])}/>
            </>}
            {tab === "presentation" && <CmsPresentationEditor content={content} onChange={change} media={media} onUploaded={item=>setMedia(rows=>[item,...rows])}/>}
            {tab === "advertising"&&bannerSelection?.kind==="cms" && <BannerEditor hideInventory selectionId={bannerSelection?.kind==="cms"?bannerSelection.id:undefined} onSelectionChange={id=>setBannerSelection({kind:"cms",id})} content={content} onChange={change} media={media} onUploaded={item=>setMedia(rows=>[item,...rows])}/>}
            {tab === "data" && <section><h2>{uiText("ข้อมูลที่แสดงบนหน้าเว็บ")}</h2><p>{uiText("ข้อมูลจริงของที่พัก แพ็กเกจ และบัญชี จัดการผ่านเมนูที่เกี่ยวข้อง โดยใช้ฐานข้อมูลเดียวกับหน้าเว็บ")}</p><div className="button-row">{([["admin-villas",uiText("ข้อมูลที่พัก / รูป / สถานะ")],["admin-packages",uiText("ราคาและสิทธิ์แพ็กเกจ")],["admin-users",uiText("บัญชี User")],["admin-owners",uiText("บัญชี Merchant")],["admin-reviews",uiText("รีวิวลูกค้า")],["admin-pending-villas",uiText("ตรวจ Villa / ยืนยันเจ้าของบ้าน")],["admin-approved-villas",uiText("ส่งสื่อทาง Social Media")],["admin-receiving-bank",uiText("บัญชีรับเงิน")]] as [Page,string][]).map(([target,label])=><button type="button" key={target} onClick={async ()=>{if(!(dirty||adsDirty)||await confirm(uiText("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจาก CMS หรือไม่?")))go(target)}}>{menuText(label)}</button>)}</div></section>}
            {tab === "home" && (
              <>
                <nav className="cms-home-panels" aria-label={uiText("ส่วนแก้ไขหน้าแรก")}>
                  {[["hero",uiText("แบนเนอร์แรก")],["discovery",uiText("ช่องค้นหา / เมนูลัด")],["sections",uiText("ลำดับ Section")],["slides",uiText("ภาพสไลด์")],["blocks",uiText("Section เพิ่มเติม")]].map(([key,label])=><button key={key} type="button" aria-pressed={homePanel===key} className={homePanel===key?"active":""} onClick={()=>setHomePanel(key)}>{menuText(label)}</button>)}
                </nav>
                {homePanel==="discovery"&&<HomeDiscoveryEditor content={content} onChange={change} media={media}/>}
                {homePanel==="hero"&&<CmsIntroBannerEditor content={content} onChange={change} media={media} onUploaded={item=>setMedia(rows=>[item,...rows])}/>}
                {homePanel==="sections"&&<>
                <h2>{uiText("ลำดับ Section หน้าแรก")}</h2><p>{uiText("ส่วนข่าวสารใช้รายการที่เปิดแสดงจากแท็บข่าวสาร / บทความ เรียงตามลำดับใน CMS")}</p>
                {content.home.sections.filter(s=>!["promotion","pricing"].includes(s.id)).map((s, i, visibleSections) => (
                  <div className="cms-block-editor" key={s.id}>
                    <strong>{uiText(sectionLabels[s.id] || s.id)}</strong>
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={s.visible}
                        onChange={(e) =>
                          change({
                            ...content,
                            home: {
                              ...content.home,
                              sections: content.home.sections.map((x) =>
                                x.id === s.id
                                  ? { ...x, visible: e.target.checked }
                                  : x,
                              ),
                            },
                          })
                        }
                      />{uiText("แสดง Section")}</label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={async () => {
                          const sections = [...visibleSections]
                          ;[sections[i - 1], sections[i]] = [
                            sections[i],
                            sections[i - 1],
                          ]
                          change({
                            ...content,
                            home: { ...content.home, sections:[...sections,...content.home.sections.filter(x=>["promotion","pricing"].includes(x.id))] },
                          })
                        }}
                      >{uiText("↑ ขึ้น")}</button>
                      <button
                        disabled={i === visibleSections.length - 1}
                        onClick={async () => {
                          const sections = [...visibleSections]
                          ;[sections[i + 1], sections[i]] = [
                            sections[i],
                            sections[i + 1],
                          ]
                          change({
                            ...content,
                            home: { ...content.home, sections:[...sections,...content.home.sections.filter(x=>["promotion","pricing"].includes(x.id))] },
                          })
                        }}
                      >{uiText("↓ ลง")}</button>
                    </div>
                    {["how", "provinces", "showcase", "news", "qr", "merchant", "pricing"].includes(
                      s.id,
                    ) && (
                      <details className="cms-card-details">
                        <summary>{uiText("แก้ไขข้อความ / ภาพ Section")}</summary>
                        {["qr","merchant"].includes(s.id)&&<ImageField label={uiText("ภาพประกอบ Section (เว้นว่างใช้ภาพเริ่มต้น)")} value={s.image||""} media={media} onChange={image=>change({...content,home:{...content.home,sections:content.home.sections.map(row=>row.id===s.id?{...row,image}:row)}})}/>}
                        <Field
                          label={uiText("หัวข้อ Section")}
                          multiline
                          value={s.title}
                          onChange={(title) =>
                            change({
                              ...content,
                              home: {
                                ...content.home,
                                sections: content.home.sections.map((x) =>
                                  x.id === s.id ? { ...x, title } : x,
                                ),
                              },
                            })
                          }
                        />
                        {s.id !== "pricing" && (
                          <Field
                            label={uiText("คำอธิบาย Section")}
                            multiline
                            value={s.description}
                            onChange={(description) =>
                              change({
                                ...content,
                                home: {
                                  ...content.home,
                                  sections: content.home.sections.map((x) =>
                                    x.id === s.id ? { ...x, description } : x,
                                  ),
                                },
                              })
                            }
                          />
                        )}
                      </details>
                    )}
                  </div>
                ))}
                </>}
                {homePanel==="slides"&&<>
                <button type="button" onClick={async ()=>{setTab("advertising");setVisitedAds(true)}}>{uiText("จัดการแบนเนอร์และโฆษณาทุกสไลด์")}</button><h2>{uiText("ภาพสไลด์สำรอง (ใช้เมื่อยังไม่มีรายการแบนเนอร์)")}</h2>
                {content.home.images.map((url, i) => (
                  <div className="cms-block-editor" key={i}>
                    <ImageField
                      label={uiText(`ภาพ ${i + 1}`)}
                      value={url}
                      onChange={(value) =>
                        change({
                          ...content,
                          home: {
                            ...content.home,
                            images: content.home.images.map((x, j) =>
                              i === j ? value : x,
                            ),
                          },
                        })
                      }
                      media={media}
                    />
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={async () => {
                          const images = [...content.home.images]
                          ;[images[i - 1], images[i]] = [
                            images[i],
                            images[i - 1],
                          ]
                          change({
                            ...content,
                            home: { ...content.home, images },
                          })
                        }}
                      >{uiText("↑ ขึ้น")}</button>
                      <button
                        disabled={content.home.images.length === 1}
                        onClick={() =>
                          change({
                            ...content,
                            home: {
                              ...content.home,
                              images: content.home.images.filter(
                                (_, j) => i !== j,
                              ),
                            },
                          })
                        }
                      >{uiText("ลบภาพ")}</button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    change({
                      ...content,
                      home: {
                        ...content.home,
                        images: [...content.home.images, ""],
                      },
                    })
                  }
                >{uiText("+ เพิ่มภาพสไลด์")}</button>
                </>}
                {homePanel==="blocks"&&<BlockEditor
                  blocks={content.home.blocks}
                  media={media}
                  onChange={(blocks) =>
                    change({ ...content, home: { ...content.home, blocks } })
                  }
                />}
              </>
            )}
            {tab === "navigation" && (
              <>
                <h2>{uiText("เมนูเว็บไซต์")}</h2><p>{uiText("เมนูติดต่อเราจะแสดงเสมอ เมนูหน้าหลัก วิธีการทำงาน และแพ็กเกจไม่ได้ใช้ในแถบเมนูหลักแล้ว")}</p>
                {content.navigation.map((n, i) => (
                  <div className="cms-block-editor" key={n.id}>
                    <Field
                      label={uiText("ชื่อเมนู")}
                      value={n.label}
                      onChange={(label) =>
                        change({
                          ...content,
                          navigation: content.navigation.map((x) =>
                            x.id === n.id ? { ...x, label } : x,
                          ),
                        })
                      }
                    />
                    <Field
                      label={uiText("ลิงก์ (HTTPS หรือหน้าสาธารณะในระบบ)")}
                      value={n.href}
                      onChange={(href) =>
                        change({
                          ...content,
                          navigation: content.navigation.map((x) =>
                            x.id === n.id ? { ...x, href } : x,
                          ),
                        })
                      }
                    />
                    <label>{uiText("เลือกหน้าปลายทาง")}<select aria-label={uiText("เลือกหน้าปลายทาง")} value="" onChange={e=>{if(e.target.value)change({...content,navigation:content.navigation.map(x=>x.id===n.id?{...x,href:e.target.value}:x)});}}>
                      <option value="">{uiText("เลือกหน้าเพื่อใส่ลิงก์อัตโนมัติ…")}</option>
                      {publicDestinations.map(x=><option key={x.href} value={x.href}>{uiText(x.label)}</option>)}
                      {content.pages.map(p=><option key={p.slug} value={`#page=cms-page&item=${p.slug}`}>{uiText(p.title)}</option>)}
                    </select></label>
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        disabled={n.href==="#page=contact"}
                        checked={n.visible}
                        onChange={(e) =>
                          change({
                            ...content,
                            navigation: content.navigation.map((x) =>
                              x.id === n.id
                                ? { ...x, visible: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />{uiText("แสดงเมนู")}</label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={async () => {
                          const rows = [...content.navigation]
                          ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                          change({ ...content, navigation: rows })
                        }}
                      >{uiText("↑ ขึ้น")}</button>
                      <button
                        disabled={n.href==="#page=contact"}
                        onClick={() =>
                          change({
                            ...content,
                            navigation: content.navigation.filter(
                              (x) => x.id !== n.id,
                            ),
                          })
                        }
                      >{uiText("ลบเมนู")}</button>
                    </div>
                  </div>
                ))}
                <button
                  disabled={content.navigation.length >= 12}
                  onClick={() =>
                    change({
                      ...content,
                      navigation: [
                        ...content.navigation,
                        {
                          id: makeId(),
                          label: "เมนูใหม่",
                          href: "#page=about",
                          visible: true,
                        },
                      ],
                    })
                  }
                >{uiText("+ เพิ่มเมนู")}</button>
                <p>{uiText("เพิ่มได้สูงสุด 12 เมนู หน้าที่สร้างใหม่ใช้ลิงก์ #page=cms-page&amp;item=รหัสหน้า ตามลิงก์ในแท็บหน้าเว็บ")}</p>
              </>
            )}
            {tab === "pages" && (
              <>
                <label>{uiText("เลือกหน้าเว็บ")}<select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {content.pages.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.title} ({p.slug})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={async () => {
                    const slug = `page-${crypto.randomUUID()}`
                    change({
                      ...content,
                      pages: [
                        ...content.pages,
                        {
                          slug,
                          kicker: "",
                          title: "หน้าใหม่",
                          description: "",
                          body: "",
                          blocks: [],
                        },
                      ],
                    })
                    setSelected(slug)
                  }}
                >{uiText("+ เพิ่มหน้าเว็บ")}</button>
                {p && (
                  <>
                    <p>{uiText("ลิงก์หน้าเว็บ: #")}{new URLSearchParams({
                        page: "cms-page",
                        item: p.slug,
                      }).toString()}
                    </p>
                    {([
                      ["kicker", uiText("ข้อความเหนือหัวข้อ")],
                      ["title", uiText("ชื่อหน้า")],
                      ["description", uiText("คำอธิบาย")],
                      ["body", uiText("เนื้อหา")],
                    ] as const).map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        multiline={key === "body"}
                        value={p[key]}
                        onChange={(value) =>
                          change({
                            ...content,
                            pages: content.pages.map((x) =>
                              x.slug === p.slug ? { ...x, [key]: value } : x,
                            ),
                          })
                        }
                      />
                    ))}
                    <BlockEditor
                      blocks={p.blocks}
                      media={media}
                      onChange={(blocks) =>
                        change({
                          ...content,
                          pages: content.pages.map((x) =>
                            x.slug === p.slug ? { ...x, blocks } : x,
                          ),
                        })
                      }
                    />
                    {p.slug.startsWith("page-") && (
                      <button
                        onClick={async () => {
                          change({
                            ...content,
                            pages: content.pages.filter(
                              (x) => x.slug !== p.slug,
                            ),
                          })
                          setSelected("about")
                        }}
                      >{uiText("ลบหน้าที่เพิ่มเอง")}</button>
                    )}
                  </>
                )}
              </>
            )}
            {tab === "articles" && (
              <>
                <h2>{uiText("ข่าวสารและอัปเดต")}</h2>
                <label>{uiText("เลือกบทความ")}<select
                    value={articleId}
                    onChange={(e) => setArticleId(e.target.value)}
                  >
                    <option value="">{uiText("เลือกบทความ…")}</option>
                    {content.articles.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                        {x.visible ? "" : uiText(" (ซ่อน)")}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={async () => {
                    const id = makeId()
                    change({
                      ...content,
                      articles: [
                        ...content.articles,
                        {
                          id,
                          title: "บทความใหม่",
                          description: "",
                          body: "",
                          image: "",
                          visible: false,
                        },
                      ],
                    })
                    setArticleId(id)
                  }}
                >{uiText("+ เพิ่มบทความ")}</button>
                {a && (
                  <>
                    <div className="cms-article-languages">
                      {(["th","en"] as const).map(language=>{
                        const english=language==="en",values=english?a.en:a;
                        const update=(patch:Partial<typeof a>)=>change({...content,articles:content.articles.map(x=>x.id===a.id?{...x,...patch}:x)});
                        const fieldChange=(key:"title"|"description"|"image"|"alt",value:string)=>update(english?{en:{...a.en,[key]:value}}:{[key]:value});
                        return <section className="cms-article-language" data-article-language={language} key={a.id+language}>
                          <h3>{english?"English (EN)":"ภาษาไทย (TH)"}</h3>
                          <ImageField label={english?"English cover image (EN)":"ภาพปกข่าว ภาษาไทย (TH)"} value={values?.image||""} media={media} onChange={value=>fieldChange("image",value)}/>
                          <Field label={english?"English cover alt":"คำอธิบายภาพปก ภาษาไทย"} value={values?.alt||""} onChange={value=>fieldChange("alt",value)}/>
                          <Field label={english?"English title":"ชื่อบทความ ภาษาไทย"} value={values?.title||""} onChange={value=>fieldChange("title",value)}/>
                          <Field label={english?"English description":"คำอธิบายบทความ ภาษาไทย"} value={values?.description||""} onChange={value=>fieldChange("description",value)}/>
                          <BlockEditor title={english?"English content and images":"เนื้อหาและรูปประกอบ ภาษาไทย"} limit={42} imageLanguage={language} blocks={articleEditorBlocks(a,language)} media={media} onChange={blocks=>update(english?{en:{...a.en,body:"",detailImage:"",blocks}}:{body:"",detailImage:"",blocks,...(a.en?.blocks===undefined?{en:{...a.en,body:"",detailImage:"",blocks:articleContentBlocks(a,"en")}}:{})})}/>
                        </section>;
                      })}
                    </div>

                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={a.visible}
                        onChange={(e) =>
                          change({
                            ...content,
                            articles: content.articles.map((x) =>
                              x.id === a.id
                                ? { ...x, visible: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />{uiText("แสดงบทความหลังเผยแพร่")}</label>
                    <div className="button-row">
                      <button
                        disabled={content.articles[0].id === a.id}
                        onClick={async () => {
                          const rows = [...content.articles],
                            i = rows.findIndex((x) => x.id === a.id)
                          ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                          change({ ...content, articles: rows })
                        }}
                      >{uiText("↑ เลื่อนขึ้น")}</button>
                      <button
                        onClick={async () => {
                          change({
                            ...content,
                            articles: content.articles.filter(
                              (x) => x.id !== a.id,
                            ),
                          })
                          setArticleId("")
                        }}
                      >{uiText("ลบบทความ")}</button>
                    </div>
                  </>
                )}
              </>
            )}
            {tab === "faqs" && (
              <>
                {content.faqs.map((f, i) => (
                  <div className="cms-block-editor" key={f.id}>
                    <Field
                      label={uiText(`คำถาม ${i + 1}`)}
                      value={f.question}
                      onChange={(question) =>
                        change({
                          ...content,
                          faqs: content.faqs.map((x) =>
                            x.id === f.id ? { ...x, question } : x,
                          ),
                        })
                      }
                    />
                    <Field
                      label={uiText("คำตอบ")}
                      multiline
                      value={f.answer}
                      onChange={(answer) =>
                        change({
                          ...content,
                          faqs: content.faqs.map((x) =>
                            x.id === f.id ? { ...x, answer } : x,
                          ),
                        })
                      }
                    />
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={f.visible}
                        onChange={(e) =>
                          change({
                            ...content,
                            faqs: content.faqs.map((x) =>
                              x.id === f.id
                                ? { ...x, visible: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />{uiText("แสดง FAQ")}</label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={async () => {
                          const rows = [...content.faqs]
                          ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                          change({ ...content, faqs: rows })
                        }}
                      >{uiText("↑ เลื่อนขึ้น")}</button>
                      <button
                        onClick={() =>
                          change({
                            ...content,
                            faqs: content.faqs.filter((x) => x.id !== f.id),
                          })
                        }
                      >{uiText("ลบ FAQ")}</button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    change({
                      ...content,
                      faqs: [
                        ...content.faqs,
                        {
                          id: makeId(),
                          question: "คำถามใหม่",
                          answer: "",
                          visible: true,
                        },
                      ],
                    })
                  }
                >{uiText("+ เพิ่ม FAQ")}</button>
              </>
            )}
            {coreSettingsAllowed && tab === "business" && <><h2>{uiText("กติกาอายุสิทธิ์เดิมและข้อความแจ้งชำระ")}</h2><p>{uiText("แพ็กเกจ 990 / 1,990 / 2,990 / 4,990 คิดต่อที่พัก ครั้งละ 1 เดือน รวมภาษี ค่าด้านล่างใช้เฉพาะแพ็กเกจเดิมนอก 4 ระดับนี้ ใบแจ้งชำระเดิมคงยอดและระยะเวลาเดิม")}</p><label>{uiText("ชำระครั้งแรกได้สิทธิ์กี่เดือน")}<input aria-label={uiText("ชำระครั้งแรกได้สิทธิ์กี่เดือน")} type="number" min="1" max="36" value={content.business.monthlyInitialMonths} onChange={e=>change({...content,business:{...content.business,monthlyInitialMonths:Number(e.target.value)}})}/></label><label>{uiText("ต่ออายุครั้งถัดไปได้สิทธิ์กี่เดือน")}<input aria-label={uiText("ต่ออายุครั้งถัดไปได้สิทธิ์กี่เดือน")} type="number" min="1" max="36" value={content.business.monthlyRenewalMonths} onChange={e=>change({...content,business:{...content.business,monthlyRenewalMonths:Number(e.target.value)}})}/></label><h2>{uiText("OTP และการเข้าสู่ระบบ")}</h2><Field label={uiText("หัวข้ออีเมล OTP (SMTP)")} value={content.business.emailOtpSubject} onChange={emailOtpSubject=>change({...content,business:{...content.business,emailOtpSubject}})}/><Field label={uiText("ข้อความอีเมล OTP (SMTP)")} multiline value={content.business.emailOtpBody} onChange={emailOtpBody=>change({...content,business:{...content.business,emailOtpBody}})}/><Field label={uiText("ข้อความ SMS OTP (SMS API)")} multiline value={content.business.smsOtpBody} onChange={smsOtpBody=>change({...content,business:{...content.business,smsOtpBody}})}/><Field label={uiText("Email OTP Template ID ของผู้ให้บริการ (เว้นว่างใช้ค่าที่ตั้งไว้เดิม)")} value={content.business.emailOtpTemplateId} onChange={emailOtpTemplateId=>change({...content,business:{...content.business,emailOtpTemplateId}})}/><p>{uiText("ข้อความ OTP ต้องมี ")}{'{{code}}'}{uiText(" และ ")}{'{{minutes}}'}{uiText(" อายุรหัสยังเป็น 5 นาที เมื่อใช้ Ready to Use SMS OTP หรือ Email OTP API ผู้ให้บริการเป็นผู้สร้างรหัสและใช้ข้อความที่อนุมัติในระบบของผู้ให้บริการ ฟิลด์ข้อความด้านบนใช้กับ SMTP และ SMS API เท่านั้น")}</p><label className="cms-checkbox"><input type="checkbox" checked={content.business.facebookLoginEnabled} onChange={e=>change({...content,business:{...content.business,facebookLoginEnabled:e.target.checked}})}/>{uiText("เปิด Facebook Login หลัง Meta อนุมัติและทดสอบแล้ว")}</label><h2>{uiText("อีเมลแจ้งชำระแพ็กเกจ")}</h2><Field label={uiText("หัวข้ออีเมลแจ้งชำระ")} value={content.business.paymentEmailSubject} onChange={paymentEmailSubject=>change({...content,business:{...content.business,paymentEmailSubject}})}/><Field label={uiText("ข้อความนำอีเมลแจ้งชำระ")} multiline value={content.business.paymentEmailIntro} onChange={paymentEmailIntro=>change({...content,business:{...content.business,paymentEmailIntro}})}/><p>{uiText("ใช้คำแทน ")}{'{{merchant}}'}, {'{{package}}'}, {'{{villa}}'}{uiText(" ได้ ระบบเติมยอดชำระ อายุสิทธิ์ เลขใบแจ้งชำระ และลิงก์ชำระให้อัตโนมัติ การแก้ข้อความไม่แก้ข้อมูลธุรกรรม และไม่ส่งอีเมลเองตอนเผยแพร่")}</p><section className="cms-block-editor" data-authored-content="email-preview"><h3>{uiText("ข้อความอีเมล (ข้อมูลจำลอง)")}</h3><strong>{content.business.paymentEmailSubject.replace(/\{\{(merchant|package|villa)\}\}/g,(_,k)=>({merchant:"เจ้าของที่พัก",package:"แพ็กเกจ",villa:"Villa "}[k as "merchant"|"package"|"villa"]))}</strong><p className="cms-prose">{content.business.paymentEmailIntro.replace(/\{\{(merchant|package|villa)\}\}/g,(_,k)=>({merchant:"เจ้าของที่พัก",package:"แพ็กเกจ",villa:"Villa "}[k as "merchant"|"package"|"villa"]))}</p><p>{uiText("ระบบจะแนบรายละเอียดใบแจ้งชำระจริงให้อัตโนมัติเมื่อมีการสร้างใบแจ้งชำระ")}</p></section></>}
            {coreSettingsAllowed && tab === "site" && (
              <>
                <ImageField
                  label={uiText("โลโก้")}
                  value={content.site.logo}
                  onChange={(logo) =>
                    change({ ...content, site: { ...content.site, logo } })
                  }
                  media={media}
                />
                <label>{uiText("สีหลักของปุ่ม")}<input
                    type="color"
                    value={content.site.accent}
                    onChange={(e) =>
                      change({
                        ...content,
                        site: { ...content.site, accent: e.target.value },
                      })
                    }
                  />
                </label>
                {([
                  ["name", uiText("ชื่อเว็บไซต์")],
                  ["description", uiText("คำอธิบายเว็บไซต์ / SEO")],
                  ["email", uiText("อีเมลติดต่อ")],
                  ["phone", uiText("เบอร์โทร")],
                  ["hours", uiText("เวลาทำการ")],
                  ["facebook", "Facebook URL"],
                  ["instagram", "Instagram URL"],
                  ["line", "LINE URL"],
                ] as const).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={content.site[key]}
                    onChange={(value) =>
                      change({
                        ...content,
                        site: { ...content.site, [key]: value },
                      })
                    }
                  />
                ))}
                <h3>{uiText("บัญชีและ QR รับเงิน")}</h3>
                <p>{uiText("จัดการบัญชี สร้าง QR พร้อมเพย์คงที่ และส่งอีเมลให้ Merchant ได้ที่หน้าบัญชีรับเงิน ข้อมูลที่บันทึกในหน้านั้นใช้กับใบแจ้งชำระใหม่ โดยใบเดิมคงข้อมูลเดิม")}</p>
                <button className="outline-button" onClick={()=>go("admin-receiving-bank")}>{uiText("จัดการบัญชีรับเงิน")}</button>
                <p>{uiText("ช่องว่างของช่องทางติดต่อใช้ค่าที่ตั้งไว้เดิม ระบบตรวจสลิปยังใช้คนตรวจตาม Flow")}</p>
              </>
            )}
            {tab === "media" && (
              <>
                <h2>{uiText("คลังรูปภาพ")}</h2>
                <label>{uiText("อัปโหลด JPG/PNG ไม่เกิน 5 MB")}<input
                    type="file"
                    disabled={busy}
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void upload(file)
                      e.target.value = ""
                    }}
                  />
                </label>
                <p>{uiText("รูปที่ยังไม่อยู่ในเนื้อหาที่เผยแพร่เปิดดูได้เฉพาะ Admin รูปเก็บไว้เพื่อรองรับการย้อนเวอร์ชัน")}</p>
                <div className="cms-media-grid">
                  {media.map((m) => (
                    <article key={m.id}>
                      <img loading="lazy" decoding="async" src={m.url} alt={m.name.replace("cms-image:", "")} />
                      <p>{m.name.replace("cms-image:", "")}</p>
                      <input aria-label={uiText("URL รูปภาพ")} readOnly value={m.url} />
                      {m.source==="banner"?<p>{uiText("รูปจากแบนเนอร์ · เลือกใช้ซ้ำได้จากคลังรูป")}</p>:<button
                        disabled={busy || dirty}
                        onClick={async () => {
                          if (
                            !await confirm(uiText("ลบรูปนี้? รูปที่อยู่ในร่างหรือประวัติจะลบไม่ได้"))
                          )
                            return
                          setBusy(true)
                          void api("/admin/cms/media/delete", { id: m.id })
                            .then(() => {
                              setMedia((rows) =>
                                rows.filter((x) => x.id !== m.id),
                              )
                              setMessage("ลบรูปแล้ว")
                            })
                            .catch((e) => setError(e.message))
                            .finally(() => setBusy(false))
                        }}
                      >{uiText("ลบรูปที่ไม่ได้ใช้")}</button>}
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "history" && <CmsChangeHistory revision={state.draft.revision} onRestored={result=>{if(result)accept(result);setVisitedAds(false);setAdsDirty(false);setBannerSelection(null);setBannerAds([]);setBannerAdsLoaded(false)}}/>}
          </fieldset>

          {adsDirty&&<p role="status">{uiText("มีแบนเนอร์โฆษณาที่ยังไม่บันทึก")}</p>}
          </div>
          </div>
        </>
      )}
    </PortalShell>
  )
}
