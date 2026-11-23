import {createHash} from 'node:crypto';
const cache=new Map(),pending=new Map(),maxBytes=20*1024*1024,maxEntries=32;
let cacheBytes=0;
// Called only after the CMS handler checks publication or the authenticated
// viewer. Keeping variants private prevents a cache from bypassing withdrawal.
export async function cmsImageVariant(input,width){
 const key=createHash('sha256').update(input).digest('hex')+':'+width;
 const hit=cache.get(key);if(hit){cache.delete(key);cache.set(key,hit);return hit;}
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  const {default:sharp}=await import('sharp');
  const output=await sharp(input,{limitInputPixels:40_000_000}).rotate().resize({width,withoutEnlargement:true}).webp({quality:80,effort:3}).toBuffer();
  if(output.length<=maxBytes){while(cache.size>=maxEntries||cacheBytes+output.length>maxBytes){const oldest=cache.keys().next().value;const entry=cache.get(oldest);cache.delete(oldest);cacheBytes-=entry.length;}cache.set(key,output);cacheBytes+=output.length;}
  return output;
 })();pending.set(key,task);
 try{return await task;}finally{pending.delete(key);}
}
