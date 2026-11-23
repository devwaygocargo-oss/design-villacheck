import {api} from "./api"
import {reviewMediaLimits,reviewMediaTypes} from "../server/review-media-limits.mjs"
import type {ReviewAttachment} from "./ReviewMediaGallery"
export function validateReviewFiles(files:File[]){
 if(files.filter(f=>f.type.startsWith("image/")).length>reviewMediaLimits.images||files.filter(f=>f.type.startsWith("video/")).length>reviewMediaLimits.videos)throw Error("แนบรูปได้ไม่เกิน 10 รูป และวิดีโอไม่เกิน 2 ไฟล์ต่อรีวิว")
 for(const file of files){if(!reviewMediaTypes.includes(file.type))throw Error("ใช้รูป JPG/PNG หรือวิดีโอ MP4/MOV/WebM");if(file.size<12||file.size>(file.type.startsWith("image/")?reviewMediaLimits.imageBytes:reviewMediaLimits.videoBytes))throw Error(file.type.startsWith("image/")?"รูปต้องไม่เกิน 5 MB":"วิดีโอต้องไม่เกิน 50 MB")}
}
export async function uploadReviewMedia(file:File,qr:string,onProgress:(bytes:number)=>void):Promise<ReviewAttachment>{
 validateReviewFiles([file])
 const path="/reviews/media",{uploadId:id,chunkBytes}=await api<{uploadId:string;chunkBytes:number}>(path,{action:"start",qr,name:file.name,mime:file.type,size:file.size})
 try{
  for(let offset=0,index=0;offset<file.size;offset+=chunkBytes,index++){
   const blob=file.slice(offset,offset+chunkBytes),base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("อ่านไฟล์ไม่สำเร็จ"));reader.readAsDataURL(blob)})
   await api(path,{action:"part",id,index,base64});onProgress(offset+blob.size)
  }
  return(await api<{media:ReviewAttachment}>(path,{action:"finish",id})).media
 }catch(error){await api(path,{action:"cancel",id}).catch(()=>{});throw error}
}
export const removeReviewMedia=(id:string)=>api("/reviews/media",{action:"remove",id})
