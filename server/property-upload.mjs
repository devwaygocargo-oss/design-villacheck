import {randomUUID,createHash} from 'node:crypto';
import {assertWriteSession} from './write-session.mjs';
export const PROPERTY_IMAGE_MAX_BYTES=5*1024*1024;
export const PROPERTY_VIDEO_MAX_BYTES=25*1024*1024;
export const PROPERTY_UPLOAD_CHUNK_BYTES=512*1024;
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const key=(owner,id)=>'property_upload:'+owner+':'+id;
const uuid=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async(db,owner,id)=>{if(!uuid(id))fail(400,'รหัสอัปโหลดไม่ถูกต้อง');const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(owner,id));if(!row)fail(404,'ไม่พบไฟล์อัปโหลด กรุณาเลือกไฟล์ใหม่');return JSON.parse(row.value)};
const save=(db,owner,row)=>db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(row),key(owner,row.id));
export function validatePropertyBytes(type,bytes){
 if(!['image/jpeg','image/png','video/mp4'].includes(type))fail(400,'รองรับ JPG, PNG หรือ MP4 เท่านั้น');
 const max=type==='video/mp4'?PROPERTY_VIDEO_MAX_BYTES:PROPERTY_IMAGE_MAX_BYTES;
 if(!bytes.length||bytes.length>max)fail(413,type==='video/mp4'?'วิดีโอต้องไม่เกิน 25 MB':'รูปภาพต้องไม่เกิน 5 MB');
 if(type==='image/png'?!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?!bytes.subarray(0,3).equals(Buffer.from([255,216,255])):bytes.subarray(4,8).toString()!=='ftyp')fail(400,'เนื้อหาไฟล์ไม่ตรงกับชนิด');
}
async function discard(db,owner,row){
 // Attached business files are immutable history, never temporary cleanup targets.
 if(row.status!=='attached')await db.prepare('DELETE FROM documents WHERE owner_id=? AND (name=? OR name=?)').run(owner,'property-upload-part:'+row.id,'property-upload-ready:'+row.id);
 await db.prepare('DELETE FROM system_settings WHERE key=?').run(key(owner,row.id));
}
export async function propertyUpload(db,user,data){
 if(!user||!['merchant','admin'].includes(user.role))fail(403,'ไม่มีสิทธิ์อัปโหลดสื่อที่พัก');
 return db.transaction(async()=>{
  await assertWriteSession(db,user);
  if(data.action==='start'){
   if(typeof data.name!=='string'||!data.name.trim()||data.name.length>200||/[\x00-\x1f]/.test(data.name)||!['image/jpeg','image/png','video/mp4'].includes(data.type))fail(400,'รองรับ JPG, PNG หรือ MP4 เท่านั้น');
   const max=data.type==='video/mp4'?PROPERTY_VIDEO_MAX_BYTES:PROPERTY_IMAGE_MAX_BYTES;
   if(!Number.isInteger(data.size)||data.size<1||data.size>max)fail(413,data.type==='video/mp4'?'วิดีโอต้องไม่เกิน 25 MB':'รูปภาพต้องไม่เกิน 5 MB');
   const rows=await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all('property_upload:'+user.id+':%');let active=0,ready=0;
   for(const stored of rows){const row=JSON.parse(stored.value);if(row.expiresAt<=Date.now())await discard(db,user.id,row);else if(row.status==='uploading')active++;else if(row.status==='ready')ready++;}
   if(active>=2||ready>=13)fail(409,'มีไฟล์กำลังอัปโหลดอยู่ กรุณาส่งข้อมูลหรือยกเลิกไฟล์เดิมก่อน');
   const upload={id:randomUUID(),name:data.name.trim(),type:data.type,size:data.size,received:0,parts:[],status:'uploading',expiresAt:Date.now()+30*60*1000};
   await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(key(user.id,upload.id),JSON.stringify(upload));return{uploadId:upload.id,chunkBytes:PROPERTY_UPLOAD_CHUNK_BYTES};
  }
  const row=await read(db,user.id,data.uploadId);
  if(data.action==='cancel'){if(row.status==='attached')return{cancelled:false};await discard(db,user.id,row);return{cancelled:true};}
  if(row.expiresAt<=Date.now())fail(409,'การอัปโหลดหมดอายุ กรุณาเลือกไฟล์ใหม่');
  if(data.action==='finish'&&row.status==='ready')return{id:row.id,uploadId:row.id,name:row.name,type:row.type,size:row.size};
  if(row.status!=='uploading')fail(409,'ไฟล์อัปโหลดนี้ถูกใช้แล้ว');
  if(data.action==='part'){
   if(!Number.isInteger(data.index)||data.index<0||data.index>row.parts.length||typeof data.base64!=='string'||data.base64.length>Math.ceil(PROPERTY_UPLOAD_CHUNK_BYTES/3)*4||data.base64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))fail(400,'ส่วนของไฟล์ไม่ถูกต้อง');
   const bytes=Buffer.from(data.base64,'base64'),digest=hash(bytes),old=row.parts[data.index];
   if(old){if(old.hash!==digest||old.size!==bytes.length)fail(409,'ส่วนของไฟล์เดิมมีข้อมูลต่างกัน');return{received:row.received,replayed:true};}
   if(bytes.length!==Math.min(PROPERTY_UPLOAD_CHUNK_BYTES,row.size-row.received)||!bytes.length)fail(400,'ขนาดส่วนของไฟล์ไม่ถูกต้อง');
   const id=randomUUID();await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(id,user.id,'property-upload-part:'+row.id,row.type,bytes);
   row.parts.push({id,hash:digest,size:bytes.length});row.received+=bytes.length;await save(db,user.id,row);return{received:row.received};
  }
  if(data.action!=='finish')fail(400,'คำสั่งอัปโหลดไม่ถูกต้อง');
  if(row.received!==row.size)fail(409,'ไฟล์ยังอัปโหลดไม่ครบ');
  const stored=await db.prepare('SELECT id,bytes FROM documents WHERE owner_id=? AND name=?').all(user.id,'property-upload-part:'+row.id),map=new Map(stored.map(p=>[p.id,Buffer.from(p.bytes)]));
  const chunks=row.parts.map(p=>{const bytes=map.get(p.id);if(!bytes||bytes.length!==p.size||hash(bytes)!==p.hash)fail(409,'ข้อมูลส่วนของไฟล์ไม่ครบ');return bytes});const bytes=Buffer.concat(chunks);if(bytes.length!==row.size)fail(409,'ไฟล์ยังอัปโหลดไม่ครบ');validatePropertyBytes(row.type,bytes);
  await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(row.id,user.id,'property-upload-ready:'+row.id,row.type,bytes);
  await db.prepare('DELETE FROM documents WHERE owner_id=? AND name=?').run(user.id,'property-upload-part:'+row.id);row.status='ready';row.parts=[];await save(db,user.id,row);return{id:row.id,uploadId:row.id,name:row.name,type:row.type,size:row.size};
 });
}
// Caller must hold the enclosing business write transaction. Consuming a token
// and attaching its file commit or roll back together.
export async function preparedPropertyFile(db,owner,id){
 const row=await read(db,owner,id);if(row.status!=='ready'||row.expiresAt<=Date.now())fail(409,'ไฟล์อัปโหลดหมดอายุหรือถูกใช้แล้ว กรุณาเลือกไฟล์ใหม่');
 const file=await db.prepare('SELECT bytes FROM documents WHERE id=? AND owner_id=? AND name=?').get(id,owner,'property-upload-ready:'+id);if(!file)fail(404,'ไม่พบไฟล์อัปโหลด');const bytes=Buffer.from(file.bytes);validatePropertyBytes(row.type,bytes);return{...row,bytes};
}
export async function attachPropertyFile(db,owner,file,name,villaId){
 const row=await read(db,owner,file.id);if(row.status!=='ready')fail(409,'ไฟล์นี้ถูกใช้แล้ว');
 const result=await db.prepare('UPDATE documents SET name=? WHERE id=? AND owner_id=? AND name=?').run(name,file.id,owner,'property-upload-ready:'+file.id);if(result.changes!==1)fail(409,'ไฟล์อัปโหลดถูกเปลี่ยนแล้ว');
 row.status='attached';row.villaId=villaId||null;await save(db,owner,row);
}
