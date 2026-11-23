import {phase2Capabilities,phase2Prices,requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
import {selectedPhase2GrantRecord,selectedPhase2Grant} from './phase2-grants.mjs';

// User-relayed Game decisions. No Production activation/configuration path.
export async function latestDecisionsEnabled(db,config){
 if(config?.phase2LatestBusinessDecisions!==true)return false;
 if(config.productionRuntime||config.phase2ProductionCoreOnly||!['development','phase2-local'].includes(config.appEnvironment)||!['localhost','127.0.0.1','::1'].includes(db.connectionIdentity?.host))throw Object.assign(Error('Latest decisions require isolated synthetic acceptance'),{status:503});
 requirePhase2(config);requirePhase2Database(db,config);
 if((await db.prepare("SELECT value FROM system_settings WHERE key='phase2:synthetic-runtime'").get())?.value!=='LOCAL_SYNTHETIC_ONLY')throw Object.assign(Error('Synthetic acceptance marker required'),{status:503});
 return true;
}
export function downgradedVideoRestriction(previous,packageId,policy){
 // Basic is confirmed to exclude video; gated higher-tier inheritance is not a confirmed denial.
 const rank=Object.keys(phase2Prices),downgrade=previous&&rank.indexOf(packageId)<rank.indexOf(previous.packageId)&&packageId==='basic';
 if(!phase2Capabilities(packageId,policy).video&&(downgrade||previous?.videoRestriction))return {reason:'DOWNGRADE_NO_VIDEO',decisionReference:'USER_RELAY_GAME_20261118',previousGrantId:previous.id};
 return null;
}
export async function publicPackageVideoAllowed(db,villa,config){
 if(!villa)return false;
 if(!await latestDecisionsEnabled(db,config))return true;
 const selected=await selectedPhase2GrantRecord(db,villa,config.phase2Clock?.()??Date.now());
 return !selected?.videoRestriction;
}
function safePublication(job,now){
 if(job.status!=='published'||!Number.isFinite(Date.parse(job.publishedAt))||Date.parse(job.publishedAt)>now)return null;
 const host={facebook:'facebook.com',instagram:'instagram.com',tiktok:'tiktok.com'}[job.channel];let u;try{u=new URL(job.postUrl)}catch{return null}
 if(!host||u.protocol!=='https:'||u.username||u.password||!(u.hostname===host||u.hostname.endsWith('.'+host)))return null;
 return {id:job.id,kind:job.kind,channel:job.channel,postUrl:u.href,publishedAt:job.publishedAt};
}
export async function companySocialSummary(db,villas,config,policy,now){
 const jobs=(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:social:%'").all()).map(r=>JSON.parse(r.value)),result=[];
 for(const villa of villas){
  const selected=await selectedPhase2Grant(db,villa,now),cap=selected?phase2Capabilities(selected.packageId,policy):null;
  result.push({villaId:villa.id,packageId:selected?.packageId||null,fulfillment:'COMPANY_MANAGED',entitlement:cap?{image:cap.socialImage,video:cap.socialVideo}:{image:0,video:0},publications:jobs.filter(j=>j.villaId===villa.id&&j.ownerId===villa.owner_id).map(j=>safePublication(j,now)).filter(Boolean)});
 }
 return result;
}
