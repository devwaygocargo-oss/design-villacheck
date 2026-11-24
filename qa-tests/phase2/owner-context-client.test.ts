import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccount,api,ApiError} from '../../src/api';
// Synthetic HTTP boundary only; never reads browser sessions or external services.
test('Owner routes use Admin account and explicit bind; errors never become successful bindings',async()=>{
 const originalFetch=globalThis.fetch;
 const originalWindow=globalThis.window;
 const originalDocument=globalThis.document;
 globalThis.document={documentElement:{lang:"th"}} as unknown as Document;
 const calls:{path:string;portal:string|null;method:string}[]=[];
 let status=200;
 globalThis.window={location:{pathname:'/owner',search:'',hash:''}} as unknown as Window & typeof globalThis;
 globalThis.fetch=async(input,options)=>{
  calls.push({path:String(input),portal:new Headers(options?.headers).get('X-VillaCheck-Portal'),method:options?.method||'GET'});
  return new Response(JSON.stringify(status===200?{user:{id:'synthetic',role:'admin'},csrf:'synthetic-local-only',bound:true}:{error:status===401?'กรุณาเข้าสู่ระบบ':'Forbidden'}),{status,headers:{'content-type':'application/json'}});
 };
 try{
  for(const path of ['/owner','/owner/login','/admin']){
   window.location.pathname=path;
   await currentAccount();
   assert.equal(calls.at(-1)?.path,'/api/auth/admin-me');
   assert.equal(calls.at(-1)?.portal,'admin');
  }
  window.location.pathname='/owner';window.location.search='?context=admin';
  await currentAccount();await api('/phase2/owner-session',{});
  assert.deepEqual(calls.at(-1),{path:'/api/phase2/owner-session',portal:'admin',method:'POST'});
  for(status of [401,403]){
   await assert.rejects(currentAccount(),e=>e instanceof ApiError&&e.status===status);
   await assert.rejects(api('/phase2/owner-session',{}),e=>e instanceof ApiError&&e.status===status);
  }
  status=200;window.location.pathname='/dashboard';window.location.search='';await currentAccount();
  assert.equal(calls.at(-1)?.path,'/api/auth/me');assert.equal(calls.at(-1)?.portal,'user');
 }finally{globalThis.fetch=originalFetch;globalThis.window=originalWindow;globalThis.document=originalDocument;}
});
