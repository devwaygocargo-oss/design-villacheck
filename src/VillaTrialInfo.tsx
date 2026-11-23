import {useLocale} from './locale';
import type {VillaFreeTrial} from './merchantStore';
export default function VillaTrialInfo({trial}:{trial?:VillaFreeTrial|null}){
 const {locale}=useLocale();if(!trial)return null;const en=locale==='en';
 const date=(value:string|null)=>value?new Date(value).toLocaleString(en?'en-GB':'th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
 return <section className="merchant-panel villa-trial-info" data-trial-state={trial.state}>
  <h3>{en?'90-day free trial · Online Verify':'ทดลองใช้ฟรี 90 วัน · Online Verify'}</h3>
  <p>{en?'฿1,990-tier benefits: Trust QR, photos and video uploads. Trial charge: ฿0.':'สิทธิ์ระดับ 1,990 บาท: Trust QR รูปภาพและอัปโหลดวิดีโอ ค่าใช้จ่ายช่วงทดลอง 0 บาท'}</p>
  {trial.state==='PENDING_APPROVAL'?<p role="status">{en?'The 90 days start after this property and its documents are approved. Time spent waiting or correcting documents is not counted.':'เริ่มนับ 90 วันเมื่อข้อมูลที่พักและเอกสารผ่านอนุมัติครบ ช่วงรอตรวจหรือส่งแก้ไขยังไม่เริ่มนับสิทธิ์'}</p>:<><dl className="subscription-detail-grid"><div><dt>{en?'Starts (Thailand time)':'วันเริ่ม (เวลาไทย)'}</dt><dd>{date(trial.startsAt)}</dd></div><div><dt>{en?'Ends (Thailand time)':'วันหมดอายุ (เวลาไทย)'}</dt><dd>{date(trial.endsAt)}</dd></div></dl><p role="status">{trial.state==='EXPIRED'?(en?'Trial expired. The original QR link continues to show the current status.':'สิทธิ์ทดลองหมดอายุ ลิงก์ QR เดิมยังแสดงสถานะล่าสุดได้'):(en?'Active. Corrections and repeat approval do not restart the trial.':'กำลังใช้งาน การส่งแก้ไขและอนุมัติซ้ำไม่เริ่มนับสิทธิ์ใหม่')}</p></>}
 </section>;
}
