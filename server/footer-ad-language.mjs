// Translate only the unchanged built-in demo copy. Never rewrite CMS-authored
// advertisements or replace an explicit English object (including empty fields).
const suffix=" · โฆษณา ไม่เปิดรับจองจริง";
const samples=[
 ["วันพักผ่อนของคุณ เริ่มที่ประจวบคีรีขันธ์","Hua Hin Footer Ad Demo Villa"+suffix,"Your next break starts in Prachuap Khiri Khan","Hua Hin Footer Ad Demo Villa · Advertisement. Demo only; bookings are not available."],
 ["พักกลางสีเขียว เติมพลังให้วันหยุด","ชวนคนโปรดมาเปลี่ยนบรรยากาศ กับไอเดียทริปพักผ่อนที่เขาใหญ่"+suffix,"Recharge with a green getaway","Bring someone special for a change of scenery in Khao Yai · Advertisement. Demo only; bookings are not available."],
 ["ปิดโหมดงาน เปิดวันพักที่ระยอง","เก็บกระเป๋าแล้วออกไปหามุมพักผ่อน สำหรับทริปครั้งใหม่ของคุณ"+suffix,"Switch off work and unwind in Rayong","Pack your bags and find a relaxing spot for your next trip · Advertisement. Demo only; bookings are not available."],
 ["ให้วันพักผ่อน มีภาพจำใหม่ที่พังงา","เติมไอเดียเที่ยวธรรมชาติ แล้วเลือกที่พักที่เข้ากับวันหยุดของคุณ"+suffix,"Make new holiday memories in Phang Nga","Explore nature and find a stay that suits your holiday · Advertisement. Demo only; bookings are not available."],
];
export function footerAdEnglish(ad){
 if(ad.en!==undefined)return ad.en;
 if(ad.demo!==true||ad.placement!=="footer"||ad.label!=="ดูที่พัก")return undefined;
 const sample=samples.find(([title,description])=>ad.title===title&&ad.description===description);
 return sample?{title:sample[2],description:sample[3],label:"View property"}:undefined;
}
