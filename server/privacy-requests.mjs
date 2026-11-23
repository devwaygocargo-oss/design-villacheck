import {createHash,randomUUID} from 'node:crypto'
import {publishedCms} from './cms.mjs'
import {audit,verifyPasswordAsync} from './database.mjs'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const requestView=(record,admin=false)=>{const status=record.status==='fulfilled'?'completed':['acknowledged','in_review','policy_pending'].includes(record.status)?'in_progress':record.status;const dueAt=record.dueAt||(Number.isFinite(Date.parse(record.requestedAt))?new Date(Date.parse(record.requestedAt)+30*86400000).toISOString():null);if(admin)return {...record,status,dueAt};return{id:record.id,userId:record.userId,kind:record.kind,status,requestedAt:record.requestedAt,updatedAt:record.updatedAt,dueAt,revision:record.revision||0,history:(record.history||[]).map(({status,reason,at})=>({status,reason,at}))};};
export async function privacyNoticeVersion(db){
 const published=await publishedCms(db),notice=published.content.pages.find(p=>p.slug==='privacy')||null
 return {version:createHash('sha256').update(JSON.stringify(notice)).digest('hex'),cmsRevision:published.revision,notice,legalApproval:'NOT_ASSERTED'}
}
// Intake only. This never exports, erases, anonymizes or transfers business data.
export async function privacyRequests(db,actor,method,data={}){
 if(!actor||!['user','merchant','admin'].includes(actor.role))fail(403,'กรุณาเข้าสู่ระบบบัญชีของคุณ')
 const prefix='privacy_request:'+actor.id+':'
 if(method==='GET')return {requests:(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ? ORDER BY key').all(prefix+'%')).map(r=>requestView(JSON.parse(r.value)))}
 if(method!=='POST')fail(405,'ไม่รองรับคำสั่งนี้')
 if(!['access','correction','deletion'].includes(data.kind)||typeof data.requestKey!=='string'||!/^[a-f0-9-]{36}$/.test(data.requestKey))fail(400,'ประเภทคำขอหรือเลขคำขอไม่ถูกต้อง')
 const account=await db.prepare('SELECT password_hash FROM users WHERE id=?').get(actor.id)
 // Authenticated intake supports OTP/OAuth accounts. Review never exports or erases data.
 if(!account)fail(401,'กรุณาเข้าสู่ระบบใหม่')
 if(data.currentPassword!==undefined&&(typeof data.currentPassword!=='string'||data.currentPassword.length>128||!await verifyPasswordAsync(data.currentPassword,account.password_hash)))fail(403,'รหัสผ่านไม่ถูกต้อง')
 const notice=await privacyNoticeVersion(db)
 return db.transaction(async()=>{
  const current=await db.prepare('SELECT password_hash FROM users WHERE id=?').get(actor.id)
  const session=await db.prepare('SELECT expires FROM sessions WHERE token_hash=? AND user_id=?').get(actor.token_hash,actor.id)
  if(!current||current.password_hash!==account.password_hash||!session||Number(session.expires)<=Date.now())fail(401,'กรุณาเข้าสู่ระบบใหม่')
  const key=prefix+data.requestKey,existing=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key)
  if(existing){const record=JSON.parse(existing.value);if(record.kind!==data.kind)fail(409,'เลขคำขอนี้ถูกใช้แล้ว');return {ok:true,request:requestView(record)}}
  const pending=(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all(prefix+'%')).map(r=>JSON.parse(r.value)).find(r=>r.kind===data.kind&&['pending_review','in_progress'].includes(r.status))
  if(pending)return {ok:true,request:requestView(pending)}
  const request={id:randomUUID(),userId:actor.id,kind:data.kind,status:'pending_review',requestedAt:new Date().toISOString(),dueAt:new Date(Date.now()+30*86400000).toISOString(),revision:0,history:[],noticeVersion:notice.version}
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run(key,JSON.stringify(request))
  await audit(db,actor,'privacy.request_created',request.id)
  return {ok:true,request}
 })
}
export async function adminPrivacyRequests(db,actor,method='GET',data={}){
 if(method==='POST')return reviewPrivacyRequest(db,actor,data);
 if(actor?.role!=='admin')fail(403,'เฉพาะ Admin')
 return {requests:(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'privacy_request:%'").all()).map(r=>requestView(JSON.parse(r.value),true))}
}

// Review workflow only: status transitions never execute a data deletion/export.
export async function reviewPrivacyRequest(db,actor,data){
 if(actor?.role!=='admin')fail(403,'เฉพาะ Admin')
 if(!data||typeof data.id!=='string'||!['in_progress','completed','rejected'].includes(data.status)||typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>2000)fail(400,'กรุณาระบุสถานะและเหตุผลการตรวจสอบ')
 return db.transaction(async()=>{
  const {assertWriteSession}=await import('./write-session.mjs');await assertWriteSession(db,actor)
  const rows=await db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'privacy_request:%'").all()
  const row=rows.find(r=>JSON.parse(r.value).id===data.id);if(!row)fail(404,'ไม่พบคำขอ')
  const current=JSON.parse(row.value)
  if((current.revision||0)!==data.revision)fail(409,'คำขอเปลี่ยนแล้ว กรุณาโหลดใหม่')
  if(['completed','rejected','fulfilled'].includes(current.status))fail(409,'คำขอนี้ปิดแล้ว')
  if(data.status==='completed'&&current.status!=='in_progress')fail(409,'ต้องตรวจสอบคำขอก่อนปิดงาน')
  const now=new Date().toISOString(),next={...current,status:data.status,revision:(current.revision||0)+1,updatedAt:now,history:[...(current.history||[]),{status:data.status,reason:data.reason.trim(),actorId:actor.id,at:now}]}
  await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(next),row.key)
  await audit(db,actor,'privacy.request_'+data.status,current.id)
  return {ok:true,request:requestView(next)}
 })
}
