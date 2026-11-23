import {carouselIntervalMs,CAROUSEL_MIN_MS,CAROUSEL_MAX_MS} from './carousel-timing.mjs';
import {audit} from './database.mjs';
const key='cms_carousel_timing';
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
export async function readCarouselTiming(db,fallback){
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);
 if(!row)return {intervalMs:carouselIntervalMs(fallback),version:0};
 const value=JSON.parse(row.value);
 if(!Number.isInteger(value.intervalMs)||value.intervalMs<CAROUSEL_MIN_MS||value.intervalMs>CAROUSEL_MAX_MS||!Number.isSafeInteger(value.version)||value.version<1)fail(503,'Carousel timing configuration invalid');
 return {intervalMs:value.intervalMs,version:value.version};
}
export async function saveCarouselTiming(db,user,data){
 if(user?.role!=='admin')fail(403,'เฉพาะ Admin');
 if(!data||Object.keys(data).some(k=>!['intervalMs','version'].includes(k))||!Number.isInteger(data.intervalMs)||data.intervalMs<CAROUSEL_MIN_MS||data.intervalMs>CAROUSEL_MAX_MS||!Number.isSafeInteger(data.version)||data.version<0)fail(400,'ช่วงเวลาเลื่อนต้องอยู่ระหว่าง 2–60 วินาที');
 return db.transaction(async()=>{
  const current=await readCarouselTiming(db);
  if(current.version!==data.version)fail(409,'Carousel timing changed; reload before saving');
  const next={intervalMs:data.intervalMs,version:current.version+1};
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify({...next,updatedAt:new Date().toISOString(),updatedBy:user.id}));
  await audit(db,user,'CMS_CAROUSEL_TIMING_SET',String(next.version)+':'+String(next.intervalMs));
  return next;
 });
}
