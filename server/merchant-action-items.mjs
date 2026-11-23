import {selectByIds} from './villa-read-context.mjs';

// Read current requests, never historical file payloads or another owner's data.
export async function merchantActionItems(db,user){
 if(!user||user.role!=='merchant')throw Object.assign(Error('เฉพาะผู้ประกอบการ'),{status:403});
 const villas=await db.prepare('SELECT id,name,name_en,status,reason,created FROM villas WHERE owner_id=? ORDER BY created DESC,id').all(user.id);
 const keys=['merchant_registration_application:'+user.id,...villas.flatMap(v=>['ownership_documents:'+v.id,'owner_verification:'+v.id])];
 const rows=await selectByIds(db,'SELECT key,value FROM system_settings WHERE key',keys);
 const settings=new Map(rows.map(r=>[r.key,JSON.parse(r.value)])),items=[];
 const add=(kind,state,v,reason='',documentName='',updatedAt=null,id='')=>items.push({id:kind+':'+(id||v?.id||user.id),kind,state,villaId:v?.id||null,villaName:v?.name||'',villaNameEn:v?.name_en||'',documentName,reason:typeof reason==='string'?reason:'',updatedAt});
 const application=settings.get('merchant_registration_application:'+user.id);
 if(application&&['changes','rejected','pending'].includes(application.status))add('registration_'+application.status,application.status==='pending'?'waiting':'action',null,application.status==='pending'?'':application.reason,'',application.reviewedAt||application.submittedAt||null);
 for(const v of villas){
  const documents=settings.get('ownership_documents:'+v.id),verification=settings.get('owner_verification:'+v.id),start=items.length;
  for(const doc of documents?.documents||[]){
   if(doc.removedAt||doc.supersededAt||!['changes','rejected'].includes(doc.status))continue;
   add('document_'+doc.status,'action',v,doc.remark,doc.name,doc.reviewedAt||null,doc.id);
  }
  if(verification&&['changes','rejected'].includes(verification.status))add('owner_'+verification.status,'action',v,verification.reason,'',verification.reviewedAt||null);
  if(['changes','rejected'].includes(v.status))add('property_'+v.status,'action',v,v.reason);
  if(v.status==='pending'&&items.length===start)add('property_pending','waiting',v);
  if(verification?.status==='pending')add('owner_pending','waiting',v,'','',verification.submittedAt||null);
 }
 items.sort((a,b)=>Number(a.state==='waiting')-Number(b.state==='waiting')||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||a.id.localeCompare(b.id));
 return {items,counts:{action:items.filter(i=>i.state==='action').length,waiting:items.filter(i=>i.state==='waiting').length}};
}
