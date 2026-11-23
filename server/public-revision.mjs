import {paidQrVisibility} from './phase2-paid-qr-visibility.mjs';
import {phase2VillaAccess} from './phase2-access.mjs';
import {archivedVilla} from './villa-archive.mjs';
import {publicCover} from './cover-review.mjs';
import {demoVillaVisibilityKey,demoVillasVisibleValue,isDemoVilla,isAllocatedTestListing,isProductionCleanupTestListing} from "./demo-villa-visibility.mjs"
// Approved public state is independent of the mutable draft. Never return private snapshots directly.
export async function publicRevision(db,current,context,options){
 if(!current)return null
 if(!(await paidQrVisibility(db,current,options?.phase2Config)).visible)return null
 if(isProductionCleanupTestListing(current))return {...current,status:"pending"}
 if(context?context.archived?.has(current.id):await archivedVilla(db,current.id))return {...current,status:"archived"}
 if(!["approved","pending","changes","rejected"].includes(current.status))return current
 const reversed=context?context.holds.has(current.id):await db.prepare("SELECT id FROM invoices WHERE villa_id=? AND status='paid' AND payment_status='FAILED' LIMIT 1").get(current.id)
 if(reversed)return {...current,status:"pending"}
 if(current.status==="approved"){
  if(options?.phase2Config?.phase2Enabled&&await phase2VillaAccess(db,current,options.phase2Config)){const row=context?.snapshots?.get(current.id)||JSON.parse((await db.prepare('SELECT value FROM system_settings WHERE key=?').get('villa_approved:'+current.id))?.value||'null');if(row?.villa?.id===current.id&&row.villa.owner_id===current.owner_id&&row.villa.status==='approved'&&Array.isArray(row.media))return {...row.villa,qr:current.qr,expires:current.expires,_approvedSnapshot:row,photo_url:publicCover(row.villa)};return {...current,status:'pending',photo_url:''};}
  return {...current,photo_url:publicCover(current)};
 }
 // Latest owner policy: an unapproved draft has no publicly approved projection.
 // Preserve snapshots for history/review, never substitute one to bypass current status.
 return current
}
export async function resolvePublicQr(db,qr,options={}){
 const {includeInactive=false}=options;
 let current=await db.prepare("SELECT * FROM villas WHERE qr=?").get(qr)
 if(!current){const alias=await db.prepare("SELECT value FROM system_settings WHERE key=?").get("qr_alias:"+qr);if(alias)current=await db.prepare("SELECT * FROM villas WHERE id=?").get(JSON.parse(alias.value).villaId)}
 if(!current&&/^VC-[a-zA-Z0-9-]{1,100}$/.test(qr)){
  const history=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'villa_approved_history:%' AND value LIKE ?").all('%"qr":"'+qr+'"%')
  const snapshot=history.map(r=>JSON.parse(r.value)).find(s=>s.villa.qr===qr)
  if(snapshot)current=await db.prepare("SELECT * FROM villas WHERE id=?").get(snapshot.villa.id)
 }
 const published=await publicRevision(db,current,undefined,options)
 return published?.status==="approved"?published:includeInactive&&published?.qr&&!isProductionCleanupTestListing(published)&&["pending","changes","rejected"].includes(published.status)?published:null
}
export async function publishedVillas(db,options){
 const [current,rows,blocked]=await Promise.all([db.prepare("SELECT * FROM villas WHERE qr IS NOT NULL ORDER BY created DESC,id DESC").all(),db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'villa_approved:%' OR key='public_demo_villas_visible' OR key LIKE 'villa_archive:%'").all(),db.prepare("SELECT DISTINCT villa_id FROM invoices WHERE status='paid' AND payment_status='FAILED'").all()])
 const visible=demoVillasVisibleValue(rows.find(row=>row.key===demoVillaVisibilityKey))
 const context={archived:new Set(rows.filter(r=>r.key.startsWith('villa_archive:')&&JSON.parse(r.value).state==='ARCHIVED').map(r=>r.key.slice('villa_archive:'.length))),snapshots:new Map(rows.filter(row=>row.key.startsWith('villa_approved:')).map(r=>[r.key.slice('villa_approved:'.length),JSON.parse(r.value)])),holds:new Set(blocked.map(r=>r.villa_id))}
 return (await Promise.all(current.map(v=>publicRevision(db,v,context,options)))).filter(v=>v?.status==="approved" && (visible || !isDemoVilla(v)) && !isAllocatedTestListing(v))
}
export async function rememberQr(db,villa){
 if(!villa?.qr)return
 await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("qr_alias:"+villa.qr,JSON.stringify({villaId:villa.id}))
}
