import fs from 'node:fs';
// Synthetic local recovery proof only. This is not a production cleanup command.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {merchantFixture} from './merchant-test-fixture.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function setup(t){
 const f=await merchantFixture();t.after(f.close);const admin=await f.login(f.admin),owners=[f.legacy,f.other],sessions=await Promise.all(owners.map(f.login)),targets=[],keys=[];
 for(const [index,owner]of owners.entries()){
  const id=randomUUID(),document=randomUUID(),media=randomUUID(),qr='VC-'+randomUUID();
  await f.db.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(document,owner.id,'SYNTHETIC.pdf','application/pdf',Buffer.from('%PDF-1.4 SYNTHETIC ONLY'));
  await f.db.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(media,owner.id,'property-media','video/mp4',Buffer.from('SYNTHETIC RETAINED '+index));
  await f.db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,created) VALUES (?,?,'SYNTHETIC','ภูเก็ต','SYNTHETIC',?,'basic',?,'pending',?,?)").run(id,owner.id,owner.email,document,qr,new Date().toISOString());
  const settings=['villa_approved:'+id,'villa_qr:'+id,'qr_alias:'+qr,'villa_review:'+id,...(index===1?['villa_page:'+id]:[])];
  for(const key of settings){await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run(key,JSON.stringify({synthetic:true,villaId:id}));keys.push(key)}
  await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run('basic_grant:'+id,JSON.stringify({synthetic:true,villaId:id,ownerId:owner.id,retained:true}));
  await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run('property_media:'+id+':'+media,JSON.stringify({id:media,villaId:id,kind:'video',url:'/api/public/property-media-file/'+media}));
  targets.push({id,document,media,owner,session:sessions[index],contextKey:'retained_media_parent:'+id});
 }
 const reviewMedia=randomUUID(),reviewId=randomUUID(),reviewOwner=owners[1],reviewBytes=Buffer.from('SYNTHETIC REVIEW MEDIA');
 await f.db.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(reviewMedia+'-0000',reviewOwner.id,'review-media:'+reviewMedia,'image/png',reviewBytes);
 await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run('review_media:'+reviewMedia,JSON.stringify({id:reviewMedia,ownerId:reviewOwner.id,villaId:targets[0].id,reviewId,mime:'image/png',size:reviewBytes.length,name:'SYNTHETIC.png',kind:'image',expiresAt:null}));
 await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run('customer_review:'+reviewId,JSON.stringify({id:reviewId,userId:reviewOwner.id,villaId:targets[0].id,status:'rejected',media:[{id:reviewMedia}]}));
 const reviewFiles=[{id:reviewMedia,ownerId:reviewOwner.id,reviewId}];
 const state=async()=>Object.fromEntries(await Promise.all(['villas','system_settings','documents','users','sessions','audits'].map(async table=>[table,await f.db.prepare('SELECT * FROM '+table+' ORDER BY '+(table==='system_settings'?'key':table==='sessions'?'token_hash':'id')).all()])));
 const access=async()=>{for(const target of targets){const route='/public/property-media-file/'+target.media;await f.expect(route,undefined,target.session);await f.expect(route,undefined,admin);await f.expect(route,undefined,undefined,404);await f.expect(route,undefined,sessions[targets.indexOf(target)===0?1:0],404)}for(const actor of [admin,...sessions])await f.expect('/public/review-media/'+reviewMedia,undefined,actor);await f.expect('/public/review-media/'+reviewMedia,undefined,undefined,404)};
 const mutate=async failAfter=>f.db.transaction(async()=>{let villas=0,settings=0;for(const target of targets){await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run(target.contextKey,JSON.stringify({version:1,villaId:target.id,ownerId:target.owner.id,documentIds:[target.media],reviewFiles:target.id===targets[0].id?reviewFiles:[],approvalReference:'SYNTHETIC EXACT 2/9 RECOVERY PROOF'}));villas+=(await f.db.prepare('DELETE FROM villas WHERE id=?').run(target.id)).changes;if(failAfter)throw Error('SYNTHETIC_INJECTED_FAILURE')}for(const key of keys)settings+=(await f.db.prepare('DELETE FROM system_settings WHERE key=?').run(key)).changes;assert.equal(villas,2);assert.equal(settings,9)});
 return {f,targets,keys,state,access,mutate};
}
test('revised synthetic 2/9 cleanup rolls back context creation and parent removal on transaction failure',async t=>{
 const f=await setup(t);await f.access();const before=await f.state();await assert.rejects(f.mutate(true),/SYNTHETIC_INJECTED_FAILURE/);assert.equal(digest(await f.state()),digest(before));await f.access();
});
test('revised synthetic 2/9 preserves both owner roles and Admin media access, excluded grants/bytes, and exact preimage restoration',async t=>{
 const {f,targets,keys,state,access,mutate}=await setup(t);await access();const before=await state();const selectedPreimage={villas:before.villas.filter(r=>targets.some(t=>t.id===r.id)),system_settings:before.system_settings.filter(r=>keys.includes(r.key)),retentionContextsPreviouslyAbsent:true};if(process.env.VC_CLEANUP_EVIDENCE_DIR){fs.mkdirSync(process.env.VC_CLEANUP_EVIDENCE_DIR,{recursive:true});fs.writeFileSync(process.env.VC_CLEANUP_EVIDENCE_DIR+'/synthetic-preimage.json',JSON.stringify({syntheticOnly:true,production:false,state:selectedPreimage,sha256:digest(selectedPreimage)},null,2));}await mutate(false);await access();const after=await state();
 for(const table of ['documents','users','sessions','audits'])assert.equal(digest(after[table]),digest(before[table]),table+' unchanged');
 const contexts=targets.map(t=>t.contextKey);assert.equal(digest(after.system_settings.filter(r=>!contexts.includes(r.key))),digest(before.system_settings.filter(r=>!keys.includes(r.key))));
 assert.equal(after.villas.length,before.villas.length-2);
 await f.db.transaction(async()=>{
  for(const target of targets)await f.db.prepare('DELETE FROM system_settings WHERE key=?').run(target.contextKey);
  for(const row of before.villas.filter(row=>targets.some(t=>t.id===row.id))){const columns=Object.keys(row);await f.db.prepare('INSERT INTO villas('+columns.map(c=>'"'+c+'"').join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')').run(...columns.map(c=>row[c]))}
  for(const row of before.system_settings.filter(row=>keys.includes(row.key)))await f.db.prepare('INSERT INTO system_settings VALUES (?,?)').run(row.key,row.value);
 });
 assert.equal(digest(await state()),digest(before));await access();if(process.env.VC_CLEANUP_EVIDENCE_DIR)fs.writeFileSync(process.env.VC_CLEANUP_EVIDENCE_DIR+'/recovery.json',JSON.stringify({syntheticOnly:true,engine:'DISPOSABLE_LOCAL_POSTGRESQL',deletedVillas:2,deletedKeys:9,basicGrantsRetained:2,authorizedOwnerAndAdminAccessBeforeAfterRestore:'PASS',guestAndForeignDenied:'PASS',preimageSha256:digest(selectedPreimage),fullPreflightStateSha256:digest(before),restoredStateSha256:digest(await state()),documentsHistoryAuditPreserved:true,productionMutationAuthorized:false,productionWrites:0},null,2));
});

test('retained ownership documents stay byte-exact and owner/Admin readable after revised cleanup; existing audit rows survive read-audit appends',async t=>{
 const {f,targets,access,mutate,state}=await setup(t),admin=await f.login(f.admin);const docs=async()=>{for(const target of targets){const original=await f.db.prepare('SELECT bytes FROM documents WHERE id=?').get(target.document);if(target.owner.role==='user')await f.expect('/documents/'+target.document,undefined,target.session,403);else assert.deepEqual((await f.expect('/documents/'+target.document,undefined,target.session)).body,Buffer.from(original.bytes));assert.deepEqual((await f.expect('/admin/documents/'+target.document,undefined,admin)).body,Buffer.from(original.bytes));await f.expect('/documents/'+target.document,undefined,undefined,401);const foreign=targets.find(other=>other.id!==target.id);const denied=await f.request('/documents/'+target.document,undefined,foreign.session);assert([403,404].includes(denied.status));}};
 await docs();const before=await state();await mutate(false);await docs();await access();const after=await state();assert.equal(digest(after.documents),digest(before.documents));for(const row of before.audits)assert.deepEqual(after.audits.find(r=>r.id===row.id),row);
 if(process.env.VC_CLEANUP_EVIDENCE_DIR){const path=process.env.VC_CLEANUP_EVIDENCE_DIR+'/recovery.json',record=JSON.parse(fs.readFileSync(path));record.retainedDocumentOwnerAdminAccessBeforeAfter='PASS_AUTHORIZED_MERCHANT_OWNER_AND_ADMIN';record.preexistingUserRoleDocumentDenialPreserved=true;record.existingAuditRowsUnchangedNewReadAuditsRetained=true;fs.writeFileSync(path,JSON.stringify(record,null,2));}
});
