// Inspect bytes before any upload request; the server validates independently.
export async function validatePropertyFile(file:File,maxBytes:number,allowedTypes:readonly string[]=['image/jpeg','image/png','video/mp4']){
 if(!allowedTypes.includes(file.type))throw Error('รองรับ JPG, PNG หรือ MP4 เท่านั้น');
 if(!file.size||file.size>maxBytes)throw Error('ไฟล์ว่างหรือมีขนาดเกินกำหนด');
 const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer());
 const matches=file.type==='image/jpeg'?bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/png'?[137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte):bytes.length>=12&&String.fromCharCode(...bytes.slice(4,8))==='ftyp';
 if(!matches)throw Error('ชนิดไฟล์จริงไม่ตรงกับ JPG, PNG หรือ MP4 ที่เลือก');
}
