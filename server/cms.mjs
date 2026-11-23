import {assertWriteSession} from './write-session.mjs';
import {assertCmsCoreUnchanged} from './business-permissions.mjs';
import {recordCmsPublication} from './cms-publication.mjs';
import { uploadCmsMedia } from "./cms-media-upload.mjs"
import {readCarouselTiming,saveCarouselTiming} from "./carousel-settings.mjs";
import {CAROUSEL_DEFAULT_MS,CAROUSEL_MIN_MS,CAROUSEL_MAX_MS} from "./carousel-timing.mjs";
import {stagingDemosEnabled} from './demo-villa-visibility.mjs';
import {validateBannerEnglish,bannerMedia} from "./banner-language.mjs";
import {initializeCmsChanges,recordCmsChange,cmsChangeById,cmsChanges,archivedCmsMediaUsed} from "./cms-change-history.mjs"
import {introBannerImage,editorialBanners} from "./banner-display.mjs"
import {diverseDemoImages,diverseEditorialDefaults} from "./demo-image-catalog.mjs";
const diverseImageUrls=new Set([...diverseDemoImages,...diverseEditorialDefaults].map(i=>i.url));
import {presentationConfig,copyDefaults,presentationMedia} from "./cms-presentation.mjs"
import { homeConfig, publicNavigation, shortcutMediaUrls, shortcutIcons, publicDestinations } from "./cms-home-config.mjs"
import { receivingBank, bankInstructions } from "./payment-account.mjs"
import { randomUUID } from "node:crypto"
import { cmsDefaults } from "./cms-defaults.mjs"
import { audit } from "./database.mjs"

const fail = (status, message) => {
  throw Object.assign(Error(message), { status })
}
const clone = (value) => JSON.parse(JSON.stringify(value))
const string = (value, max = 4000) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)
  )
    fail(400, "ข้อความไม่ถูกต้องหรือยาวเกินกำหนด")
  return value
}
const list = (value, max) => {
  if (!Array.isArray(value) || value.length > max)
    fail(400, "จำนวนรายการเกินกำหนด")
  return value
}
const unique = (rows, key) => {
  if (new Set(rows.map((x) => x[key])).size !== rows.length)
    fail(400, "รหัสรายการซ้ำ")
  return rows
}
const slug = (value) => {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(string(value, 80)))
    fail(400, "รหัสต้องเป็นภาษาอังกฤษ ตัวเลข หรือขีดกลาง")
  return value
}
export function cmsUrl(value, image = false) {
  string(value, 2000)
  if (!value) return value
  if (image && (["/villa-placeholder.svg","/illustrations/qr-evidence.svg","/illustrations/platform-updates.svg","/illustrations/merchant-trust.svg"].includes(value)||/^\/demo\/villas\/villa-[1-9]\.jpg$/.test(value)||diverseImageUrls.has(value))) return value
  if (!image && value === "#how") return value
  if (image && /^\/api\/public\/cms-media\/[a-f0-9-]+$/.test(value))
    return value
  if (!image && /^#page=[a-z0-9-]+(?:&item=[^\s]*)?$/.test(value)) return value
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) throw Error()
    return value
  } catch {
    fail(400, "ลิงก์ต้องเป็น HTTPS หรือเลือกหน้าภายในระบบ")
  }
}
function blocks(value, limit = 40) {
  return unique(
    list(value, limit).map((b) => {
      if (
        !b ||
        !["text", "image", "cta"].includes(b.type) ||
        typeof b.visible !== "boolean"
      )
        fail(400, "ชนิด Section ไม่ถูกต้อง")
      return {
        id: slug(b.id),
        type: b.type,
        visible: b.visible,
        title: string(b.title, 300),
        body: string(b.body, 30000),
        image: cmsUrl(b.image, true),
        alt: string(b.alt, 300),
        label: string(b.label, 100),
        href: cmsUrl(b.href),
      }
    }),
    "id",
  )
}
export function validateCms(data) {
  try {
    return normalizeCms(data)
  } catch (error) {
    if (error.status) throw error
    fail(400, "รูปแบบข้อมูล CMS ไม่ถูกต้อง")
  }
}
function discoveryConfig(home, pages) {
  const d=homeConfig(home).discovery;
  for(const k of ["visible","searchVisible","showProvinceHint","showFreeHint"]) if(typeof d[k]!=="boolean") fail(400,"สถานะเมนูลัดไม่ถูกต้อง");
  const result={};
  for(const k of ["visible","searchVisible","showProvinceHint","showFreeHint"])result[k]=d[k];
  for(const k of ["heading","placeholder","buttonLabel","provinceHint","freeHint"])result[k]=string(d[k],300);
  if(!result.placeholder.trim()||!result.buttonLabel.trim())fail(400,"กรุณาระบุข้อความช่องค้นหาและปุ่มค้นหา");
  for(const k of ["background","iconColor","accentColor"]){result[k]=string(d[k],7);if(!/^#[a-fA-F0-9]{6}$/.test(result[k]))fail(400,"สีต้องเป็นรหัส #RRGGBB");}
  result.shortcuts=unique(list(d.shortcuts,12).map(item=>{
    if(typeof item.visible!=="boolean"||!shortcutIcons.some(x=>x.id===item.icon)||!item.label?.trim())fail(400,"ชื่อ ไอคอน หรือสถานะเมนูลัดไม่ถูกต้อง");
    const href=cmsUrl(item.href);
    if(!href || href.startsWith("#")&&!publicDestinations.some(x=>x.href===href)&&!pages.some(p=>href===`#page=cms-page&item=${p.slug}`))fail(400,"กรุณาเลือกหน้าปลายทางสาธารณะสำหรับเมนูลัด");
    return {id:slug(item.id),icon:item.icon,label:string(item.label,80),description:string(item.description,300),href,visible:item.visible,image:cmsUrl(item.image,true)};
  }),"id");
  return result;
}
function normalizePresentation(value) {
  if(value !== undefined && (!value || typeof value !== "object" || Array.isArray(value)))fail(400,"รูปแบบเนื้อหาทั่วเว็บไซต์ไม่ถูกต้อง");
  if(value && Object.hasOwn(value,"copy") && (!value.copy || typeof value.copy !== "object" || Array.isArray(value.copy)))fail(400,"รูปแบบข้อความหน้าเว็บไม่ถูกต้อง");
  const p=presentationConfig(value);
  if(value?.copy && (typeof value.copy !== "object" || Array.isArray(value.copy) || Object.keys(value.copy).some(k=>!Object.hasOwn(copyDefaults,k))))fail(400,"ข้อความหน้าเว็บมีรหัสที่ไม่รองรับ");
  const copy=Object.fromEntries(Object.entries(p.copy).map(([k,v])=>[k,string(v,4000)]));
  if(!['advertisers-first','editorial-first','mixed'].includes(p.bannerSource)||typeof p.footerVisible!=="boolean"||typeof p.footerAdsVisible!=="boolean")fail(400,"การตั้งค่าหน้าเว็บไม่ถูกต้อง");
  for(const key of ['showcaseLimit','newsLimit','footerAdLimit'])if(!Number.isInteger(p[key])||p[key]<1||p[key]>12)fail(400,"จำนวนการ์ดต้องอยู่ระหว่าง 1–12");
  const services=unique(list(p.services,12).map(item=>{
    if(typeof item.visible!=="boolean"||!['search','shield','qr','home','pin','users','chart','camera','info'].includes(item.icon))fail(400,"ข้อมูลการ์ดบริการไม่ถูกต้อง");
    return {id:slug(item.id),visible:item.visible,number:string(item.number,10),icon:item.icon,title:string(item.title,300),description:string(item.description,4000),label:string(item.label,100),href:cmsUrl(item.href),image:cmsUrl(item.image,true),imageEn:cmsUrl(item.imageEn??"",true)};
  }),"id");
  const footerColumns=unique(list(p.footerColumns,5).map(column=>{
    if(typeof column.visible!=="boolean")fail(400,"สถานะ Footer ไม่ถูกต้อง");
    return {id:slug(column.id),title:string(column.title,300),visible:column.visible,links:unique(list(column.links,60).map(link=>{if(typeof link.visible!=="boolean")fail(400,"สถานะลิงก์ไม่ถูกต้อง");return {id:slug(link.id),label:string(link.label,100),href:cmsUrl(link.href),visible:link.visible}}),"id")};
  }),"id");
  const provinces=list(p.provinces,77).map(v=>string(v,100).trim());if(provinces.some(v=>!v)||new Set(provinces).size!==provinces.length)fail(400,"จังหวัดต้องไม่ว่างหรือซ้ำกัน");
  return {copy,services,footerColumns,provinces,cta:{qr:cmsUrl(p.cta.qr),merchant:cmsUrl(p.cta.merchant)},footerAdsVisible:p.footerAdsVisible,bannerSource:p.bannerSource,showcaseLimit:p.showcaseLimit,newsLimit:p.newsLimit,footerAdLimit:p.footerAdLimit,footerVisible:p.footerVisible};
}
function normalizeCms(data) {
  if (!data || data.schemaVersion !== 1 || !data.site || !data.home)
    fail(400, "ข้อมูล CMS ไม่ครบ")
  const business = {...cmsDefaults.business,...data.business}
  if (!business || ![business.monthlyInitialMonths,business.monthlyRenewalMonths].every(n=>Number.isInteger(n)&&n>=1&&n<=36)) fail(400,"อายุสิทธิ์รายเดือนต้องเป็นจำนวนเต็ม 1–36 เดือน")
  const subject=string(business.paymentEmailSubject,300),intro=string(business.paymentEmailIntro,12000)
  if (!subject.trim() || /[\r\n]/.test(subject) || [subject,intro].some(value=>(value.match(/\{\{[^}]+\}\}/g)||[]).some(token=>!["{{merchant}}","{{package}}","{{villa}}"].includes(token)))) fail(400,"หัวข้ออีเมลหรือคำแทนข้อความไม่ถูกต้อง")
  const businessSettings={monthlyInitialMonths:business.monthlyInitialMonths,monthlyRenewalMonths:business.monthlyRenewalMonths,paymentEmailSubject:subject,paymentEmailIntro:intro}
  for (const key of ["emailOtpBody","smsOtpBody"]){
    const value=string(business[key],key==="smsOtpBody"?300:4000)
    if (!value.includes("{{code}}")||!value.includes("{{minutes}}")||(value.match(/\{\{[^}]+\}\}/g)||[]).some(token=>!["{{code}}","{{minutes}}"].includes(token))) fail(400,"ข้อความ OTP ต้องมี {{code}} และ {{minutes}} และใช้คำแทนที่รองรับเท่านั้น")
    businessSettings[key]=value
  }
  businessSettings.emailOtpSubject=string(business.emailOtpSubject,150)
  businessSettings.emailOtpTemplateId=string(business.emailOtpTemplateId,200)
  if (!businessSettings.emailOtpSubject.trim() || /[\r\n]/.test(businessSettings.emailOtpSubject) || (businessSettings.emailOtpTemplateId&&!/^[a-zA-Z0-9_-]+$/.test(businessSettings.emailOtpTemplateId)) || typeof business.facebookLoginEnabled!=="boolean") fail(400,"ตั้งค่า OTP/Facebook ไม่ถูกต้อง")
  businessSettings.facebookLoginEnabled=business.facebookLoginEnabled
  const site = Object.fromEntries(
    [
      "name",
      "description",
      "email",
      "phone",
      "hours",
      "paymentInstructions",
    ].map((k) => [
      k,
      string(data.site[k], k === "paymentInstructions" ? 4000 : 500),
    ]),
  )
  if (!site.name.trim()) fail(400, "กรุณาระบุชื่อเว็บไซต์")
  if (site.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email))
    fail(400, "อีเมลไม่ถูกต้อง")
  if (site.phone && !/^[+0-9 ()-]{6,30}$/.test(site.phone))
    fail(400, "เบอร์โทรไม่ถูกต้อง")
  for (const k of ["facebook", "instagram", "line"])
    site[k] = cmsUrl(data.site[k])
  site.logo = cmsUrl(data.site.logo, true)
  site.paymentQrImage = cmsUrl(data.site.paymentQrImage || "", true)
  site.accent = string(data.site.accent, 7)
  if (!/^#[a-fA-F0-9]{6}$/.test(site.accent))
    fail(400, "สีหลักต้องเป็นรหัสสี #RRGGBB")
  const navigation = publicNavigation(unique(
    list(data.navigation, 12).map((n) => {
      if (typeof n.visible !== "boolean" || !n.label?.trim() || !n.href)
        fail(400, "เมนูต้องมีชื่อและลิงก์")
      return {
        id: slug(n.id),
        label: string(n.label, 80),
        href: cmsUrl(n.href),
        visible: n.visible,
      }
    }),
    "id",
  ))
  if(navigation.length>12)fail(400,"เพิ่มเมนูได้สูงสุด 12 รายการ รวมเมนูติดต่อเรา")
  const sections = unique(
    list(homeConfig(data.home).sections, 10).map((s) => {
      if (
        !cmsDefaults.home.sections.some((x) => x.id === s.id) ||
        typeof s.visible !== "boolean"
      )
        fail(400, "Section หน้าแรกไม่ถูกต้อง")
      return {
        id: s.id,
        visible: s.visible,
        title: string(s.title, 300),
        description: string(s.description),
        ...(s.image===undefined?{}:{image:cmsUrl(s.image,true)}),
      }
    }),
    "id",
  )
  if (sections.length !== 10) fail(400, "Section หน้าแรกไม่ครบ ใช้การซ่อนแทนการลบ")
  const home = {
    introVisible:data.home.introVisible??true,
    en:validateBannerEnglish(data.home.en,cmsUrl,string),
    introImage:cmsUrl(data.home.introImage||introBannerImage,true),
    introMobileImage:cmsUrl(data.home.introMobileImage??"",true),
    discovery: discoveryConfig(data.home,data.pages),
    buttonLabel:string(data.home.buttonLabel??"ค้นหาที่พัก",100),
    buttonHref:cmsUrl(data.home.buttonHref??"#page=directory"),
    banners: unique(list(data.home.banners || [], 40).map(b => {
      if (typeof b.visible !== "boolean" || typeof b.sponsored !== "boolean") fail(400,"สถานะแบนเนอร์ไม่ถูกต้อง")
      if(b.sponsored) fail(400,"กรุณาจัดการโฆษณาที่พักในระบบโฆษณาเพื่อให้ตรวจสิทธิ์แพ็กเกจ")
      const startsAt=string(b.startsAt,40),endsAt=string(b.endsAt,40)
      if ([startsAt,endsAt].some(d=>d&&!Number.isFinite(Date.parse(d))) || (startsAt&&endsAt&&Date.parse(endsAt)<=Date.parse(startsAt))) fail(400,"ช่วงเวลาแบนเนอร์ไม่ถูกต้อง")
      const image=cmsUrl(b.image,true)
      if(!image) fail(400,"แบนเนอร์ต้องมีรูป")
      return {en:validateBannerEnglish(b.en,cmsUrl,string),id:slug(b.id),image,mobileImage:cmsUrl(b.mobileImage,true),title:string(b.title,300),description:string(b.description,4000),label:string(b.label,100),href:cmsUrl(b.href),visible:b.visible,sponsored:b.sponsored,startsAt,endsAt}
    }),"id"),
    slideIntervalMs: data.home.slideIntervalMs ?? CAROUSEL_DEFAULT_MS,
    eyebrow: string(data.home.eyebrow, 300),
    title: string(data.home.title, 300),
    description: string(data.home.description),
    images: list(data.home.images, 12).map((x) => cmsUrl(x, true)),
    blocks: blocks(data.home.blocks),
    sections,
  }
  if (!Number.isInteger(home.slideIntervalMs) || home.slideIntervalMs < CAROUSEL_MIN_MS || home.slideIntervalMs > CAROUSEL_MAX_MS) fail(400,"ช่วงเวลาเลื่อนต้องอยู่ระหว่าง 2–60 วินาที")
  if(typeof home.introVisible!=="boolean")fail(400,"สถานะแบนเนอร์หลักไม่ถูกต้อง")
  if(home.banners.length)home.banners=editorialBanners(home)
  if (!home.images.length || home.images.some((x) => !x))
    fail(400, "หน้าแรกต้องมีรูปอย่างน้อยหนึ่งรูป")
  const pages = unique(
    list(data.pages, 50).map((p) => ({
      slug: slug(p.slug),
      kicker: string(p.kicker, 300),
      title: string(p.title, 300),
      description: string(p.description),
      body: string(p.body, 30000),
      blocks: blocks(p.blocks),
    })),
    "slug",
  )
  for (const required of cmsDefaults.pages)
    if (!pages.some((p) => p.slug === required.slug && p.title.trim()))
      fail(400, "ห้ามลบหน้าพื้นฐาน กรุณากรอกหัวข้อทุกหน้า")
  const articles = unique(
    list(data.articles, 100).map((a) => {
      if (typeof a.visible !== "boolean" || !a.title?.trim())
        fail(400, "บทความต้องมีชื่อและสถานะ")
      return {
        id: slug(a.id),
        title: string(a.title, 300),
        description: string(a.description),
        body: string(a.body, 30000),
        image: cmsUrl(a.image, true),
        detailImage:cmsUrl(a.detailImage||"",true),
        alt:string(a.alt||"",300),detailAlt:string(a.detailAlt||"",300),
        en:a.en?{title:string(a.en.title||"",300),description:string(a.en.description||""),body:string(a.en.body||"",30000),alt:string(a.en.alt||"",300),detailAlt:string(a.en.detailAlt||"",300),image:cmsUrl(a.en.image||"",true),detailImage:cmsUrl(a.en.detailImage||"",true),...(a.en.blocks===undefined?{}:{blocks:blocks(a.en.blocks,42)})}:undefined,
        blocks: blocks(a.blocks || [],42),
        visible: a.visible,
      }
    }),
    "id",
  )
  const faqs = unique(
    list(data.faqs, 100).map((f) => {
      if (typeof f.visible !== "boolean" || !f.question?.trim())
        fail(400, "FAQ ต้องมีคำถามและสถานะ")
      return {
        id: slug(f.id),
        question: string(f.question, 500),
        answer: string(f.answer, 10000),
        visible: f.visible,
      }
    }),
    "id",
  )
  const result = {
    schemaVersion: 1,
    presentation:normalizePresentation(data.presentation),
    site,
    home,
    pages,
    articles,
    faqs,
    navigation,
    business:businessSettings,
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 500000)
    fail(400, "เนื้อหารวมต้องไม่เกิน 500 KB")
  return result
}
async function read(db, key, fallback) {
  const row = await db
    .prepare("SELECT value FROM system_settings WHERE key=?")
    .get(key)
  const value=row?JSON.parse(row.value):clone(fallback)
  if (["cms_draft","cms_published"].includes(key)) { value.content.presentation=presentationConfig(value.content.presentation,value.content.pages); value.content.home=homeConfig(value.content.home); value.content.navigation=publicNavigation(value.content.navigation); value.content.business={...cmsDefaults.business,...value.content.business}; value.content.site={...cmsDefaults.site,...value.content.site}; }
  if(!stagingDemosEnabled()&&["cms_draft","cms_published"].includes(key)&&value.content){const project=item=>typeof item==="string"&&item.startsWith("/demo/")?"/villa-placeholder.svg":Array.isArray(item)?item.map(project):item&&typeof item==="object"?Object.fromEntries(Object.entries(item).map(([name,entry])=>[name,project(entry)])):item;value.content=project(value.content)}
  return value
}
async function write(db, key, value) {
  await db
    .prepare(
      "INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run(key, JSON.stringify(value))
}
const empty = {
  revision: 0,
  content: cmsDefaults,
  updatedAt: null,
  updatedBy: null,
}
// Full snapshots remain in storage for rollback; return only history metadata
// to keep the Admin response below serverless response-size limits.
const historyInfo = rows => rows.map(({revision,updatedAt,updatedBy})=>({revision,updatedAt,updatedBy}))
export async function publishedCms(db) {
  const release=await read(db, "cms_published", empty);const timing=await readCarouselTiming(db,release.content.home.slideIntervalMs);release.content.home.slideIntervalMs=timing.intervalMs;release.carouselTimingVersion=timing.version;
  const project=value=>typeof value==="string"&&value.startsWith("/demo/")?"/villa-placeholder.svg":Array.isArray(value)?value.map(project):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,project(item)])):value;
  return stagingDemosEnabled()?release:{...release,content:project(release.content)}
}
function mediaReferences(content) {
  return [
    content.home.introImage||"",
    content.home.introMobileImage||"",
    ...bannerMedia({en:content.home.en}),
    content.site.logo,
    content.site.paymentQrImage || "",
    ...content.home.images,
    ...content.home.sections.map(s=>s.image||""),
    ...shortcutMediaUrls(content),
    ...presentationMedia(content),
    ...(content.home.banners || []).flatMap(b=>bannerMedia(b)),
    ...content.home.blocks.map((x) => x.image),
    ...content.pages.flatMap((p) => p.blocks.map((x) => x.image)),
    ...content.articles.flatMap(x=>[x.image,x.detailImage,x.en?.image,x.en?.detailImage,...(x.blocks||[]).map(b=>b.image),...(x.en?.blocks||[]).map(b=>b.image)]),
  ].filter((x) => typeof x==="string"&&x.startsWith("/api/public/cms-media/"))
}
export async function cmsPaymentInstructions(db, fallback = "") {
  const bank=await receivingBank(db);if(bank)return bankInstructions(bank)
  return (await publishedCms(db)).content.site.paymentInstructions || fallback
}
export async function adminCms(db, user, req, path, readBody, config={}) {
  if (!path.startsWith("/api/admin/cms")) return undefined
  if (user.role !== "admin") fail(403, "เฉพาะ Admin")
  if(path==="/api/admin/cms/carousel"&&req.method==="GET")return readCarouselTiming(db,(await publishedCms(db)).content.home.slideIntervalMs);
  if(path==="/api/admin/cms/carousel"&&req.method==="POST")return saveCarouselTiming(db,user,await readBody(req));
  if (path === "/api/admin/cms/history" && req.method === "GET") return cmsChanges(db,new URL(req.url,"http://localhost").searchParams.get("cursor")||"")
  if (path === "/api/admin/cms" && req.method === "GET") {
    const published = await publishedCms(db)
    return {
      draft: await read(db, "cms_draft", published),
      published,
      history: historyInfo(await read(db, "cms_history", [])),
    }
  }
  if (path === "/api/admin/cms/media" && req.method === "GET") {
    const media=(await db.prepare("SELECT id,name,mime FROM documents WHERE name LIKE 'cms-image:%' ORDER BY id").all()).map(m=>({...m,url:`/api/public/cms-media/${m.id}`,source:"upload"}));
    const seen=new Set(media.map(m=>m.url));
    const add=(url,name)=>{if(config.appEnvironment==='production'&&typeof url==='string'&&url.startsWith('/demo/'))return;if(typeof url!=="string"||!(url.startsWith("https://")||/^\/demo\/villas\/villa-[1-9]\.jpg$/.test(url)||diverseImageUrls.has(url))||seen.has(url))return;seen.add(url);media.push({id:`banner-${media.length}`,name,mime:"image/remote",url,source:"banner"});};
    
    const releases=[await read(db,"cms_published",empty),await read(db,"cms_draft",empty),...await read(db,"cms_history",[])];
    for(const release of releases){const home=release.content?.home;if(!home)continue;add(home.introImage,"Intro banner");add(home.introMobileImage,"Intro banner · Mobile");for(const image of bannerMedia({en:home.en}))add(image,"Intro banner English");for(const [i,image] of (home.images||[]).entries())add(image,`Carousel ${i+1}`);for(const banner of home.banners||[]){for(const image of bannerMedia({en:banner.en}))add(image,"Banner English");add(banner.image,banner.title||"Banner");add(banner.mobileImage,(banner.title||"Banner")+" · มือถือ");}}
    const ads=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'advertisement:%'").all();
    for(const row of ads){const ad=JSON.parse(row.value);for(const image of bannerMedia({en:ad.en}))add(image,"Advertisement English");add(ad.image,`${ad.title||"โฆษณา"} · ${ad.placement}`);add(ad.mobileImage,`${ad.title||"โฆษณา"} · มือถือ`);}
    return {media};
  }

  if (path === "/api/admin/cms/media" && req.method === "POST") {
    return uploadCmsMedia(db, user, await readBody(req))
  }

  if (path === "/api/admin/cms/media/delete" && req.method === "POST") {
    const data = await readBody(req)
    if (!/^[a-f0-9-]{36}$/.test(data.id)) fail(400, "รหัสรูปไม่ถูกต้อง")
    return db.transaction(async () => {
    await assertWriteSession(db,user);
      const published = await publishedCms(db),
        draft = await read(db, "cms_draft", published),
        history = await read(db, "cms_history", [])
      const url = `/api/public/cms-media/${data.id}`
      if(await archivedCmsMediaUsed(db,url))fail(409,"รูปนี้อยู่ในประวัติการเปลี่ยนแปลง จึงยังลบไม่ได้")
      const ads=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'advertisement:%'").all()
      if(ads.some(row=>{const ad=JSON.parse(row.value);return bannerMedia(ad).includes(url)}))fail(409,"รูปนี้อ้างอิงในแบนเนอร์โฆษณา จึงยังลบไม่ได้")
      if (await db.prepare("SELECT key FROM system_settings WHERE key LIKE 'invoice_bank_qr:%' AND value=?").get(JSON.stringify(url)))
        fail(409, "QR นี้อ้างอิงในใบแจ้งชำระ จึงยังลบไม่ได้")
      if (
        [published, draft, ...history].some((v) =>
          mediaReferences(v.content).includes(url),
        )
      )
        fail(409, "รูปนี้อยู่ในร่าง เว็บจริง หรือประวัติเวอร์ชัน จึงยังลบไม่ได้")
      const removedMedia=await db.prepare("SELECT id,name,mime FROM documents WHERE id=? AND name LIKE 'cms-image:%'").get(data.id)
      const result = await db
        .prepare("DELETE FROM documents WHERE id=? AND name LIKE 'cms-image:%'")
        .run(data.id)
      if (!result.changes) fail(404, "ไม่พบรูปภาพ")
      await initializeCmsChanges(db)
      await recordCmsChange(db,{kind:"media",action:"delete",snapshot:removedMedia,user})
      await audit(db, user, "CMS_MEDIA_DELETE", data.id)
      return { ok: true }
    })
  }
  if (
    req.method !== "POST" ||
    ![
      "/api/admin/cms/save",
      "/api/admin/cms/publish",
      "/api/admin/cms/restore",
    ].includes(path)
  )
    return undefined
  const data = await readBody(req)
  return db.transaction(async () => {
    await assertWriteSession(db,user);
    const published = await publishedCms(db),
      current = await read(db, "cms_draft", published),
      history = await read(db, "cms_history", [])
    if (data.revision !== current.revision)
      fail(409, "มีผู้แก้ไขเนื้อหาก่อนหน้า กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก")
    await initializeCmsChanges(db)
    if (path.endsWith("/publish")) {
      await assertCmsCoreUnchanged(db,user,config,published.content,current.content);
      if (!current.revision) fail(400, "กรุณาบันทึกร่างก่อนเผยแพร่")
      // Keep the preceding version, including the original site, available for rollback.
      if (!history.some((x) => x.revision === published.revision))
        history.unshift(published)
      const release = {
        ...current,
        content: validateCms(current.content),
        updatedAt: new Date().toISOString(),
        updatedBy: user.name,
      }
      await recordCmsPublication(db,release,user,mediaReferences(release.content));
      await write(db, "cms_published", release)
      await recordCmsChange(db,{kind:"cms",action:"publish",snapshot:release,user})
      if (!history.some((x) => x.revision === release.revision))
        history.unshift(release)
      await write(db, "cms_history", history.slice(0, 30))
      await audit(db, user, "CMS_PUBLISH", String(release.revision))
      return {
        draft: current,
        published: release,
        history: historyInfo(history.slice(0, 30)),
      }
    }
    const restored = data.historyId ? await cmsChangeById(db,data.historyId) : null
    const source = path.endsWith("/restore")
      ? data.historyId ? restored?.kind==="cms" ? restored.snapshot.content : null : history.find((x) => x.revision === data.version)?.content
      : data.content
    if (!source) fail(404, "ไม่พบเวอร์ชัน")
    await assertCmsCoreUnchanged(db,user,config,current.content,validateCms(source));
    const draft = {
      revision: current.revision + 1,
      content: validateCms(source),
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    }
    for (const url of new Set(mediaReferences(draft.content))) {
      if (
        !(await db
          .prepare(
            "SELECT id FROM documents WHERE id=? AND name LIKE 'cms-image:%'",
          )
          .get(url.split("/").at(-1)))
      )
        fail(400, "ไม่พบรูปที่เลือกในคลัง กรุณาเลือกรูปใหม่")
    }
    await write(db, "cms_draft", draft)
    await recordCmsChange(db,{kind:"cms",action:path.endsWith("/restore")?"restore":"save",snapshot:draft,user})
    await audit(
      db,
      user,
      path.endsWith("/restore") ? "CMS_RESTORE_DRAFT" : "CMS_SAVE_DRAFT",
      String(draft.revision),
    )
    return { draft, published, history:historyInfo(history) }
  })
}
