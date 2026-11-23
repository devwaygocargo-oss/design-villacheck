import {latestDecisionsEnabled} from './phase2-latest-decisions.mjs';
import {phase2VillaGrants,selectedPhase2GrantRecord,grantState} from './phase2-grants.mjs';
import {assertPhase2OrderTerms} from './phase2-finance.mjs';
const retained={scoped:false,visible:true,reason:'EXISTING_POLICY_RETAINED'};
// Read-only projection. This never changes QR identity, status, history or grant records.
export async function paidQrVisibility(db,villa,config){
 if(!villa||config?.phase2PaidQrExpiryEnabled!==true)return retained;
 await latestDecisionsEnabled(db,{...config,phase2LatestBusinessDecisions:true});
 const now=config.phase2Clock?.()??Date.now(),grants=await phase2VillaGrants(db,villa),g=await selectedPhase2GrantRecord(db,villa,now);
 // Trial, account-wide and mixed grant histories require separate authorization.
 if(!g||grants.some(x=>x.scope!=='VILLA'||x.source!=='SANDBOX_ORDER')||g.scope!=='VILLA'||g.source!=='SANDBOX_ORDER'||![g.startsAt,g.billingStartsAt,g.endsAt].every(x=>Number.isFinite(Date.parse(x)))||Date.parse(g.startsAt)>Date.parse(g.billingStartsAt)||Date.parse(g.billingStartsAt)>Date.parse(g.endsAt))return retained;
 if(await db.prepare('SELECT owner_id FROM subscriptions WHERE owner_id=?').get(villa.owner_id))return retained;
 const keys=['merchant_free_period:'+villa.owner_id,'villa_free_trial:'+villa.id,'membership_grant:'+villa.id,'membership_grant:'+villa.owner_id,'basic_grant:'+villa.id,'basic_grant:'+villa.owner_id,'phase2:v1:account-trial:'+villa.owner_id,'phase2:v1:trial:'+villa.id];
 for(const key of keys)if(await db.prepare('SELECT key FROM system_settings WHERE key=?').get(key))return retained;
 const selection=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:selection:'+villa.id),orderRow=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:order:'+g.orderId);
 let s,o;try{s=selection&&JSON.parse(selection.value);o=orderRow&&JSON.parse(orderRow.value);assertPhase2OrderTerms(o)}catch{return retained}
 if(s?.userId!==villa.owner_id||s.grantId!==g.id||s.orderId!==g.orderId||o?.status!=='succeeded'||o.environment!==g.environment||o.grantId!==g.id||o.userId!==villa.owner_id||o.villaId!==villa.id||o.packageId!==g.packageId||Date.parse(g.endsAt)-Date.parse(g.billingStartsAt)!==o.billingDays*86400000)return retained;
 const state=grantState(g,now);if(!['ACTIVE','EXPIRED'].includes(state))return retained;
 return {scoped:true,visible:state==='ACTIVE',reason:state==='ACTIVE'?'PAID_ENTITLEMENT_ACTIVE':'PAID_ENTITLEMENT_EXPIRED'};
}
