import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {merchantFixture} from '../scripts/fresh-demo-local-fixture.mjs';import {merchantDemoPdf} from './merchant-test-fixture.mjs';
test('Create retry and concurrent duplicate reuse one Villa; mismatched request payload fails without mutation',{skip:!process.env.VILLACHECK_QA_SOURCE_MANIFEST},async t=>{
 const f=await merchantFixture();t.after(()=>f.close());const m=await f.login(f.merchant),data={name:'DEMO QA replay',nameEn:'DEMO QA Replay',province:'ภูเก็ต',merchant:'DEMO QA',email:f.merchant.email,document:{name:'DEMO.pdf',data:'data:application/pdf;base64,'+merchantDemoPdf().toString('base64')},requestKey:randomUUID()};
 const before={};for(const table of ['villas','documents','audits','system_settings'])before[table]=Number((await f.db.prepare('SELECT count(*) AS n FROM '+table).get()).n);
 const bad={...data,requestKey:randomUUID(),photo:{type:'image/jpeg',data:'data:image/jpeg;base64,bm90LWEtanBlZw=='}};
 await f.expect('/villas',bad,m,400);for(const table of Object.keys(before))assert.equal(Number((await f.db.prepare('SELECT count(*) AS n FROM '+table).get()).n),before[table],table+' orphan');
 const legacy=await f.login(f.legacy);await f.expect('/villas',{...data,email:f.legacy.email},legacy,403);
 const first=await f.expect('/villas',data,m,201);for(let i=0;i<3;i++)assert.equal((await f.expect('/villas',data,m,201)).body.createdId,first.body.createdId);
 await f.expect('/villas',{...data,name:'DEMO changed same key'},m,409);
 const two={...data,name:'DEMO second',requestKey:randomUUID()},results=await Promise.all([f.expect('/villas',two,m,201),f.expect('/villas',two,m,201)]);assert.equal(results[0].body.createdId,results[1].body.createdId);
 assert.equal(Number((await f.db.prepare('SELECT count(*) AS n FROM villas WHERE owner_id=?').get(f.merchant.id)).n),2);
 const three={...data,name:'DEMO third',requestKey:randomUUID()};await f.expect('/villas',three,m,201);assert.equal((await f.expect('/villas',three,m,201)).body.createdId,f.merchant.villaIds[2]);
 for(let i=3;i<f.merchant.villaIds.length;i++){const extra={...data,name:'DEMO allocated '+i,requestKey:randomUUID()};const result=await f.expect('/villas',extra,m,201);assert.equal(result.body.createdId,f.merchant.villaIds[i]);assert.equal((await f.expect('/villas',extra,m,201)).body.createdId,result.body.createdId);}
 assert.equal(Number((await f.db.prepare('SELECT count(*) AS n FROM villas WHERE owner_id=?').get(f.merchant.id)).n),f.merchant.villaIds.length);
 const extra={...data,requestKey:randomUUID(),name:'DEMO beyond original slots'};await f.expect('/villas',extra,m,409);assert.equal(Number((await f.db.prepare('SELECT count(*) AS n FROM villas WHERE owner_id=?').get(f.merchant.id)).n),f.merchant.villaIds.length); // Fixed historical QA allocations remain bounded; self-enrolled unlimited creation is covered separately.
 await f.expect('/villas',{...data,requestKey:'invalid'},m,400);
});
