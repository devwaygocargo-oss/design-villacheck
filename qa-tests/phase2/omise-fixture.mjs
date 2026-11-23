import {randomUUID} from 'node:crypto';
import {fixture,approvedTestBilling} from './fixture.mjs';
import {OmiseTestGateway} from '../../server/omise.mjs';
export async function paymentFixture(){
 const state={charges:new Map(),events:new Map(),creates:0,unknown:false,sourceAmount:99000};
 const gateway=new OmiseTestGateway({secretKey:'skey_test_SYNTHETICNOTAREALKEY',fetchImpl:async(input,options)=>{
  const path=new URL(input).pathname;let value;
  if(path.startsWith('/sources/'))value={id:path.split('/').at(-1),livemode:false,type:'promptpay',amount:state.sourceAmount,currency:'THB'};
  else if(path==='/charges'&&options.method==='POST'){
   state.creates++;if(state.unknown)throw Error('MOCK_NETWORK_UNCERTAINTY');const form=new URLSearchParams(options.body),id='chrg_test_'+randomUUID().replaceAll('-','');
   value={id,livemode:false,amount:Number(form.get('amount')),currency:'THB',metadata:{invoiceId:form.get('metadata[invoiceId]')},status:'pending',paid:false,transaction:null};state.charges.set(id,value);if(state.onCreate)await state.onCreate();if(state.unknownAfterCreate)throw Error('MOCK_LOST_CREATE_RESPONSE');
  }else if(path.startsWith('/charges/'))value=state.charges.get(path.split('/').at(-1));
  else if(path.startsWith('/events/'))value=state.events.get(path.split('/').at(-1));
  if(!value)return new Response('{}',{status:404});return Response.json(value);
 }});
 const f=await fixture({phase2PaymentProvider:'OMISE_TEST',phase2OmiseGateway:gateway,phase2OmiseTestPublicKey:'pkey_test_SYNTHETICNOTAREALKEY'});await f.setPolicy(approvedTestBilling);
 const order=(await f.buy(f.villas[0],'basic')).order;
 const checkout=()=>f.request('/phase2/payment',{action:'checkout',orderId:order.id,source:'src_test_synthetic'},f.sessions.merchant);
 const event=status=>{const charge=[...state.charges.values()][0];charge.status=status;if(status==='successful'){charge.paid=true;charge.transaction='trxn_test_'+charge.id.slice(10);}const id='evnt_test_'+randomUUID().replaceAll('-','');state.events.set(id,{id,livemode:false,key:'charge.complete',data:{id:charge.id}});return {id,forgedAmount:1};};
 return {...f,state,order,checkout,event};
}
