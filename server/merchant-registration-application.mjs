import {randomUUID,createHash} from 'node:crypto';
import {audit} from './database.mjs';
import {decisionAudit} from './decision-audit.mjs';
import {assertWriteSession} from './write-session.mjs';
import {publicOtpEmail,publicOtpPhone,roleOtpContactVerified} from './role-otp-contacts.mjs';
import {merchantRegistrationLimits,merchantRegistrationUpload,resolveMerchantUploads,attachMerchantUpload} from './merchant-registration-upload.mjs';
export {merchantRegistrationLimits,sendMerchantRegistrationDocument} from './merchant-registration-upload.mjs';

const prefix='merchant_registration_application:';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const read=async(db,id)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(prefix+id);return row?JSON.parse(row.value):null;};
const save=(db,row)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(prefix+row.userId,JSON.stringify(row));
const clean=(value,label,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))fail(400,'กรุณากรอก'+label+'ให้ถูกต้อง');return value.trim();};
const digest=value=>createHash('sha256').update(value).digest('hex');
// Keep the request below the hosting payload cap without base64 transport
// overhead. This parser is used only after Merchant session/origin/CSRF checks.
async function registrationBody(req,readBody){
 const contentType=req.headers['content-type']||'';
 if(!/^multipart\/form-data(?:;|$)/i.test(contentType))return readBody(req);
 const limit=4*1024*1024+32*1024,chunks=[];
 let size=0,tooLarge=Number(req.headers['content-length'])>limit;
 // Drain a rejected request without retaining its bytes. Throwing inside a
 // Node request's async iterator destroys its socket before a 413 can arrive.
 for await(const chunk of req){size+=chunk.length;if(size>limit){tooLarge=true;chunks.length=0;}if(!tooLarge)chunks.push(chunk);}
 if(tooLarge)fail(413,'เอกสารรวมต้องไม่เกิน 4 MB');
 let form;
 try{form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':contentType}}).formData();}catch{fail(400,'ข้อมูลเอกสารไม่ถูกต้อง กรุณาเลือกไฟล์และส่งใหม่');}
 let payload;const uploads=[];
 for(const [key,value]of form){
  if(key==='application'&&typeof value==='string'&&payload===undefined&&Buffer.byteLength(value)<=16*1024){payload=value;continue;}
  if(key==='documents'&&typeof value!=='string'&&uploads.length<merchantRegistrationLimits.files){uploads.push(value);continue;}
  fail(400,'ข้อมูลเอกสารไม่ถูกต้อง กรุณาแนบเอกสาร 1 ถึง 3 ไฟล์');
 }
 let data;try{data=JSON.parse(payload);}catch{fail(400,'ข้อมูลใบสมัครไม่ถูกต้อง');}
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.hasOwn(data,'files'))fail(400,'ข้อมูลใบสมัครไม่ถูกต้อง');
 if(uploads.some(f=>f.size>merchantRegistrationLimits.fileBytes)||uploads.reduce((sum,f)=>sum+f.size,0)>merchantRegistrationLimits.totalBytes)fail(413,'เอกสารรวมต้องไม่เกิน 4 MB');
 const files=[];
 for(const file of uploads){
  if(!merchantRegistrationLimits.types.includes(file.type))fail(400,'รับเฉพาะ PDF, JPG, PNG');
  files.push({name:file.name,data:'data:'+file.type+';base64,'+Buffer.from(await file.arrayBuffer()).toString('base64')});
 }
 return{...data,files};
}
async function contacts(db,user){
 const email=await publicOtpEmail(db,user),phone=await publicOtpPhone(db,user);
 return{email:email&&await roleOtpContactVerified(db,user,'email',email)?email:'',phone:phone&&await roleOtpContactVerified(db,user,'sms',phone)?phone:''};
}
function dto(row,admin=false){
 if(!row)return null;
 return{userId:row.userId,revision:row.revision,status:row.status,fields:row.fields,verifiedContacts:row.verifiedContacts,documents:row.documents.map(d=>({...d,url:'/api/'+(admin?'admin':'merchant')+'/registration-documents/'+d.id})),submittedAt:row.submittedAt,updatedAt:row.updatedAt,reviewedAt:row.reviewedAt||null,reason:row.reason||'',history:row.history.map(({by,...entry})=>admin?{...entry,by}:entry)};
}
export async function merchantRegistrationApplication(db,user,req,path,url,readBody,validateDocument){
 const own=path==='/api/merchant/registration';
 const list=path==='/api/admin/merchant-registrations';
 const review=path.match(/^\/api\/admin\/merchant-registrations\/([a-f0-9-]{36})$/);
 const file=path.match(/^\/api\/(merchant|admin)\/registration-documents\/([a-f0-9-]{36})$/);
 if(!own&&!list&&!review&&!file)return undefined;
 const admin=list||Boolean(review)||file?.[1]==='admin';
 if(!user||user.role!==(admin?'admin':'merchant'))fail(403,'ไม่มีสิทธิ์เข้าถึงคำขอสมัครผู้ประกอบการ');
 if(file){
  if(req.method!=='GET')fail(405,'ไม่รองรับคำขอ');
  return db.transaction(async()=>{
   await assertWriteSession(db,user);
   const doc=await db.prepare('SELECT * FROM documents WHERE id=?').get(file[2]);
   if(!doc||!admin&&doc.owner_id!==user.id)fail(404,'ไม่พบเอกสาร');
   const application=await read(db,doc.owner_id);
   const ids=new Set([...(application?.documents||[]),...(application?.history||[]).flatMap(h=>h.documents||[])].map(d=>d.id));
   if(!application||!ids.has(doc.id))fail(404,'ไม่พบเอกสาร');
   await audit(db,user,'merchant_registration.document_access',doc.id);
   return{privateDocument:doc};
  });
 }
 if(list){
  if(req.method!=='GET')fail(405,'ไม่รองรับคำขอ');
  const rows=await db.prepare("SELECT s.value FROM system_settings s JOIN users u ON s.key='merchant_registration_application:'||u.id WHERE u.role='merchant' ORDER BY u.created DESC").all();
  return{applications:rows.map(r=>dto(JSON.parse(r.value),true))};
 }
 if(own&&req.method==='GET')return{application:dto(await read(db,user.id)),verifiedContacts:await contacts(db,user),limits:merchantRegistrationLimits};
 if(req.method!=='POST')fail(405,'ไม่รองรับคำขอ');
 const data=own?await registrationBody(req,readBody):await readBody(req);
 if(own&&['upload_start','upload_part','upload_cancel'].includes(data.action)){const verified=await contacts(db,user);return merchantRegistrationUpload(db,user,data,validateDocument,Boolean(verified.email||verified.phone));}
 if(review){
  if(!uuid(review[1])||data.action!=='review'||!['approved','changes','rejected'].includes(data.status))fail(400,'ผลการตรวจไม่ถูกต้อง');
  const reason=data.status==='approved'?String(data.reason||'').trim():clean(data.reason,'เหตุผลการตรวจ',2000);
  if(reason.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(reason))fail(400,'เหตุผลการตรวจไม่ถูกต้อง');
  return db.transaction(async()=>{
   await assertWriteSession(db,user);
   const target=await db.prepare("SELECT id FROM users WHERE id=? AND role='merchant'").get(review[1]),row=target&&await read(db,target.id);
   if(!row)fail(404,'ไม่พบคำขอสมัคร');
   if(data.expectedRevision!==row.revision)fail(409,'คำขอมีการเปลี่ยนแปลง กรุณาโหลดใหม่');
   if(row.status!=='pending'&&!(row.status==='approved'&&data.status==='changes'))fail(409,'คำขอนี้ตรวจแล้ว กรุณาโหลดข้อมูลล่าสุด');
   const at=new Date().toISOString(),previousDecisionStatus=row.status;
   row.history.push({action:'review',status:data.status,previousStatus:row.status,reason,revision:row.revision+1,at,by:user.id});
   Object.assign(row,{status:data.status,reason,reviewedAt:at,updatedAt:at,revision:row.revision+1});
   await save(db,row);await audit(db,user,'merchant_registration.'+data.status,row.userId);
   await decisionAudit(db,user,{kind:'KYC',resourceType:'MERCHANT_KYC',targetId:row.userId,outcome:data.status==='approved'?'APPROVED':data.status==='rejected'?'REJECTED':'CHANGES',reason:data.reason||'',previousStatus:previousDecisionStatus,newStatus:data.status,action:'merchant_registration.review'});
   // Document review does not activate subscriptions, approve Villas, alter
   // account suspension, or grant User/Admin/OAuth privileges.
   return{application:dto(row,true)};
  });
 }
 if(data.action!=='submit'||!uuid(data.requestId)||!Number.isInteger(data.expectedRevision)||data.consent!==true)fail(400,'กรุณากรอกข้อมูลและยืนยันสิทธิ์ในการส่งเอกสาร');
 const fields={businessName:clean(data.fields?.businessName,'ชื่อธุรกิจภาษาไทย',200),businessNameEn:clean(data.fields?.businessNameEn,'ชื่อธุรกิจภาษาอังกฤษ',200),contactName:clean(data.fields?.contactName,'ชื่อผู้ติดต่อ',200),address:clean(data.fields?.address,'ที่อยู่',2000)};
 const uploaded=data.uploadIds!==undefined;
 if(uploaded&&data.files!==undefined)fail(400,'ข้อมูลเอกสารไม่ถูกต้อง');
 if(!uploaded&&(!Array.isArray(data.files)||data.files.length<1||data.files.length>merchantRegistrationLimits.files))fail(400,'กรุณาแนบเอกสาร 1 ถึง 3 ไฟล์');
 const inline=uploaded?null:data.files.map(file=>validateDocument(file,{maxBytes:merchantRegistrationLimits.fileBytes}));
 return db.transaction(async()=>{
  await assertWriteSession(db,user);
  const files=uploaded?await resolveMerchantUploads(db,user,data,validateDocument):inline;
  if(files.some(f=>f.bytes.length>merchantRegistrationLimits.fileBytes)||files.reduce((sum,f)=>sum+f.bytes.length,0)>merchantRegistrationLimits.totalBytes)fail(413,'เอกสารต้องไม่เกินไฟล์ละ 5 MB');
  const fingerprint=digest(JSON.stringify({fields,files:files.map(f=>({name:f.name,mime:f.mime,hash:digest(f.bytes)})),consent:true}));
  const retryKey='merchant_registration_request:'+user.id+':'+data.requestId,retry=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(retryKey);
  if(retry){if(JSON.parse(retry.value).fingerprint!==fingerprint)fail(409,'ข้อมูลคำขอเปลี่ยนไป กรุณาโหลดใหม่');return{application:dto(await read(db,user.id)),idempotent:true};}
  const previous=await read(db,user.id);
  if(data.expectedRevision!==(previous?.revision||0))fail(409,'คำขอมีการเปลี่ยนแปลง กรุณาโหลดใหม่');
  if(previous&&['pending','approved'].includes(previous.status))fail(409,'คำขออยู่ระหว่างตรวจหรือผ่านการตรวจแล้ว กรุณารอผลหรือคำขอเอกสารเพิ่มเติม');
  const verifiedContacts=await contacts(db,user);
  if(!verifiedContacts.email&&!verifiedContacts.phone)fail(403,'กรุณายืนยันอีเมลหรือเบอร์โทรด้วย OTP ก่อนส่งเอกสาร');
  const at=new Date().toISOString(),documents=[];
  for(const file of files){const id=randomUUID();await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(id,user.id,file.name,file.mime,file.bytes);await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('private_document:'+id,JSON.stringify({ownerId:user.id,kind:'merchant_registration'}));documents.push({id,name:file.name,mime:file.mime,size:file.bytes.length});await attachMerchantUpload(db,user,file,id);}
  const history=previous?.history||[];
  if(previous)history.push({action:'superseded_documents',documents:previous.documents,at,by:user.id,revision:previous.revision});
  const revision=(previous?.revision||0)+1;
  history.push({action:previous?'resubmit':'submit',status:'pending',at,by:user.id,revision,consent:true});
  const row={userId:user.id,revision,status:'pending',fields,verifiedContacts,documents,submittedAt:at,updatedAt:at,reason:'',history};
  await save(db,row);
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(retryKey,JSON.stringify({fingerprint,revision}));
  await db.prepare('UPDATE users SET name=?,business_name=?,business_name_en=?,address=? WHERE id=? AND role=?').run(fields.contactName,fields.businessName,fields.businessNameEn,fields.address,user.id,'merchant');
  await audit(db,user,'merchant_registration.submitted',user.id);
  return{application:dto(row)};
 });
}
