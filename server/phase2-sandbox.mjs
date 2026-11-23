import {randomUUID,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
// Local test adapter only. No network calls, payment tokens, or real charges.
export class LocalPhase2Sandbox {
 #key=randomBytes(32);
 create(order,status,eventId=randomUUID()){
  const event={eventId,orderId:order.id,providerReference:order.providerReference,amount:order.totalSatang,currency:'THB',status,environment:'SANDBOX'};
  return {event,signature:createHmac('sha256',this.#key).update(JSON.stringify(event)).digest('hex')};
 }
 verify({event,signature}){
  const expected=createHmac('sha256',this.#key).update(JSON.stringify(event)).digest();
  if(typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(expected,Buffer.from(signature,'hex'))||event.environment!=='SANDBOX')throw Object.assign(Error('Invalid Sandbox event'),{status:400});
  return event;
 }
}
