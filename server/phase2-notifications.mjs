import {currentReminderEntitlements} from './phase2-grants.mjs';
import {hasMerchantCapability} from './merchant-capabilities.mjs';
import {randomUUID} from 'node:crypto';
import {requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
const key=id=>'phase2:v1:notice-email:'+id;
export async function queuePhase2NoticeEmail(db,notice,policy){
 if(!policy.noticeChannels?.includes('EMAIL'))return;
 const u=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(notice.userId);
 if(!u?.email)return;
 const value={id:notice.id,notice,recipient:u.email,status:'queued',attempts:0,nextAttempt:Date.parse(notice.scheduledFor),policyRevision:policy.revision};
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run(key(notice.id),JSON.stringify(value));
}
export async function deliverPhase2NoticeEmails(db,config){
 requirePhase2(config);requirePhase2Database(db,config);
 const from=config.phase2SmtpFrom||config.smtpFrom;
 if(!config.phase2ReminderDeliveryAcceptanceReference||!config.phase2Scheduler?.enabled||!config.phase2Scheduler?.approvalReference||!config.phase2EmailEnabled||!config.phase2NoticeTransport||!from||!config.phase2EmailRecipientAllowlist?.length)throw Object.assign(Error('Approved Email transport/recipient allowlist required'),{status:503});
 const now=config.phase2Clock?config.phase2Clock():Date.now(),result={sent:0,failed:0,cancelled:0,blocked:0};
 const read=async id=>{const r=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(id));return r?JSON.parse(r.value):null;};
 const save=v=>db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(v),key(v.id));
 const pending=(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:notice-email:%'").all()).map(r=>JSON.parse(r.value));
 for(const entry of pending){
  const lease=randomUUID();const claimed=await db.transaction(async()=>{
   const job=await read(entry.id);if(!job||!['queued','failed','sending'].includes(job.status)||job.nextAttempt>now||job.attempts>=8)return null;
   const policyRow=await db.prepare("SELECT value FROM system_settings WHERE key='phase2:v1:policy'").get();
   const policy=policyRow?JSON.parse(policyRow.value):null;
   if(!policy?.remindersEnabled||!policy.noticeTimezone||!policy.noticeScheduleApprovalReference||!policy?.noticeChannels?.includes('EMAIL')||job.notice.offsetDays!==7||!policy.noticeDays?.includes(7)){job.status='cancelled';job.lastError='NOTICE_POLICY_REVOKED';await save(job);result.cancelled++;return null;}
   if(!Number.isFinite(Date.parse(job.notice.scheduledFor))||now<Date.parse(job.notice.scheduledFor)||now>=Date.parse(job.notice.scheduledFor)+86400000){job.status='cancelled';job.lastError='SEVEN_DAY_DELIVERY_WINDOW_MISSED';await save(job);result.cancelled++;return null;}
   if(!config.phase2EmailRecipientAllowlist.includes(job.recipient)){result.blocked++;return null;}
   const grant=(await currentReminderEntitlements(db,now)).get(job.notice.grantId);
   const parent=job.notice.scope==='MERCHANT_ACCOUNT'?null:await db.prepare('SELECT owner_id FROM villas WHERE id=?').get(job.notice.villaId);
   const recipient=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(job.notice.userId);
   const access=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+job.notice.userId);
   if(recipient?.email!==job.recipient||(job.notice.scope==='MERCHANT_ACCOUNT'?!recipient||!await hasMerchantCapability(db,recipient):parent?.owner_id!==job.notice.userId)||grant?.endsAt!==job.notice.expiresAt||Date.parse(job.notice.expiresAt)<=now||access&&JSON.parse(access.value).status==='suspended'){job.status='cancelled';await save(job);result.cancelled++;return null;}
   Object.assign(job,{lease,status:'sending',attempts:job.attempts+1,nextAttempt:now+120000});await save(job);return job;
  });
  if(!claimed)continue;
  let ok=false;
  try{
   const expires=new Intl.DateTimeFormat('th-TH',{timeZone:claimed.notice.timezone,dateStyle:'long',timeStyle:'short'}).format(new Date(claimed.notice.expiresAt));
   await config.phase2NoticeTransport.sendMail({from,to:claimed.recipient,subject:'VillaCheck — แจ้งกำหนดสิ้นสุดสิทธิ์แพ็กเกจ',text:`สิทธิ์แพ็กเกจ${claimed.notice.scope==='MERCHANT_ACCOUNT'?'ทดลองของบัญชี Merchant':'ของที่พัก '+claimed.notice.villaId} มีกำหนดสิ้นสุด ${expires}\nตรวจสอบรายละเอียดและเริ่มต่ออายุได้ด้วยตนเองใน Back-office\nไม่มีการเรียกเก็บเงินหรือต่ออายุอัตโนมัติ`,messageId:`<phase2-notice-${claimed.id}@villacheck.local>`});ok=true;
  }catch{/* Never persist SMTP errors, credentials or recipient details in logs. */}
  await db.transaction(async()=>{const current=await read(claimed.id);if(current?.lease!==lease)return;Object.assign(current,{status:ok?'sent':'failed',lastError:ok?null:'EMAIL_DELIVERY_FAILED',nextAttempt:now+Math.min(3600000,30000*2**current.attempts),...(ok?{sentAt:new Date(now).toISOString()}:{})});await save(current);});
  result[ok?'sent':'failed']++;
 }
 return result;
}
