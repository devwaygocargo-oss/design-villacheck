// Isolated same-ID enrollment, using the exact deployed capability API.
import {merchantFixture as scopedFixture} from './continuation-local-fixture.mjs';
import {releaseImport} from '../server/release-test-source.mjs';
export async function merchantFixture(){
 const f=await scopedFixture({unifiedAuthEnabled:true,otpLoginEnabled:true});
 const {registerBasicUser}=await releaseImport('server/basic-user-registration.mjs');
 const user=await registerBasicUser(f.db,{name:'Synthetic public merchant',email:'public-merchant@synthetic.invalid',password:'LocalPassword123'});
 const login=await f.login(user);await f.expect('/user/merchant-registration',{businessName:'SYNTHETIC business',businessNameEn:'SYNTHETIC business',contactName:'Synthetic contact',phone:'0800000000',address:'Synthetic address',bankName:'SYNTHETIC BANK',accountName:'SYNTHETIC HOLDER',accountNumber:'0000000000',consent:true},login);
 f.merchant={...user,role:'merchant',primaryRole:'user'};
 const original=f.login;f.login=async actor=>{const s=await original(actor);return {...s,portal:actor.role==='merchant'?'merchant':actor.role}};
 return f;
}
