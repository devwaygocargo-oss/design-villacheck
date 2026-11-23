import {validatePropertyFile} from './propertyFileValidation';
import {api,currentAccount} from './api';
export type PreparedPropertyFile={uploadId:string;name:string;type:string;size:number};
export const propertyFileMax=(type:string)=>type==='video/mp4'?25*1024*1024:5*1024*1024;
export async function uploadPropertyFile(file:File,onProgress?:(percent:number)=>void):Promise<PreparedPropertyFile>{
 if(!['image/jpeg','image/png','video/mp4'].includes(file.type))throw Error('รองรับ JPG, PNG หรือ MP4 เท่านั้น');
 if(!file.size||file.size>propertyFileMax(file.type))throw Error(file.type==='video/mp4'?'วิดีโอต้องไม่เกิน 25 MB':'รูปภาพต้องไม่เกิน 5 MB');
 await validatePropertyFile(file,propertyFileMax(file.type));
 await currentAccount();const endpoint=typeof window!=='undefined'&&/^\/admin(?:\/|$)/.test(window.location.pathname)?'/admin/media-upload':'/merchant/media-upload',started=await api<{uploadId:string;chunkBytes:number}>(endpoint,{action:'start',name:file.name,type:file.type,size:file.size});
 const retry=async<T>(data:unknown)=>{try{return await api<T>(endpoint,data)}catch(error){if(error instanceof Error&&'status'in error&&Number(error.status)<500)throw error;return api<T>(endpoint,data)}};
 try{for(let offset=0,index=0;offset<file.size;offset+=started.chunkBytes,index++){const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('อ่านไฟล์ไม่สำเร็จ'));reader.readAsDataURL(file.slice(offset,offset+started.chunkBytes))});await retry({action:'part',uploadId:started.uploadId,index,base64});onProgress?.(Math.round(Math.min(file.size,offset+started.chunkBytes)/file.size*100))}return await retry<PreparedPropertyFile>({action:'finish',uploadId:started.uploadId})}catch(error){await api(endpoint,{action:'cancel',uploadId:started.uploadId}).catch(()=>{});throw error}
}
export function cancelPropertyUpload(uploadId:string){return api(typeof window!=='undefined'&&/^\/admin(?:\/|$)/.test(window.location.pathname)?'/admin/media-upload':'/merchant/media-upload',{action:'cancel',uploadId}).catch(()=>{});}
