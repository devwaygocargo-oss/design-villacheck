import {decisionAudit,approvedReviewAuthority} from './decision-audit.mjs';
import {paidQrVisibility} from './phase2-paid-qr-visibility.mjs';
import {hasAdminAccess} from './admin-access.mjs';
import {merchantProfile} from './merchant-capabilities.mjs';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto'
import {publishedVillas} from './public-revision.mjs'
import {trustDto} from './catalog.mjs'
import {isDemoVilla} from './demo-villa-visibility.mjs'
import {audit} from './database.mjs'
import {assertWriteSession} from './write-session.mjs'
import {loadTrustContext} from './villa-read-context.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const read=async(db,key)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);return row?JSON.parse(row.value):null}
const put=(db,key,value)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value))
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const normalize=value=>String(value||'').normalize('NFKC').replace(/[ -]/g,'')
const ref=value=>typeof value==='string'&&/^VC-[A-Za-z0-9-]{1,100}$/.test(value)
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+60000
const fields=(data,allowed)=>{if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!allowed.includes(k)))fail(400,'ข้อมูลคำขอไม่ถูกต้อง')}
const scalarQuery=(url,allowed)=>{for(const key of url.searchParams.keys())if(!allowed.includes(key)||url.searchParams.getAll(key).length!==1)fail(400,'ข้อมูลคำขอไม่ถูกต้อง')}
export function registryPrecheckRoute(method,path){return method==='GET'&&['/api/user/precheck/history','/api/user/precheck/search','/api/user/precheck/registry','/api/admin/registry-bank-verification'].includes(path)||method==='POST'&&['/api/user/precheck/compare','/api/admin/registry-bank-verification'].includes(path)}
export function assertRegistryPrecheckRole(user,path){if(!user)fail(401,'กรุณาเข้าสู่ระบบ');if(user.role!==(path.startsWith('/api/admin/')?'admin':'user'))fail(403,'บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้')}
async function budget(db,user,kind,limit){const now=Date.now(),key=digest(['registry-precheck',kind,user.id]);const row=await db.transaction(()=>db.prepare('INSERT INTO rate_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires<=? THEN 1 ELSE rate_limits.count+1 END,expires=CASE WHEN rate_limits.expires<=? THEN excluded.expires ELSE rate_limits.expires END RETURNING count').get(key,now+15*60000,now,now));if(row.count>limit)fail(429,'คำขอถี่เกินไป กรุณารอ 15 นาที')}
export async function registryContactPhone(db,villa){return villa.phone||(await merchantProfile(db,{id:villa.owner_id,role:'merchant'}))?.fields.phone||(await db.prepare('SELECT phone FROM users WHERE id=?').get(villa.owner_id))?.phone||'';}
export async function registryAccount(db,villa){
 const anyPropertyField=[villa.bank_name,villa.account_name,villa.account_number].some(v=>typeof v==='string'&&v.trim())
 if(anyPropertyField)return{source:'PROPERTY',revision:villa.reviewed_at||null,bankName:villa.bank_name||'',accountName:villa.account_name||'',accountNumber:normalize(villa.account_number)}
 const bank=await read(db,'merchant_receiving_bank:'+villa.owner_id)
 return bank?{source:'MERCHANT',revision:bank.revision||0,bankName:typeof bank.bankName==='string'?bank.bankName:'',accountName:typeof bank.accountName==='string'?bank.accountName:'',accountNumber:normalize(bank.accountNumber)}:{source:null,bankName:'',accountName:'',accountNumber:''}
}
const fingerprint=(villa,bank)=>digest([villa.id,villa.owner_id,bank.source,bank.revision||null,bank.bankName,bank.accountName,bank.accountNumber])
const anyBank=bank=>Boolean(bank.bankName||bank.accountName||bank.accountNumber)
const completeBank=bank=>Boolean(bank.bankName&&bank.accountName&&/^\d{6,30}$/.test(bank.accountNumber))
async function target(db,qr){
 if(!ref(qr))fail(400,'กรุณาเลือกที่พักจากผลการค้นหา')
 let villa=await db.prepare('SELECT * FROM villas WHERE qr=?').get(qr)
 if(!villa){const alias=await read(db,'qr_alias:'+qr);if(alias?.villaId)villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(alias.villaId)}
 if(villa&&process.env.APP_ENV==='production'&&isDemoVilla(villa))return null
 return villa||null
}
async function registryPublished(db,trustOptions){const result=[];for(const v of await publishedVillas(db))if((await paidQrVisibility(db,v,trustOptions.phase2Config)).visible)result.push(v);return result;}
async function eligibility(db,villa,trustOptions){if(villa&&!(await paidQrVisibility(db,villa,trustOptions.phase2Config)).visible)return{available:false,status:'NO_REGISTERED_INFORMATION'};if(trustOptions.publicPublicationDisabled===true)return{available:false,status:'SUSPENDED_UNAVAILABLE'};if(!villa)return{available:false,status:'NO_REGISTERED_INFORMATION'};const trust=await trustDto(db,villa,undefined,trustOptions);if(['SUSPENDED','INACTIVE','EXPIRED'].includes(trust.qrStatus)||villa.status==='rejected')return{available:false,status:'SUSPENDED_UNAVAILABLE'};if(villa.status!=='approved'||trust.qrStatus!=='ACTIVE')return{available:false,status:'PENDING_VERIFICATION'};const published=(await registryPublished(db,trustOptions)).some(v=>v.id===villa.id);return published?{available:true,status:null}:{available:false,status:'SUSPENDED_UNAVAILABLE'}}
async function bankEvidence(db,villa,bank){
 const record=await read(db,'registry_bank_verification:'+villa.id)
 if(!record||record.fingerprint!==fingerprint(villa,bank))return{status:anyBank(bank)?'REGISTERED_NOT_INDEPENDENTLY_VERIFIED':'NO_REGISTERED_INFORMATION',lastVerifiedAt:null}
 const doc=record.evidenceId?await db.prepare('SELECT id,owner_id,mime,bytes FROM documents WHERE id=?').get(record.evidenceId):null
 const proof=doc&&doc.owner_id===record.uploadedBy&&['application/pdf','image/jpeg','image/png'].includes(doc.mime)&&digest(Buffer.from(doc.bytes).toString('base64'))===record.evidenceHash
 if(!proof)return{status:anyBank(bank)?'REGISTERED_NOT_INDEPENDENTLY_VERIFIED':'NO_REGISTERED_INFORMATION',lastVerifiedAt:null}
 if(record.status==='pending')return{status:'PENDING_VERIFICATION',lastVerifiedAt:null}
 const reviewer=record.reviewedBy?await db.prepare('SELECT id,role FROM users WHERE id=?').get(record.reviewedBy):null
 const verified=record.status==='accepted'&&completeBank(bank)&&await approvedReviewAuthority(db,reviewer,villa.id,record.reviewedAt,'BANK_IDENTITY')&&reviewer.id!==villa.owner_id&&validDate(record.reviewedAt)&&record.checks?.accountNumberMatched===true&&record.checks?.accountHolderMatched===true&&record.checks?.bankMatched===true&&['BANK_STATEMENT','BANK_CONFIRMATION'].includes(record.evidenceType)
 return{status:verified?'VERIFIED':anyBank(bank)?'REGISTERED_NOT_INDEPENDENTLY_VERIFIED':'NO_REGISTERED_INFORMATION',lastVerifiedAt:verified?record.reviewedAt:null,method:verified?'DOCUMENTARY_REVIEW':null}
}
async function identityEvidence(db,villa){const record=await read(db,'owner_verification:'+villa.id);if(!record)return{status:'REGISTERED_NOT_INDEPENDENTLY_VERIFIED',lastVerifiedAt:null};if(record.status==='pending')return{status:'PENDING_VERIFICATION',lastVerifiedAt:null};const ids=[record.files?.face?.id,record.files?.house?.id];if(record.status!=='accepted'||!validDate(record.reviewedAt)||(!ids.every(Boolean)||ids[0]===ids[1])||record.checks?.faceMatched!==true||record.checks?.houseMatched!==true||record.checks?.ownerConfirmed!==true)return{status:'REGISTERED_NOT_INDEPENDENTLY_VERIFIED',lastVerifiedAt:null};const reviewer=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(record.reviewedBy);for(const [index,id]of ids.entries()){const doc=await db.prepare('SELECT owner_id,mime FROM documents WHERE id=?').get(id),allowed=index===0?['image/jpeg','image/png','video/mp4']:['application/pdf','image/jpeg','image/png'];if(doc?.owner_id!==villa.owner_id||!allowed.includes(doc?.mime))return{status:'REGISTERED_NOT_INDEPENDENTLY_VERIFIED',lastVerifiedAt:null}}return{status:await approvedReviewAuthority(db,reviewer,villa.id,record.reviewedAt,'OWNER_IDENTITY')?'VERIFIED':'REGISTERED_NOT_INDEPENDENTLY_VERIFIED',lastVerifiedAt:await approvedReviewAuthority(db,reviewer,villa.id,record.reviewedAt,'OWNER_IDENTITY')?record.reviewedAt:null}}
function authenticatedBank(bank,evidence,withheld=false){if(withheld)return{source:bank.source,bankName:null,accountName:null,accountNumber:null,hasAccountNumber:Boolean(bank.accountNumber),accountNameDisclosure:bank.accountName?'WITHHELD':'NONE',accountNumberDisclosure:bank.accountNumber?'WITHHELD':'NONE',verification:evidence};return{source:bank.source,bankName:bank.bankName||null,accountName:bank.accountName||null,accountNumber:bank.accountNumber||null,hasAccountNumber:Boolean(bank.accountNumber),accountNameDisclosure:bank.accountName?'AUTHORIZED_FULL':'NONE',accountNumberDisclosure:bank.accountNumber?'AUTHORIZED_FULL':'NONE',verification:evidence}}
export async function registryPrecheckApi(db,user,req,path,url,body,validateDocument,trustOptions={}){
 if(!registryPrecheckRoute(req.method,path))return undefined
 if(user&&user.role!==(path.startsWith('/api/admin/')?'admin':'user'))await audit(db,user,'registry.precheck.access_denied',path)
 assertRegistryPrecheckRole(user,path)
 if(path==='/api/user/precheck/history'){scalarQuery(url,[]);await budget(db,user,'history',30);return{history:(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all('registry_precheck_result:'+user.id+':%')).map(row=>JSON.parse(row.value)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,200)}}
 if(path==='/api/admin/registry-bank-verification')return adminEvidence(db,user,req,url,body,validateDocument)
 if(path==='/api/user/precheck/search'){
  if(trustOptions.publicPublicationDisabled===true)return{properties:[],nextCursor:null};
  scalarQuery(url,['q','cursor']);const query=(url.searchParams.get('q')||'').normalize('NFKC').trim(),cursor=Number(url.searchParams.get('cursor')||0)
  if(query.length>100||/[\x00-\x1f]/.test(query)||!Number.isInteger(cursor)||cursor<0||cursor>200)fail(400,'คำค้นหาไม่ถูกต้อง')
  if(query.length<2)return{properties:[],nextCursor:null}
  await budget(db,user,'search',120)
  const matching=(await registryPublished(db,trustOptions)).filter(v=>!(process.env.APP_ENV==='production'&&isDemoVilla(v))&&[v.name,v.name_en].some(name=>String(name||'').normalize('NFKC').toLowerCase().includes(query.toLowerCase())))
  const context=await loadTrustContext(db,matching),properties=[];let index=cursor
  for(;index<matching.length&&properties.length<8;index++){const v=matching[index];if((await trustDto(db,v,context,trustOptions)).qrStatus==='ACTIVE')properties.push({id:v.id,qr:v.qr,name:v.name,nameEn:v.name_en||'',province:v.province,photoUrl:v.photo_url||null})}
  await audit(db,user,'registry.precheck.search','bounded-public-property-search')
  return{properties,nextCursor:index<matching.length&&index<=200?index:null}
 }
 const data=req.method==='GET'?null:await body(req)
 if(req.method==='GET')scalarQuery(url,['qr']);else fields(data,['qr','account','viewToken'])
 const qr=req.method==='GET'?url.searchParams.get('qr'):data.qr
 await budget(db,user,req.method==='GET'?'registry':'compare',req.method==='GET'?30:10)
 const villa=await target(db,qr),state=await eligibility(db,villa,trustOptions)
 if(req.method==='GET'){
  await audit(db,user,'registry.precheck.read',villa?.id||'not-found')
  if(!state.available)return{available:false,verification:{status:state.status,lastVerifiedAt:null},property:null,bank:null,contact:null,viewToken:null,guarantee:false}
  const bank=await registryAccount(db,villa),evidence=await bankEvidence(db,villa,bank),phone=await registryContactPhone(db,villa),token=randomUUID()
  await db.transaction(async()=>{const expired=(await db.prepare('SELECT key,value FROM system_settings WHERE key LIKE ?').all('registry_precheck_view:'+user.id+':%')).filter(row=>JSON.parse(row.value).expiresAt<=Date.now());for(const row of expired)await db.prepare('DELETE FROM system_settings WHERE key=?').run(row.key);await put(db,'registry_precheck_view:'+user.id+':'+token,{villaId:villa.id,fingerprint:fingerprint(villa,bank),expiresAt:Date.now()+15*60000})})
  return{available:true,property:{id:villa.id,qr:villa.qr,name:villa.name,nameEn:villa.name_en||'',province:villa.province,photoUrl:villa.photo_url||null,merchantName:villa.merchant||null},bank:authenticatedBank(bank,evidence,trustOptions.privateRegistryDetails===true),contact:{phone:trustOptions.privateRegistryDetails?null:phone||null,disclosure:phone?(trustOptions.privateRegistryDetails?'WITHHELD':'AUTHORIZED_FULL'):'NONE',source:villa.phone?'PROPERTY':phone?'MERCHANT':null},verification:evidence,propertyVerification:await identityEvidence(db,villa),viewToken:token,guarantee:false}
 }
 if(typeof data.account!=='string'||data.account.length>50||!/^\d{6,30}$/.test(normalize(data.account))||typeof data.viewToken!=='string'||!/^[a-f0-9-]{36}$/.test(data.viewToken))fail(400,'กรอกเลขบัญชี 6–30 หลักเพื่อเปรียบเทียบ')
 const view=await read(db,'registry_precheck_view:'+user.id+':'+data.viewToken)
 if(!view||view.expiresAt<=Date.now()||view.villaId!==villa?.id)fail(409,'ข้อมูลที่เลือกหมดอายุ กรุณาเลือกที่พักอีกครั้ง')
 if(!state.available){await audit(db,user,'registry.precheck.compare.unavailable',villa.id);return{result:'UNAVAILABLE',guarantee:false}}
 const bank=await registryAccount(db,villa);if(view.fingerprint!==fingerprint(villa,bank))fail(409,'ข้อมูลทะเบียนเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่')
 const same=bank.accountNumber&&timingSafeEqual(createHash('sha256').update(normalize(data.account)).digest(),createHash('sha256').update(bank.accountNumber).digest()),result=!bank.accountNumber?'NO_REGISTERED_INFORMATION':same?'MATCH':'MISMATCH'
 await audit(db,user,'registry.precheck.compare.'+result.toLowerCase(),villa.id)
 const reference='RGC-'+randomUUID();await put(db,'registry_precheck_result:'+user.id+':'+reference,{reference,qr:villa.qr,result,createdAt:new Date().toISOString()});
 return{result,reference,scope:'REGISTRY_ONLY',guarantee:false}
}
async function adminEvidence(db,user,req,url,body,validateDocument){
 const data=req.method==='GET'?null:await body(req);if(req.method==='GET')scalarQuery(url,['villaId']);else fields(data,['villaId','action','revision','file','evidenceType','accountNumberMatched','accountHolderMatched','bankMatched','reason'])
 const id=req.method==='GET'?url.searchParams.get('villaId'):data.villaId;if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))fail(400,'ไม่พบที่พัก')
 const getVilla=()=>db.prepare('SELECT * FROM villas WHERE id=?').get(id),villa=await getVilla();if(!villa)fail(404,'ไม่พบที่พัก')
 await budget(db,user,'admin-evidence',60)
 const view=async()=>{const current=await getVilla(),bank=await registryAccount(db,current),record=await read(db,'registry_bank_verification:'+id);return{villaId:id,propertyName:current.name,bank,verification:await bankEvidence(db,current,bank),revision:record?.revision||0,record:record?{status:record.status,evidenceType:record.evidenceType,evidenceName:record.evidenceName,evidenceUrl:'/api/admin/documents/'+record.evidenceId+'?preview=1',uploadedAt:record.uploadedAt,reviewedAt:record.reviewedAt||null,reason:record.reason||''}:null}}
 if(req.method==='GET')return view()
 await db.transaction(async()=>{
  await assertWriteSession(db,user)
  const current=await getVilla(),bank=await registryAccount(db,current),key='registry_bank_verification:'+id,previous=await read(db,key)
  if(data.revision!==(previous?.revision||0))fail(409,'หลักฐานเปลี่ยนแล้ว กรุณาโหลดใหม่')
  if(user.id===current.owner_id)fail(403,'ผู้ตรวจต้องเป็นผู้ดูแลที่ไม่ใช่เจ้าของที่พัก')
  if(data.action==='upload'){
   if(!completeBank(bank)||!['BANK_STATEMENT','BANK_CONFIRMATION'].includes(data.evidenceType))fail(400,'ต้องมีข้อมูลบัญชีครบและแนบหลักฐานธนาคาร')
   const file=validateDocument(data.file),evidenceId=randomUUID();if(!['application/pdf','image/jpeg','image/png'].includes(file.mime))fail(400,'ใช้หลักฐาน PDF, JPG หรือ PNG')
   await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(evidenceId,user.id,'registry-bank-proof:'+evidenceId,file.mime,file.bytes)
   await put(db,key,{revision:(previous?.revision||0)+1,status:'pending',fingerprint:fingerprint(current,bank),evidenceId,evidenceName:file.name,evidenceType:data.evidenceType,evidenceHash:digest(Buffer.from(file.bytes).toString('base64')),uploadedAt:new Date().toISOString(),uploadedBy:user.id,history:[...(previous?.history||[]),...(previous?[{action:'superseded',evidenceId:previous.evidenceId,status:previous.status,at:new Date().toISOString()}]:[])]})
  }else if(['accept','revoke'].includes(data.action)){
   if(!previous||previous.fingerprint!==fingerprint(current,bank))fail(409,'ข้อมูลบัญชีเปลี่ยนแล้ว ต้องตรวจหลักฐานใหม่')
   const file=await db.prepare('SELECT bytes,owner_id FROM documents WHERE id=?').get(previous.evidenceId);if(!file||file.owner_id!==previous.uploadedBy||digest(Buffer.from(file.bytes).toString('base64'))!==previous.evidenceHash)fail(409,'หลักฐานไม่ตรงกับฉบับที่อัปโหลด')
   if(data.action==='accept'&&!(await db.prepare("SELECT id FROM audits WHERE actor_id=? AND action='document.access' AND target_id=? AND created>=? LIMIT 1").get(user.id,previous.evidenceId,previous.uploadedAt)))fail(409,'เปิดอ่านหลักฐานฉบับนี้ก่อนยืนยันผลตรวจ')
   if(data.action==='accept'&&(previous.status!=='pending'||data.accountNumberMatched!==true||data.accountHolderMatched!==true||data.bankMatched!==true))fail(400,'ต้องตรวจหลักฐาน ชื่อธนาคาร ชื่อบัญชี และเลขบัญชีให้ตรงครบทุกข้อ')
   if(data.action==='revoke'&&(typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>1000||/[\x00-\x1f]/.test(data.reason)))fail(400,'ระบุเหตุผลยกเลิกผลตรวจ')
   await put(db,key,{...previous,revision:previous.revision+1,status:data.action==='accept'?'accepted':'revoked',checks:{accountNumberMatched:data.accountNumberMatched===true,accountHolderMatched:data.accountHolderMatched===true,bankMatched:data.bankMatched===true},reviewedBy:user.id,reviewedAt:new Date().toISOString(),reason:data.action==='revoke'?data.reason.trim():'',history:[...previous.history,{action:data.action,by:user.id,at:new Date().toISOString()}]})
  }else fail(400,'คำขอไม่ถูกต้อง')
  await audit(db,user,'registry.bank_evidence.'+data.action,id)
  if(['accept','revoke'].includes(data.action))await decisionAudit(db,user,{kind:'KYC',resourceType:'BANK_IDENTITY',targetId:id,outcome:data.action==='accept'?'APPROVED':'REJECTED',reason:data.reason||'',previousStatus:previous?.status||'NONE',newStatus:data.action==='accept'?'accepted':'revoked',action:'registry.bank_evidence.'+data.action});
 })
 return view()
}
// Scoped Staging document access is extended only for evidence created by this workflow.
export async function registryBankDocumentAllowed(db,user,method,path){
 const match=path.match(/^\/api\/admin\/documents\/([a-f0-9-]{36})$/)
 if(method!=='GET'||user?.role!=='admin'||!match)return false
 const file=await db.prepare('SELECT owner_id,name FROM documents WHERE id=?').get(match[1]);if(file?.name!=='registry-bank-proof:'+match[1])return false
 const uploader=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(file.owner_id);if(!await hasAdminAccess(db,uploader))return false
 const records=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'registry_bank_verification:%'").all()
 return records.some(row=>{const record=JSON.parse(row.value);return record.evidenceId===match[1]||record.history?.some(entry=>entry.evidenceId===match[1])})
}
