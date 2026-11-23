import {assertPhase2OrderTerms} from './phase2-finance.mjs';
import {createHash} from 'node:crypto';
import {OmiseTestGateway,chargePresentation} from './omise.mjs';
import {LocalPhase2Sandbox} from './phase2-sandbox.mjs';
import {settlePhase2Sandbox} from './phase2.mjs';
import {requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
import {assertWriteSession} from './write-session.mjs';
const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});};
const read=async(db,key)=>{const r=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('phase2:v1:'+key);return r?JSON.parse(r.value):null;};
const put=(db,key,value)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('phase2:v1:'+key,JSON.stringify(value));
const eventUuid=value=>{const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
export class OmisePhase2Proof extends LocalPhase2Sandbox {provider='OMISE_TEST';}

// Reuses the existing test-key-only Omise HTTP adapter. Never writes legacy invoices.
export function createPhase2Omise(db,config,gateway=new OmiseTestGateway({secretKey:config.phase2OmiseTestSecretKey})){
 const ready=()=>{if(config.phase2GameResponses===true)fail(503,'Game response Finance and provider acceptance pending');requirePhase2(config);requirePhase2Database(db,config);if(!config.phase2SandboxEnabled||config.phase2SandboxGateway?.provider!=='OMISE_TEST')fail(503,'Omise Sandbox unavailable');};
 const now=()=>new Date(config.phase2Clock?config.phase2Clock():Date.now()).toISOString();
 const retrieveCharge=async id=>{const charge=await gateway.retrieveCharge(id);if(charge?.id!==id)fail(502,'Omise returned an unexpected charge');return charge;};
 async function reconcile(charge,eventId){
  ready();if(!charge||charge.livemode!==false||!/^chrg_test_[a-z0-9]+$/.test(charge.id||''))fail(400,'Invalid Omise test charge');
  const id=charge.metadata?.invoiceId,order=await read(db,'order:'+id),attempt=await read(db,'omise:'+id);
  if(!order||order.provider!=='OMISE_TEST'||!attempt||attempt.chargeId&&attempt.chargeId!==charge.id||!attempt.chargeId&&!['CREATING','RECONCILIATION_REQUIRED'].includes(attempt.status)||charge.amount!==order.totalSatang||String(charge.currency).toUpperCase()!=='THB')fail(409,'Omise order/amount binding rejected');
  const statuses={pending:'pending',successful:'succeeded',failed:'failed',expired:'cancelled'};const status=statuses[charge.status];if(!status||charge.reversed===true||charge.refunded_amount>0)fail(409,'Unsupported payment outcome; manual reconciliation required');
  if(status==='succeeded'&&(charge.paid!==true||!/^trxn_test_[a-z0-9]+$/.test(charge.transaction||'')))fail(409,'Omise payment is not captured');
  const presentation=chargePresentation(charge);
  const envelope=config.phase2SandboxGateway.create(order,status,eventUuid((eventId||'poll')+':'+charge.id+':'+status));
  return db.transaction(async()=>{
   const current=await read(db,'omise:'+order.id);if(current?.chargeId&&current.chargeId!==charge.id)fail(409,'Another charge is already bound');
   if(status==='succeeded'){
    const old=await read(db,'transaction:'+charge.transaction);if(old&&old.orderId!==order.id)fail(409,'Omise transaction already consumed');
    await put(db,'transaction:'+charge.transaction,{orderId:order.id,chargeId:charge.id});
   }
   const result=await settlePhase2Sandbox(db,null,config,envelope,now());
   await put(db,'omise:'+order.id,{...current,chargeId:charge.id,status:result.order.status,...presentation,updatedAt:now()});return {...result,checkout:{provider:'OMISE_TEST',chargeId:charge.id,...presentation}};
  });
 }
 return {
  async cancel(actor,id){
   ready();return db.transaction(async()=>{
    await assertWriteSession(db,actor);const order=await read(db,'order:'+id);if(!order||order.userId!==actor.id)fail(404,'Order missing');
    if(order.provider!=='OMISE_TEST'||order.status!=='pending'||await read(db,'omise:'+id))fail(409,'A charge attempt exists; await verified provider outcome');
    order.status='cancelled';order.updatedAt=now();await put(db,'order:'+id,order);await put(db,'provider-audit:'+eventUuid(id+':cancel'),{provider:'OMISE_TEST',orderId:id,status:'MERCHANT_CANCELLED_BEFORE_CHARGE',actorId:actor.id,at:now()});
    return {order,checkout:{provider:'OMISE_TEST',qrImage:null,authorizeUri:null},providerCancellation:false};
   });
  },
  async checkout(actor,id,source){
   ready();if(typeof source!=='string'||!/^src_test_[a-z0-9]+$/.test(source))fail(400,'Omise test source required');
   const order=await read(db,'order:'+id);if(!order||order.userId!==actor.id)fail(404,'Order missing');
   if(order.provider!=='OMISE_TEST'||order.status!=='pending')fail(409,'Order is not awaiting Omise payment');assertPhase2OrderTerms(order);
   const reserved=await db.transaction(async()=>{await assertWriteSession(db,actor);const currentOrder=await read(db,'order:'+id);if(currentOrder?.status!=='pending'||currentOrder.userId!==actor.id)fail(409,'Order is no longer pending');const v=await db.prepare('SELECT owner_id FROM villas WHERE id=?').get(order.villaId);if(v?.owner_id!==actor.id)fail(409,'Ownership changed');const prior=await read(db,'omise:'+id);if(prior)return false;await put(db,'omise:'+id,{orderId:id,status:'CREATING',createdAt:now()});return true;});
   if(!reserved){const prior=await read(db,'omise:'+id);if(!prior.chargeId)fail(409,'Existing creation requires reconciliation; duplicate charge blocked');return this.status(actor,id);}
   try{
    const verified=await gateway.retrieveSource(source);if(verified.id!==source||verified.livemode!==false||verified.type!=='promptpay'||verified.amount!==order.totalSatang||String(verified.currency).toUpperCase()!=='THB')fail(400,'Omise source does not match order');
    const returnUri=new URL('/phase2',config.appUrl);if(returnUri.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(returnUri.hostname))fail(503,'Invalid return URL');
    const charge=await gateway.createCharge({invoiceId:id,amount:order.totalSatang,source,returnUri:returnUri.href});
    if(!/^chrg_test_[a-z0-9]+$/.test(charge?.id||'')||charge.livemode!==false)fail(502,'Invalid Omise test response');
    await db.transaction(async()=>{const current=await read(db,'omise:'+id);if(current?.chargeId&&current.chargeId!==charge.id)fail(409,'Another charge is already bound');await put(db,'omise:'+id,{...current,orderId:id,chargeId:charge.id});});
    // Even the create response cannot grant rights; retrieve the authoritative charge.
    return reconcile(await retrieveCharge(charge.id));
   }catch(e){await db.transaction(async()=>{const old=await read(db,'omise:'+id);if(!old?.chargeId)await put(db,'omise:'+id,{...old,status:'RECONCILIATION_REQUIRED'});});throw e;}
  },
  async status(actor,id){ready();const order=await read(db,'order:'+id);if(!order||actor.role!=='admin'&&order.userId!==actor.id)fail(404,'Order missing');const attempt=await read(db,'omise:'+id);if(!attempt?.chargeId)fail(409,'No charge available; reconcile creation first');return reconcile(await retrieveCharge(attempt.chargeId));},
  async webhook(payload){
   ready();if(!/^evnt_test_[a-z0-9]+$/.test(payload?.id||''))fail(400,'Omise test event required');
   const event=await gateway.retrieveEvent(payload.id);if(event.id!==payload.id||event.livemode!==false||!/^charge\.(create|complete|update|capture|expire)$/.test(event.key||'')||!/^chrg_test_[a-z0-9]+$/.test(event.data?.id||''))fail(400,'Invalid Omise test event');
   return reconcile(await retrieveCharge(event.data.id),event.id);
  }
 };
}
