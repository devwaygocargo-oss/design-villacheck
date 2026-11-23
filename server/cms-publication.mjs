import {createHash} from 'node:crypto';
import {validateCmsImage} from './cms-image-validation.mjs';
const stable=value=>typeof value==='string'&&value.startsWith('/demo/')?'/villa-placeholder.svg':Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
const digest=content=>createHash('sha256').update(JSON.stringify(stable({...content,home:{...content.home,slideIntervalMs:undefined}}))).digest('hex');
export async function recordCmsPublication(db,release,user,urls){
 const approved=[];for(const url of new Set(urls)){const id=url.match(/^\/api\/public\/cms-media\/([a-f0-9-]{36})$/)?.[1];if(!id)continue;const file=await db.prepare("SELECT mime,bytes FROM documents WHERE id=? AND name LIKE 'cms-image:%'").get(id);if(!file)throw Object.assign(Error('CMS image not found'),{status:409});await validateCmsImage(file.mime,Buffer.from(file.bytes));approved.push(url);}
 await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('cms_publication:'+release.revision,JSON.stringify({version:1,revision:release.revision,fingerprint:digest(release.content),media:approved,publishedBy:user.id,publishedAt:new Date().toISOString()}));
}
export async function publishedCmsMedia(db,release){const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('cms_publication:'+release.revision);if(!row)return[];const receipt=JSON.parse(row.value);return receipt.version===1&&receipt.fingerprint===digest(release.content)?receipt.media:[];}
