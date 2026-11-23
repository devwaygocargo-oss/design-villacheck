// Compatibility for unchanged built-in carousel samples. Authored English,
// including explicitly empty fields, always takes precedence.
const provinces={"ชลบุรี":"Chon Buri","นครราชสีมา":"Nakhon Ratchasima","ภูเก็ต":"Phuket","เชียงใหม่":"Chiang Mai","กระบี่":"Krabi","ระยอง":"Rayong","พังงา":"Phang Nga","กรุงเทพมหานคร":"Bangkok","ประจวบคีรีขันธ์":"Prachuap Khiri Khan"};
const samples=[
 ["เปลี่ยนเช้าวุ่น ๆ เป็นเช้าที่ได้พัก","พักสายตากับบรรยากาศสีเขียว แล้วใช้วันพักผ่อนให้ช้าลงอีกนิด","Trade a busy morning for a restful one","Rest your eyes on green surroundings and enjoy a slower day off"],
 ["ทริปครั้งนี้ ขอมีแค่คนรู้ใจ","ค้นหาไอเดียวันพักผ่อน ท่ามกลางวิวธรรมชาติและบรรยากาศส่วนตัว","A getaway for you and someone special","Find inspiration for a private break surrounded by nature"],
 ["ปิดแจ้งเตือน แล้วเปิดโหมดพักผ่อน","ชวนแก๊งคนโปรดมาเปลี่ยนบรรยากาศ กับทริปพักผ่อนที่เลือกได้เอง","Turn off notifications and switch on relaxation","Bring your favourite people for a change of scenery on a trip of your own choosing"],
 ["เก็บภาพวันดี ๆ ในมุมพักผ่อนที่ชอบ","เก็บภาพสวยและช่วงเวลาที่อยากจำ ในวันพักผ่อนที่ไม่ต้องเร่งรีบ","Capture good times in your favourite getaway","Capture beautiful moments worth remembering on an unhurried day off"],
 ["วันหยุดมีไม่บ่อย ใช้ให้เต็มที่กับคนโปรด","เติมไอเดียให้ทริปครั้งใหม่ แล้วเลือกมุมพักผ่อนที่ใช่สำหรับคุณ","Make the most of your days off with your favourite people","Find inspiration for your next trip and choose a getaway that suits you"],
];
export function homeAdEnglish(ad){
 if(ad.en!==undefined)return ad.en;
 if(ad.demo!==true||ad.placement!=="home"||ad.label!=="ดูที่พัก"||!ad.villaName)return undefined;
 const ending=" — "+ad.villaName+" · ข้อมูลโฆษณา ไม่เปิดรับจองจริง";
 if(!ad.description?.endsWith(ending))return undefined;
 const description=ad.description.slice(0,-ending.length);
 let titleEn,descriptionEn;
 const prefix="พักผ่อนกับพูลวิลล่าส่วนตัว ที่";
 const province=ad.title?.startsWith(prefix)?ad.title.slice(prefix.length):"";
 if(Object.hasOwn(provinces,province)&&description===province+" · สระว่ายน้ำส่วนตัว พร้อมพื้นที่พักผ่อนสำหรับทริปกับคนที่คุณรัก"){
  titleEn="Unwind in a private pool villa in "+provinces[province];
  descriptionEn=provinces[province]+" · A private pool and space to relax with the people you love";
 }else{
  const sample=samples.find(([title,copy])=>ad.title===title&&description===copy);
  if(!sample)return undefined;
  titleEn=sample[2];descriptionEn=sample[3];
 }
 return {title:titleEn,description:descriptionEn+" — "+ad.villaName+" · Advertisement. Demo only; bookings are not available.",label:"View property"};
}
