import {randomUUID} from 'node:crypto';
import {requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
const key='phase2:v1:notice-scheduler';
// Explicit tick only. No timer, route, credentials, account creation or delivery.
// The future authorized operator must supply its generation-only callback.
export async function tickPhase2NoticeScheduler(db,config,generate){
 requirePhase2(config);requirePhase2Database(db,config);
 const p=config.phase2Scheduler;
 if(!p?.enabled||!Number.isInteger(p.intervalMinutes)||p.intervalMinutes<1||p.intervalMinutes>10080||typeof p.approvalReference!=='string'||!p.approvalReference.trim())return {status:'BLOCKED',reason:'APPROVED_SCHEDULE_REQUIRED',generated:false};
 if(typeof generate!=='function')throw Error('Notice generation callback required');
 const now=config.phase2Clock?config.phase2Clock():Date.now(),lease=randomUUID();
 const read=async()=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);return row?JSON.parse(row.value):null;};
 const save=v=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(v));
 const claimed=await db.transaction(async()=>{const s=await read();if(s&&(s.leaseUntil>now||s.nextRun>now))return false;await save({...s,lease,leaseUntil:now+120000,startedAt:new Date(now).toISOString(),status:'RUNNING'});return true;});
 if(!claimed)return {status:'SKIPPED',generated:false};
 try{
  await generate();await db.transaction(async()=>{const s=await read();if(s?.lease===lease)await save({...s,status:'SUCCEEDED',leaseUntil:0,nextRun:now+p.intervalMinutes*60000,approvalReference:p.approvalReference,lastError:null});});
  return {status:'PASS',generated:true,externalDelivery:false};
 }catch{
  await db.transaction(async()=>{const s=await read();if(s?.lease===lease)await save({...s,status:'FAILED',leaseUntil:0,nextRun:now,lastError:'NOTICE_GENERATION_FAILED'});});
  return {status:'FAIL',generated:false,reason:'NOTICE_GENERATION_FAILED',externalDelivery:false};
 }
}
