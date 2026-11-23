import {api,ApiError} from './api';
import {qrReference} from './qrReference';
// One opaque event id per scan/open. Retries reuse it; no visitor identity is stored.
export function trackQrScan(reference:string){
 const qr=qrReference(reference);if(!qr)return;
 const eventId=crypto.randomUUID();
 const send=()=>api('/public/events',{qr,kind:'QR_SCAN',eventId});
 void send().catch(error=>{if(error instanceof ApiError&&error.status<500)return;window.setTimeout(()=>{void send().catch(()=>{})},1500)});
}
