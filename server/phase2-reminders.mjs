import {createHash,randomUUID} from 'node:crypto';
import {selectedPhase2GrantRecord} from './phase2-grants.mjs';
export {currentReminderEntitlements} from './phase2-grants.mjs';
import {currentReminderEntitlements} from './phase2-grants.mjs';
import {queuePhase2NoticeEmail} from './phase2-notifications.mjs';
const prefix='phase2:v1:',DAY=86400000;
export const effectiveReminderPolicy=p=>({...p,noticeDays:p.remindersEnabled?[7]:[]});
export async function syncPhase2Reminders(db,p,now,ownerId){
 const current=await currentReminderEntitlements(db,now,ownerId),policy=effectiveReminderPolicy(p),created=[],scheduled=[],cancelled=[];
 const rows=await db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'phase2:v1:notice:%'").all(),notices=rows.map(r=>({key:r.key,notice:JSON.parse(r.value)})).filter(r=>!ownerId||r.notice.userId===ownerId);
 for(const row of notices){const n=row.notice,g=current.get(n.grantId);if(n.offsetDays!==7||!g||g.endsAt!==n.expiresAt||!policy.remindersEnabled||!policy.noticeDays.length){if(n.status!=='CANCELLED'){n.status='CANCELLED';n.cancelledAt=new Date(now).toISOString();n.cancellationReason='SUPERSEDED_OR_POLICY_DISABLED';await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(n),row.key);cancelled.push(n.id);}const q=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(prefix+'notice-email:'+n.id);if(q){const job=JSON.parse(q.value);if(!['sent','cancelled'].includes(job.status)){job.status='cancelled';job.lastError='NOTICE_SUPERSEDED';await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(job),prefix+'notice-email:'+n.id);}}}}
 if(!policy.remindersEnabled||!policy.noticeDays.length)return {created,scheduled,cancelled,externalMessagesSent:0};
 for(const g of current.values()){
  const expires=Date.parse(g.endsAt),due=expires-7*DAY;if(!Number.isFinite(expires)||expires<=now)continue;
  const prior=notices.find(row=>row.notice.grantId===g.id&&row.notice.expiresAt===g.endsAt&&row.notice.offsetDays===7);
  const key=prior?.key||prefix+'notice:'+g.id+':'+createHash('sha256').update(JSON.stringify(g.endsAt)).digest('hex')+':7';const found=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);
  let n=found?JSON.parse(found.value):null;
  // Existing unscheduled historical entitlements are not silently backfilled late.
  if(!n&&now>due)continue;
  if(!n){n={id:randomUUID(),grantId:g.id,scope:g.scope||'VILLA',...(g.villaId?{villaId:g.villaId}:{}),userId:g.userId,expiresAt:g.endsAt,offsetDays:7,scheduledFor:new Date(due).toISOString(),at:new Date(due).toISOString(),createdAt:new Date(now).toISOString(),timezone:policy.noticeTimezone||null,status:'SCHEDULED',channel:'IN_APP'};scheduled.push(n);}
  if(n.status==='CANCELLED'||!Number.isFinite(Date.parse(n.scheduledFor)))continue;
  if(now>=due&&n.status==='SCHEDULED'){n.status='IN_APP_AVAILABLE';n.availableFrom=n.scheduledFor;created.push(n);}
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(n));
  await queuePhase2NoticeEmail(db,n,policy);
 }
 return {created,scheduled,cancelled,externalMessagesSent:0};
}
export async function currentPhase2Notices(db,p,now){
 if(!p.remindersEnabled||!p.noticeChannels?.includes('IN_APP')||!p.noticeDays?.includes(7))return [];
 const current=await currentReminderEntitlements(db,now);
 return (await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:notice:%'").all()).map(r=>JSON.parse(r.value)).filter(n=>n.offsetDays===7&&n.status!=='CANCELLED'&&current.get(n.grantId)?.endsAt===n.expiresAt&&Number.isFinite(Date.parse(n.scheduledFor))&&Date.parse(n.scheduledFor)<=now&&Date.parse(n.createdAt)<=Date.parse(n.scheduledFor)).map(n=>({...n,status:'IN_APP_AVAILABLE'}));
}
