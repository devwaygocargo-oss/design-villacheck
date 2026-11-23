import {publicPackageVideoAllowed} from './phase2-latest-decisions.mjs';
import {assertPhase2VillaEditing,isPublicQrActive} from './phase2-access.mjs';
import {villaPackageRights} from './phase2-entitlement-bridge.mjs';
import {villaFreeTrial} from './villa-free-trial.mjs';
import {retainedMediaParent} from "./retained-media-parent.mjs";
import {publicCover} from './cover-review.mjs';
import {preparedPropertyFile,attachPropertyFile,validatePropertyBytes} from './property-upload.mjs';
import {youtubeVideoId} from './youtube.mjs';
import {publishedDemoIllustration} from './staging-demo-gallery.mjs';
import {assertWriteSession} from "./write-session.mjs";
import {isDemoVilla} from "./demo-villa-visibility.mjs";
import {merchantFreePeriod} from './merchant-free-period.mjs'
import {villaMediaLimits,assertVillaMediaLimit,countVillaMedia,assertVillaCoverLimit} from './villa-media-limits.mjs'
import {recordVillaReview} from "./villa-review.mjs"
import {trustDto} from "./catalog.mjs"
import {resolvePublicQr,publicRevision} from "./public-revision.mjs"
import {preserveApprovedVilla,rotateApprovedRevision} from "./approval-history.mjs"
import { randomUUID, createHash } from "node:crypto"
import { mediaDate } from "./media-date.mjs"
import { audit } from "./database.mjs"
import { getPlan } from "./catalog.mjs"
const fail = (status, message) => {
  throw Object.assign(Error(message), { status })
}
const list = async (db, id) =>
  (
    await db
      .prepare("SELECT value FROM system_settings WHERE key LIKE ?")
      .all("property_media:" + id + ":%")
  ).map((r) => JSON.parse(r.value)).filter(m=>!m.removedAt).sort((a,b)=>(a.position??Number.MAX_SAFE_INTEGER)-(b.position??Number.MAX_SAFE_INTEGER)||String(a.uploadedAt||" ").localeCompare(String(b.uploadedAt||" "))||a.id.localeCompare(b.id))
export async function propertyMediaApi(db, user, req, path, url, body, trustOptions) {
  if (
    ![
      "/api/public/property-media",
      "/api/merchant/property-media",
      "/api/admin/property-media",
    ].includes(path)
  )
    return undefined
  let villa
  if (path.startsWith("/api/public/")){
    villa=await resolvePublicQr(db,url.searchParams.get("qr")||"",trustOptions)
    if(villa?.status!=="approved"||!isPublicQrActive(await trustDto(db,villa,undefined,trustOptions)))villa=null
  } else {
    if (!user) fail(401, "กรุณาเข้าสู่ระบบ")
    if (user.role !== (path.includes("/admin/") ? "admin" : "merchant"))
      fail(403, "ไม่มีสิทธิ์")
    if (req.method === "GET")
      villa = await db
        .prepare("SELECT * FROM villas WHERE id=?")
        .get(url.searchParams.get("villaId") || "")
  }
  if (req.method === "GET") {
    if (!villa) fail(404, "ไม่พบที่พัก")
    if (user?.role === "merchant" && villa.owner_id !== user.id)
      fail(404, "ไม่พบที่พัก")
    const storedMedia = path.startsWith("/api/public/")&&villa._approvedSnapshot?structuredClone(villa._approvedSnapshot.media):await list(db,villa.id)
    if(!path.startsWith("/api/public/")&&!villa.photo_reviewed_at)for(const item of storedMedia)if(item.url===villa.photo_url)item.reviewedAt=null;
    const videoAllowed=path.startsWith('/api/public/')?await publicPackageVideoAllowed(db,villa,trustOptions?.phase2Config):true;
    const media = path.startsWith("/api/public/") ? storedMedia.filter(m=>(m.reviewedAt||publishedDemoIllustration(villa,m,trustOptions))&&(m.kind!=='video'||videoAllowed)).map(({reviewedBy,...safe})=>safe) : storedMedia
    if (villa.photo_url && (!path.startsWith("/api/public/")||publicCover(villa)) && !media.some((m) => m.url === villa.photo_url))
      media.unshift({
        id: "cover",
        kind: "image",
        url: villa.photo_url,
        name: villa.name,
        uploadedAt: villa.photo_uploaded_at,
        takenAt: villa.photo_taken_at,
        reviewedAt: villa.photo_reviewed_at,
      })
    return {
      media,
      demoImage:trustOptions?.demoImages===true&&isDemoVilla(villa),
      ...(!path.startsWith('/api/public/')&&trustOptions?.phase2Config?.phase2Enabled?{packageRights:await villaPackageRights(db,villa,trustOptions.phase2Config)}:{}),
      coverUrl:villa.photo_url,limits:villaMediaLimits,counts:countVillaMedia(villa,videoAllowed?storedMedia:storedMedia.filter(m=>m.kind!=='video')),
      latestUpdatedAt:
        media
          .map((m) => m.uploadedAt)
          .filter(Boolean)
          .sort()
          .at(-1) || null,
    }
  }
  if (req.method !== "POST" || !user) fail(405, "ไม่รองรับคำสั่งนี้")
  const data=await body(req)
  return db.transaction(async () => {
    await assertWriteSession(db,user);
    villa = await db
      .prepare("SELECT * FROM villas WHERE id=?")
      .get(data.villaId)
    if (!villa || (user.role === "merchant" && villa.owner_id !== user.id))
      fail(404, "ไม่พบที่พัก")
    await assertPhase2VillaEditing(db,user,villa,trustOptions?.phase2Config);
    if(user.role==='merchant'&&data.action==='reorder'){
      const current=await list(db,villa.id),images=current.filter(m=>m.kind==='image'&&m.url!==villa.photo_url),ids=data.mediaIds;
      if(!Array.isArray(ids)||ids.length!==images.length||new Set(ids).size!==ids.length||ids.some(id=>!images.some(m=>m.id===id)))fail(400,'ลำดับรูปภาพไม่ถูกต้อง กรุณาโหลดข้อมูลล่าสุด');
      await preserveApprovedVilla(db,villa);
      for(let i=0;i<ids.length;i++){const image=images.find(m=>m.id===ids[i]);await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...image,position:i}),'property_media:'+villa.id+':'+image.id)}
      await recordVillaReview(db,villa,{...villa,_mediaOrderBefore:images.map(m=>m.id),_mediaOrderAfter:ids},'media_reorder',user);
      await db.prepare("UPDATE villas SET status='pending' WHERE id=?").run(villa.id);await audit(db,user,'media.order_changed',villa.id);return {ok:true,approvalRequired:true};
    }
    if(user.role==='merchant'&&data.action==='set-cover'){
      await assertVillaCoverLimit(db,villa,(await list(db,villa.id)).find(m=>m.id===data.mediaId&&m.kind==='image')?.url||'');
      const media=(await list(db,villa.id)).find(m=>m.id===data.mediaId&&m.kind==='image');if(!media)fail(404,'ไม่พบรูปภาพ');
      await preserveApprovedVilla(db,villa);await recordVillaReview(db,villa,{...villa,photo_url:media.url},'cover_change',user);
      await db.prepare("UPDATE villas SET photo_url=?,photo_uploaded_at=?,photo_taken_at=?,photo_reviewed_at=NULL,status='pending' WHERE id=?").run(media.url,media.uploadedAt,media.takenAt,villa.id);await audit(db,user,'media.cover_changed',villa.id);return {ok:true};
    }
    if(user.role==='merchant'&&data.action==='remove'&&data.mediaId==='cover'){
      await preserveApprovedVilla(db,villa);await recordVillaReview(db,villa,{...villa,photo_url:''},'cover_removal',user);
      for(const image of (await list(db,villa.id)).filter(m=>m.kind==='image'&&m.url===villa.photo_url))await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...image,removedAt:new Date().toISOString(),removedBy:user.id}),'property_media:'+villa.id+':'+image.id);
      await db.prepare("UPDATE villas SET photo_url='',photo_uploaded_at=NULL,photo_taken_at=NULL,photo_reviewed_at=NULL,status='pending' WHERE id=?").run(villa.id);await audit(db,user,'media.cover_removed',villa.id);return {ok:true};
    }
    if(user.role==="merchant"&&data.action==="remove"){
      const key="property_media:"+villa.id+":"+data.mediaId,row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key)
      if(!row)fail(404,"ไม่พบสื่อ")
      const media=JSON.parse(row.value);if(media.removedAt)return {ok:true}
      await recordVillaReview(db,villa,{...villa,_removedMedia:media},"media_removal",user)
      if(villa.photo_url===media.url)await db.prepare("UPDATE villas SET photo_url='',photo_reviewed_at=NULL WHERE id=?").run(villa.id)
      media.removedAt=new Date().toISOString();media.removedBy=user.id
      await db.prepare("UPDATE system_settings SET value=? WHERE key=?").run(JSON.stringify(media),key)
      await db.prepare("UPDATE villas SET status='pending' WHERE id=?").run(villa.id)
      await audit(db,user,"media.remove_requested",media.id)
      return {ok:true,approvalRequired:true}
    }
    if (path.includes("/admin/") && !data.file && !data.youtubeUrl) {
      const key = "property_media:" + villa.id + ":" + data.mediaId
      if(data.mediaId === "cover" && villa.photo_reviewed_at)fail(409,"สื่อนี้ผ่านการอนุมัติแล้ว")
      if (data.mediaId === "cover")
        await db
          .prepare("UPDATE villas SET photo_reviewed_at=? WHERE id=?")
          .run(new Date().toISOString(), villa.id)
      else {
        const row = await db
          .prepare("SELECT value FROM system_settings WHERE key=?")
          .get(key)
        if (!row) fail(404, "ไม่พบสื่อ")
        const m = JSON.parse(row.value)
        if(m.removedAt)fail(404,"ไม่พบสื่อ")
        if(m.reviewedAt&&(m.url!==villa.photo_url||villa.photo_reviewed_at))fail(409,"สื่อนี้ผ่านการอนุมัติแล้ว")
        m.reviewedAt = new Date().toISOString()
        m.reviewedBy = user.id
        if(m.url===villa.photo_url)await db.prepare("UPDATE villas SET photo_reviewed_at=? WHERE id=?").run(m.reviewedAt,villa.id)
        await db
          .prepare("UPDATE system_settings SET value=? WHERE key=?")
          .run(JSON.stringify(m), key)
      }
      const qr=await rotateApprovedRevision(db,villa,user,"MEDIA_APPROVED")
      await audit(db, user, "media.review", villa.id)
      return { ok: true, qr }
    }
    return storePropertyMedia(db,user,villa,data,trustOptions)
  })
}
export async function propertyMediaFile(db, id, user, trustOptions) {
  const rows = await db
    .prepare(
      "SELECT value FROM system_settings WHERE key LIKE 'property_media:%'",
    )
    .all()
  const m = rows.map((r) => JSON.parse(r.value)).find((m) => m.id === id)
  if (!m) fail(404, "ไม่พบสื่อ")
  const v = await db
    .prepare("SELECT * FROM villas WHERE id=?")
    .get(m.villaId) || await retainedMediaParent(db,m.villaId,id,user)
  const published=await publicRevision(db,v,undefined,trustOptions)
  const videoAllowed=m.kind!=='video'||await publicPackageVideoAllowed(db,v,trustOptions?.phase2Config);
  const visible=videoAllowed&&trustOptions?.publicPublicationDisabled!==true&&published?.status==="approved"&&isPublicQrActive(await trustDto(db,published,undefined,trustOptions))&&(published._approvedSnapshot?published._approvedSnapshot.media.some(item=>item.id===id):Boolean(m.reviewedAt&&!m.removedAt))
  if (
    !v ||
    (!visible &&
      user?.role !== "admin" &&
      user?.id !== v.owner_id)
  )
    fail(404, "ไม่พบสื่อ")
  const file = await db
    .prepare(
      "SELECT mime,bytes FROM documents WHERE id=? AND name='property-media'",
    )
    .get(id)
  if (!file) fail(404, "ไม่พบสื่อ")
  return file
}

// Caller owns the enclosing transaction; shared by initial registration and later uploads.
export async function storePropertyMedia(db,user,villa,data,options={}){
    if(data.youtubeUrl!==undefined&&data.file!==undefined)fail(400,'กรุณาเลือกไฟล์หรือใช้ลิงก์ YouTube อย่างใดอย่างหนึ่ง');
    const supplied=data.file,youtubeId=data.youtubeUrl?youtubeVideoId(data.youtubeUrl):null;
    if(data.youtubeUrl&&!youtubeId)fail(400,'กรุณาใช้ลิงก์ YouTube ที่ถูกต้อง');
    let prepared=null,file=supplied,kind=youtubeId||file?.type==='video/mp4'?'video':'image'
    const uploadRequestId=data.uploadRequestId
    if(uploadRequestId!==undefined&&(typeof uploadRequestId!=="string"||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(uploadRequestId)))fail(400,"รหัสคำขออัปโหลดไม่ถูกต้อง")
    const requestKey=uploadRequestId?"property_media_request:"+villa.id+":"+uploadRequestId:null
    const requestFingerprint=requestKey?createHash('sha256').update(JSON.stringify({youtubeName:youtubeId?(typeof data.name==='string'?data.name.slice(0,200):'YouTube video'):null,uploadId:supplied?.uploadId||null,youtubeId:youtubeId||null,actor:user.id,villa:villa.id,action:data.action||"upload",replacing:data.mediaId||null,takenAt:data.takenAt||null,type:file?.type,name:file?.name,content:typeof file?.data==='string'?createHash('sha256').update(file.data).digest('hex'):null})).digest('hex'):null
    if(requestKey){const previous=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(requestKey);if(previous){const stored=JSON.parse(previous.value);if(stored.fingerprint!==requestFingerprint)fail(409,"คำขออัปโหลดนี้ถูกใช้กับไฟล์หรือข้อมูลอื่นแล้ว");return {media:stored.media,replayed:true}}}
    if(supplied?.uploadId){prepared=await preparedPropertyFile(db,user.id,supplied.uploadId);file={name:prepared.name,type:prepared.type};kind=file.type==='video/mp4'?'video':'image';}
    const trial=await villaFreeTrial(db,villa);
    const period=trial||await merchantFreePeriod(db,villa.owner_id)
    const plan = await getPlan(
      db,
      period?"starter":villa.payments === 0 ? "basic" : villa.package_id,
    )
    if(kind==="video"&&trial?.state==='EXPIRED')fail(403,"สิทธิ์ทดลองของที่พักหมดอายุแล้ว");
    if(kind==="video"){const sub=await db.prepare("SELECT lifecycle FROM subscriptions WHERE owner_id=?").get(villa.owner_id);if(["SUSPENDED","CANCELLED"].includes(sub?.lifecycle))fail(403,"สิทธิ์วิดีโอถูกระงับ กรุณาติดต่อผู้ดูแล")}
    if (
      kind === "video" && options.propertyMediaWorkflowEnabled!==true &&
      (!["starter", "pro", "premium"].includes(plan.id) ||
        !(['ACTIVE','PENDING_APPROVAL','PER_VILLA'].includes(period?.state))&&(!villa.expires ||
        Date.parse(villa.expires) <= Date.now()))
    )
      fail(403, "ต้องใช้แพ็กเกจ 1,990 ขึ้นไปที่ยังไม่หมดอายุเพื่ออัปโหลดวิดีโอ")
    let bytes=prepared?.bytes;
    if(!youtubeId&&!prepared){
      if(!file||!['image/jpeg','image/png','video/mp4'].includes(file.type)||typeof file.data!=='string'||!file.data.startsWith('data:'+file.type+';base64,'))fail(400,'รองรับ JPG PNG MP4');
      const encoded=file.data.slice(file.data.indexOf(',')+1),max=file.type==='video/mp4'?25*1024*1024:5*1024*1024;
      if(encoded.length%4!==0||encoded.length>Math.ceil(max/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))fail(400,'ข้อมูลไฟล์ไม่ถูกต้อง');
      bytes=Buffer.from(encoded,'base64');validatePropertyBytes(file.type,bytes);
    }
    const replaced=await assertVillaMediaLimit(db,villa,kind,data.action==='replace'?data.mediaId:undefined)
    await preserveApprovedVilla(db,villa)
    const id = prepared?.id || randomUUID(),
      takenAt = data.takenAt ? mediaDate(data.takenAt) : null
    if(prepared)await attachPropertyFile(db,user.id,prepared,'property-media',villa.id);
    else if(!youtubeId)await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(id,user.id,'property-media',file.type,bytes);
    const media = {
      id,
      villaId: villa.id,
      name:
        youtubeId ? (typeof data.name==='string'?data.name.slice(0,200):'YouTube video') : typeof file.name === "string" ? file.name.slice(0, 200) : villa.name,
      kind,
      url: youtubeId?'https://www.youtube.com/watch?v='+youtubeId:'/api/public/property-media-file/'+id,
      ...(youtubeId?{provider:'youtube',youtubeId}:{}),
      uploadedAt: new Date().toISOString(),
      takenAt,
      reviewedAt: null,
    }
    await db
      .prepare("INSERT INTO system_settings(key,value) VALUES (?,?)")
      .run("property_media:" + villa.id + ":" + id, JSON.stringify(media))
    if(replaced){await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify({...replaced,removedAt:new Date().toISOString(),removedBy:user.id,replacedBy:id}),'property_media:'+villa.id+':'+replaced.id);if(villa.photo_url===replaced.url)await db.prepare('UPDATE villas SET photo_url=?,photo_uploaded_at=?,photo_taken_at=?,photo_reviewed_at=NULL WHERE id=?').run(media.url,media.uploadedAt,media.takenAt,villa.id)}
    if(replaced){await recordVillaReview(db,villa,{...villa,_addedMedia:media},'media_replacement',user);await db.prepare("UPDATE villas SET status='pending' WHERE id=?").run(villa.id)}
    await audit(db, user, "media.upload", id)
    if(requestKey)await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(requestKey,JSON.stringify({fingerprint:requestFingerprint,media,createdAt:new Date().toISOString()}))
    return { media }
}
