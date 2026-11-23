import {randomUUID} from 'node:crypto';
import {preparedPropertyFile,attachPropertyFile,validatePropertyBytes} from './property-upload.mjs';
export async function saveVillaPhoto(db,owner,file){
 if(file?.uploadId){const prepared=await preparedPropertyFile(db,owner,file.uploadId);if(!prepared.type.startsWith('image/'))throw Object.assign(Error('รูปหน้าปกต้องเป็นรูปภาพ'),{status:400});await attachPropertyFile(db,owner,prepared,'villa-photo');return '/api/public/villa-photo/'+prepared.id;}
 const fail=()=>{throw Object.assign(Error('รูปต้องเป็น JPG หรือ PNG ขนาดไม่เกิน 5 MB'),{status:400})};
 if(!file||!['image/jpeg','image/png'].includes(file.type)||typeof file.data!=='string')fail();const prefix='data:'+file.type+';base64,';if(!file.data.startsWith(prefix))fail();const encoded=file.data.slice(prefix.length);if(encoded.length%4!==0||encoded.length>Math.ceil(5*1024*1024/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))fail();const bytes=Buffer.from(encoded,'base64');validatePropertyBytes(file.type,bytes);const id=randomUUID();await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)').run(id,owner,'villa-photo',file.type,bytes);return '/api/public/villa-photo/'+id;
}
