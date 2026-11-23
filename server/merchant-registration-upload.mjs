import {randomUUID,createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {assertWriteSession} from './write-session.mjs';
import {mediaRange} from './media-range.mjs';

export const merchantRegistrationLimits=Object.freeze({files:3,fileBytes:5*1024*1024,totalBytes:15*1024*1024,chunkBytes:512*1024,types:['application/pdf','image/jpeg','image/png']});
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const key=(user,id)=>'merchant_registration_upload:'+user.id+':'+id;
const partId=(id,index)=>id+'-registration-'+index;
const read=async(db,user,id)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(user,id));return row?JSON.parse(row.value):null;};
const save=(db,user,upload)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(user,upload.id),JSON.stringify(upload));
async function clearParts(db,user,upload){
 for(let index=0;index<upload.hashes.length;index++){const id=partId(upload.id,index);await db.prepare('DELETE FROM documents WHERE id=? AND owner_id=? AND name=?').run(id,user.id,'merchant-registration-upload:'+upload.id);await db.prepare('DELETE FROM system_settings WHERE key=?').run('private_document:'+id);}
}
async function discard(db,user,upload){if(upload.documentId)fail(409,'เอกสารถูกส่งแล้ว');await clearParts(db,user,upload);await db.prepare('DELETE FROM system_settings WHERE key=?').run(key(user,upload.id));}
async function eligible(db,user,revision){
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('merchant_registration_application:'+user.id),application=row?JSON.parse(row.value):null;
 if(!Number.isInteger(revision)||revision!==(application?.revision||0)||application&&['pending','approved'].includes(application.status))fail(409,'คำขอมีการเปลี่ยนแปลง กรุณาโหลดใหม่');
}
const receipt=upload=>({uploadId:upload.id,chunkBytes:merchantRegistrationLimits.chunkBytes,received:upload.received});
export async function merchantRegistrationUpload(db,user,data,validateDocument,verifiedContact){
 return db.transaction(async()=>{
  await assertWriteSession(db,user);
  if(data.action==='upload_start'){
   if(!verifiedContact)fail(403,'กรุณายืนยันอีเมลหรือเบอร์โทรด้วย OTP ก่อนส่งเอกสาร');
   if(!uuid(data.requestId)||!Number.isInteger(data.fileIndex)||data.fileIndex<0||data.fileIndex>=merchantRegistrationLimits.files||!merchantRegistrationLimits.types.includes(data.mime))fail(400,'ข้อมูลเอกสารไม่ถูกต้อง');
   if(!Number.isInteger(data.size)||data.size<1||data.size>merchantRegistrationLimits.fileBytes)fail(413,'เอกสารต้องไม่เกินไฟล์ละ 5 MB');
   const signature=data.mime==='application/pdf'?Buffer.from('%PDF-'):data.mime==='image/png'?Buffer.from([137,80,78,71,13,10,26,10]):Buffer.from([255,216,255]);
   const name=validateDocument({name:data.name,data:'data:'+data.mime+';base64,'+signature.toString('base64')}).name;
   const uploads=(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all('merchant_registration_upload:'+user.id+':%')).map(row=>JSON.parse(row.value));
   const existing=uploads.find(upload=>upload.requestId===data.requestId&&upload.fileIndex===data.fileIndex);
   if(existing&&(existing.documentId||existing.expiresAt>Date.now())){
    if(existing.name!==name||existing.mime!==data.mime||existing.size!==data.size||existing.expectedRevision!==data.expectedRevision)fail(409,'ข้อมูลคำขอเปลี่ยนไป กรุณาโหลดใหม่');
    return receipt(existing);
   }
   await eligible(db,user,data.expectedRevision);
   for(const upload of uploads)if(!upload.documentId&&upload.expiresAt<=Date.now())await discard(db,user,upload);
   if(uploads.filter(upload=>!upload.documentId&&upload.expiresAt>Date.now()).length>=merchantRegistrationLimits.files)fail(409,'มีเอกสารกำลังอัปโหลด กรุณาลองใหม่ภายหลัง');
   const upload={id:randomUUID(),ownerId:user.id,requestId:data.requestId,fileIndex:data.fileIndex,expectedRevision:data.expectedRevision,name,mime:data.mime,size:data.size,received:0,hashes:[],expiresAt:Date.now()+3600000};
   await save(db,user,upload);return receipt(upload);
  }
  if(!uuid(data.uploadId))fail(400,'รหัสไฟล์ไม่ถูกต้อง');
  const upload=await read(db,user,data.uploadId);
  if(data.action==='upload_cancel'){if(upload)await discard(db,user,upload);return{removed:true};}
  if(data.action!=='upload_part')fail(400,'คำสั่งไม่ถูกต้อง');
  if(!upload||upload.expiresAt<=Date.now()&&!upload.documentId)fail(404,'การอัปโหลดหมดอายุ กรุณาเลือกไฟล์ใหม่');
  if(!Number.isInteger(data.index)||data.index<0||data.index>upload.hashes.length||typeof data.base64!=='string'||data.base64.length>Math.ceil(merchantRegistrationLimits.chunkBytes/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))fail(400,'ส่วนของไฟล์ไม่ถูกต้อง');
  const bytes=Buffer.from(data.base64,'base64'),hash=sha(bytes);
  if(bytes.toString('base64')!==data.base64)fail(400,'ส่วนของไฟล์ไม่ถูกต้อง');
  if(data.index<upload.hashes.length){if(hash!==upload.hashes[data.index])fail(409,'ส่วนของไฟล์ไม่ถูกต้อง');return receipt(upload);}
  if(upload.documentId)fail(409,'เอกสารถูกส่งแล้ว');
  await eligible(db,user,upload.expectedRevision);
  if(bytes.length!==Math.min(merchantRegistrationLimits.chunkBytes,upload.size-upload.received)||!bytes.length)fail(400,'ส่วนของไฟล์ไม่ถูกต้อง');
  if(data.index===0)validateDocument({name:upload.name,data:'data:'+upload.mime+';base64,'+data.base64});
  const id=partId(upload.id,data.index);
  await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(id,user.id,'merchant-registration-upload:'+upload.id,upload.mime,bytes);
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('private_document:'+id,JSON.stringify({ownerId:user.id,kind:'merchant_registration_upload'}));
  upload.hashes.push(hash);upload.received+=bytes.length;await save(db,user,upload);return receipt(upload);
 });
}
export async function resolveMerchantUploads(db,user,data,validateDocument){
 if(!Array.isArray(data.uploadIds)||data.uploadIds.length<1||data.uploadIds.length>merchantRegistrationLimits.files||new Set(data.uploadIds).size!==data.uploadIds.length||data.uploadIds.some(id=>!uuid(id)))fail(400,'กรุณาแนบเอกสาร 1 ถึง 3 ไฟล์');
 const files=[];
 for(const [index,id]of data.uploadIds.entries()){
  const upload=await read(db,user,id);
  if(!upload||upload.requestId!==data.requestId||upload.fileIndex!==index||upload.expectedRevision!==data.expectedRevision||upload.received!==upload.size||!upload.documentId&&upload.expiresAt<=Date.now())fail(409,'เอกสารยังอัปโหลดไม่ครบหรือหมดอายุ กรุณาลองใหม่');
  let bytes;
  if(upload.documentId){const doc=await db.prepare('SELECT bytes FROM documents WHERE id=? AND owner_id=?').get(upload.documentId,user.id);if(!doc)fail(409,'ไม่พบเอกสาร');bytes=Buffer.from(doc.bytes);}
  else{const parts=[];for(let part=0;part<upload.hashes.length;part++){const row=await db.prepare('SELECT bytes FROM documents WHERE id=? AND owner_id=? AND name=?').get(partId(id,part),user.id,'merchant-registration-upload:'+id);if(!row||sha(row.bytes)!==upload.hashes[part])fail(409,'ส่วนของไฟล์ไม่ถูกต้อง');parts.push(Buffer.from(row.bytes));}bytes=Buffer.concat(parts);}
  if(bytes.length!==upload.size||upload.contentHash&&sha(bytes)!==upload.contentHash)fail(409,'ส่วนของไฟล์ไม่ถูกต้อง');
  files.push({...validateDocument({name:upload.name,data:'data:'+upload.mime+';base64,'+bytes.toString('base64')},{maxBytes:merchantRegistrationLimits.fileBytes}),upload});
 }
 return files;
}
export async function attachMerchantUpload(db,user,file,documentId){
 if(!file.upload)return;
 await clearParts(db,user,file.upload);
 await save(db,user,{...file.upload,documentId,contentHash:sha(file.bytes)});
}
export async function sendMerchantRegistrationDocument(file,req,res,url){
 const bytes=Buffer.from(file.bytes),range=mediaRange(req.headers.range,bytes.length);
 if(range?.invalid){res.writeHead(416,{'Content-Range':'bytes */'+bytes.length,'Cache-Control':'private, no-store'});return res.end();}
 const start=range?.start||0,end=range?.end??bytes.length-1;
 res.writeHead(range?206:200,{'Content-Type':file.mime,'Content-Length':end-start+1,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${bytes.length}`} : {}),'Content-Disposition':(url.searchParams.get('preview')==='1'?'inline':'attachment')+'; filename="document"; filename*=UTF-8\'\''+encodeURIComponent(file.name).replace(/'/g,'%27'),'Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
 res.flushHeaders();
 async function* chunks(){for(let offset=start;offset<=end;offset+=64*1024)yield bytes.subarray(offset,Math.min(offset+64*1024,end+1));}
 try{await pipeline(Readable.from(chunks()),res);}catch(error){if(!res.destroyed)throw error;}
}
