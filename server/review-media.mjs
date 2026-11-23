import {paidQrVisibility} from './phase2-paid-qr-visibility.mjs';
import {retainedReviewMerchantAccess} from "./retained-media-parent.mjs";
import {randomUUID,createHash} from 'node:crypto'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {trustDto} from './catalog.mjs'
import {resolvePublicQr} from './public-revision.mjs'
import {mediaRange} from './media-range.mjs'
import {reviewMediaLimits as limits,reviewMediaTypes} from './review-media-limits.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const read=async(db,key)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);return row?JSON.parse(row.value):null}
const save=(db,key,value)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value))
const uploadKey=(user,id)=>`review_upload:${user.id}:${id}`
const fileKey=id=>'review_media:'+id
const partName=id=>'review-media:'+id
const partId=(id,index)=>id+'-'+String(index).padStart(4,'0')
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value)
const dto=f=>({id:f.id,name:f.name,mime:f.mime,kind:f.kind,size:f.size,url:'/api/public/review-media/'+f.id})
async function discard(db,user,id){await db.prepare('DELETE FROM documents WHERE name=? AND owner_id=?').run(partName(id),user.id);await db.prepare('DELETE FROM system_settings WHERE key=?').run(uploadKey(user,id));await db.prepare('DELETE FROM system_settings WHERE key=?').run(fileKey(id))}
export async function reviewMediaTarget(db,qr,config){const villa=await resolvePublicQr(db,qr);if(!(await paidQrVisibility(db,villa,config)).visible)fail(404,'ไม่พบที่พัก');if(!villa||villa.status!=='approved'||(await trustDto(db,villa)).qrStatus!=='ACTIVE')fail(404,'ไม่พบที่พัก');return villa}
async function drafts(db,user){return(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'review_media:%'").all()).map(r=>JSON.parse(r.value)).filter(f=>f.ownerId===user.id&&!f.reviewId)}
export async function reviewMediaUpload(db,user,data,config={}){
 if(user?.role!=='user')fail(403,'เฉพาะสมาชิก User ที่เขียนรีวิวได้')
 return db.transaction(async()=>{
  if(['cancel','remove'].includes(data.action)){
   if(!uuid(data.id))fail(400,'รหัสไฟล์ไม่ถูกต้อง')
   const file=await read(db,fileKey(data.id)),upload=await read(db,uploadKey(user,data.id))
   if(file&&(file.ownerId!==user.id||file.reviewId))fail(403,'ไม่สามารถลบไฟล์นี้ได้')
   if(!file&&!upload)fail(404,'ไม่พบไฟล์')
   await discard(db,user,data.id);return{removed:true}
  }
  if(data.action==='start'){
   if(!reviewMediaTypes.includes(data.mime)||typeof data.name!=='string'||!data.name.trim()||data.name.length>180||/[\x00-\x1f]/.test(data.name))fail(400,'ใช้รูป JPG/PNG หรือวิดีโอ MP4/MOV/WebM')
   const kind=data.mime.startsWith('image/')?'image':'video',max=kind==='image'?limits.imageBytes:limits.videoBytes
   if(!Number.isInteger(data.size)||data.size<12||data.size>max)fail(413,kind==='image'?'รูปต้องไม่เกิน 5 MB':'วิดีโอต้องไม่เกิน 50 MB')
   const villa=await reviewMediaTarget(db,data.qr,config)
   const reviews=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'customer_review:%'").all()
   if(reviews.some(row=>{const r=JSON.parse(row.value);return r.userId===user.id&&r.villaId===villa.id}))fail(409,'คุณส่งรีวิวที่พักนี้แล้ว')
   const uploads=(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all(`review_upload:${user.id}:%`)).map(r=>JSON.parse(r.value))
   const files=await drafts(db,user)
   for(const file of [...uploads,...files])if(file.expiresAt<=Date.now())await discard(db,user,file.id)
   const active=uploads.filter(u=>u.expiresAt>Date.now()),used=[...active,...files.filter(f=>f.expiresAt>Date.now())].filter(f=>f.villaId===villa.id&&f.kind===kind).length
   if(used>=(kind==='image'?limits.images:limits.videos))fail(409,'แนบรูปได้ไม่เกิน 10 รูป และวิดีโอไม่เกิน 2 ไฟล์ต่อรีวิว')
   if(active.length>=2)fail(409,'มีไฟล์กำลังอัปโหลดอยู่ กรุณารอหรือยกเลิกก่อน')
   const upload={id:randomUUID(),ownerId:user.id,villaId:villa.id,qr:data.qr,name:data.name.trim(),mime:data.mime,kind,size:data.size,received:0,hashes:[],expiresAt:Date.now()+3600000}
   await save(db,uploadKey(user,upload.id),upload);return{uploadId:upload.id,chunkBytes:limits.chunkBytes}
  }
  if(!uuid(data.id))fail(400,'รหัสไฟล์ไม่ถูกต้อง')
  const upload=await read(db,uploadKey(user,data.id));if(!upload||upload.expiresAt<=Date.now())fail(404,'การอัปโหลดหมดอายุ กรุณาเลือกไฟล์ใหม่')
  if(data.action==='part'){
   if(!Number.isInteger(data.index)||data.index<0||data.index>upload.hashes.length||typeof data.base64!=='string'||data.base64.length>Math.ceil(limits.chunkBytes/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))fail(400,'ส่วนของไฟล์ไม่ถูกต้อง')
   const bytes=Buffer.from(data.base64,'base64'),hash=createHash('sha256').update(bytes).digest('hex')
   if(bytes.toString('base64')!==data.base64)fail(400,'ส่วนของไฟล์ไม่ถูกต้อง')
   if(data.index<upload.hashes.length){if(upload.hashes[data.index]!==hash)fail(409,'ส่วนของไฟล์ไม่ถูกต้อง');return{received:upload.received}}
   if(!bytes.length||bytes.length!==Math.min(limits.chunkBytes,upload.size-upload.received))fail(400,'ส่วนของไฟล์ไม่ถูกต้อง')
   await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(partId(upload.id,data.index),user.id,partName(upload.id),upload.mime,bytes)
   upload.received+=bytes.length;upload.hashes.push(hash);await save(db,uploadKey(user,upload.id),upload);return{received:upload.received}
  }
  if(data.action!=='finish')fail(400,'คำสั่งไม่ถูกต้อง')
  if(upload.received!==upload.size)fail(409,'ไฟล์ยังอัปโหลดไม่ครบ')
  const villa=await reviewMediaTarget(db,upload.qr,config);if(villa.id!==upload.villaId)fail(409,'ข้อมูลที่พักเปลี่ยนแปลง')
  const first=await db.prepare('SELECT bytes FROM documents WHERE id=? AND owner_id=?').get(partId(upload.id,0),user.id),bytes=Buffer.from(first?.bytes||[])
  const valid=upload.mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):upload.mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:upload.mime==='video/webm'?bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])):upload.mime==='video/mp4'?bytes.toString('ascii',4,8)==='ftyp':['ftyp','moov','mdat','wide'].includes(bytes.toString('ascii',4,8))
  if(!valid)fail(400,'เนื้อหาไฟล์ไม่ตรงกับชนิดรูปหรือวิดีโอ')
  const file={...upload,hashes:undefined,reviewId:null,expiresAt:Date.now()+86400000};await save(db,fileKey(file.id),file);await db.prepare('DELETE FROM system_settings WHERE key=?').run(uploadKey(user,file.id));return{media:dto(file)}
 })
}
export async function attachReviewMedia(db,user,villaId,reviewId,ids=[]){
 if(!Array.isArray(ids)||ids.length>12||new Set(ids).size!==ids.length||ids.some(id=>!uuid(id)))fail(400,'ไฟล์แนบรีวิวไม่ถูกต้อง')
 const files=[]
 for(const id of ids){const file=await read(db,fileKey(id));if(!file||file.ownerId!==user.id||file.villaId!==villaId||file.reviewId||file.expiresAt<=Date.now())fail(400,'ไฟล์แนบรีวิวไม่ถูกต้อง');files.push(file)}
 if(files.filter(f=>f.kind==='image').length>limits.images||files.filter(f=>f.kind==='video').length>limits.videos)fail(400,'แนบรูปได้ไม่เกิน 10 รูป และวิดีโอไม่เกิน 2 ไฟล์ต่อรีวิว')
 for(const file of files)await save(db,fileKey(file.id),{...file,reviewId,expiresAt:null})
 return files.map(dto)
}
export async function sendReviewMedia(db,user,id,req,res,config={}){
 const file=uuid(id)?await read(db,fileKey(id)):null;if(!file)fail(404,'ไม่พบไฟล์')
 const review=file.reviewId?await read(db,'customer_review:'+file.reviewId):null
 const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(file.villaId)
 const attached=review?.villaId===file.villaId&&review?.media?.some(m=>m.id===id)
 const retainedAccess=!villa&&attached&&review.userId===file.ownerId&&await retainedReviewMerchantAccess(db,file,user);
 const privateAccess=user&&(user.role==='admin'||user.id===file.ownerId||(attached&&user.role==='merchant'&&villa?.owner_id===user.id)||retainedAccess)
 const publicAccess=(await paidQrVisibility(db,villa,config)).visible&&!['PHASE1','PHASE1_PUBLIC'].includes(config.productionReleaseMode)&&config.reviewAccessMode==='ENABLED'&&attached&&review.status==='published'&&villa?.status==='approved'&&(await trustDto(db,villa)).qrStatus==='ACTIVE'
 if(!privateAccess&&!publicAccess||!file.reviewId&&file.expiresAt<=Date.now())fail(404,'ไม่พบไฟล์')
 const range=mediaRange(req.headers.range,file.size)
 if(range?.invalid){res.writeHead(416,{'Content-Range':`bytes */${file.size}`,'Cache-Control':'private, no-store'});return res.end()}
 const start=range?.start??0,end=range?.end??file.size-1
 const headers={'Content-Type':file.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`,...(range?{'Content-Range':`bytes ${start}-${end}/${file.size}`}:{})}
 res.writeHead(range?206:200,headers);if(req.method==='HEAD')return res.end();res.flushHeaders()
 async function* chunks(){for(let i=Math.floor(start/limits.chunkBytes);i<=Math.floor(end/limits.chunkBytes);i++){const row=await db.prepare('SELECT bytes FROM documents WHERE id=? AND owner_id=?').get(partId(id,i),file.ownerId);if(!row)throw Error('Missing review media part');const bytes=Buffer.from(row.bytes);yield bytes.subarray(i===Math.floor(start/limits.chunkBytes)?start%limits.chunkBytes:0,i===Math.floor(end/limits.chunkBytes)?end%limits.chunkBytes+1:bytes.length)}}
 return pipeline(Readable.from(chunks()),res)
}
