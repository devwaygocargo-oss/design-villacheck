import {randomUUID,createHash} from 'node:crypto';
import {assertWriteSession} from './write-session.mjs';
import {audit} from './database.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const digest=value=>createHash('sha256').update(value||'').digest('hex');
export async function submitMerchantChange(db,user,targetKey,value){
 await assertWriteSession(db,user);
 const old=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(targetKey);
 const id=randomUUID(),row={id,ownerId:user.id,targetKey,value,previousDigest:digest(old?.value),status:'pending',createdAt:new Date().toISOString()};
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('merchant_change:'+id,JSON.stringify(row));
 await audit(db,user,'merchant.change_requested',id);
 return {pendingApproval:true,requestId:id};
}
export async function merchantChangeApi(db,user,req,path,url,body){
 if(!path.startsWith('/api/admin/merchant-changes'))return undefined;
 if(user?.role!=='admin')fail(403,'Admin required');
 if(path==='/api/admin/merchant-changes'&&req.method==='GET')return {requests:(await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'merchant_change:%'").all()).map(x=>JSON.parse(x.value)).filter(x=>x.status==='pending')};
 const match=path.match(/^\/api\/admin\/merchant-changes\/([a-f0-9-]{36})$/);
 if(!match||req.method!=='POST')fail(405,'Unsupported change review');
 const data=await body(req);if(!['approved','rejected'].includes(data?.status))fail(400,'Invalid decision');
 return db.transaction(async()=>{
  await assertWriteSession(db,user);
  const key='merchant_change:'+match[1];const stored=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);if(!stored)fail(404,'Change not found');
  const row=JSON.parse(stored.value);if(row.ownerId===user.id)fail(403,'Cannot approve own change');if(row.status!=='pending')fail(409,'Change already reviewed');
  const previous=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(row.targetKey);
  if(data.status==='approved'){
   if(digest(previous?.value)!==row.previousDigest)fail(409,'Active profile changed; submit a new request');
   await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(row.targetKey,JSON.stringify(row.value));
  }
  row.status=data.status;row.reviewedBy=user.id;row.reviewedAt=new Date().toISOString();
  await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(row),key);
  await audit(db,user,'merchant.change_'+data.status,row.id);return {ok:true,status:row.status};
 });
}
