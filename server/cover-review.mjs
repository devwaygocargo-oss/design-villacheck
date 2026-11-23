import {stagingDemosEnabled,isDemoVilla} from './demo-villa-visibility.mjs';
import {diverseDemoImages} from './demo-image-catalog.mjs';
const licensed=new Set([...diverseDemoImages.map(x=>x.url),'/demo/villas/villa-1.jpg','/demo/villas/villa-2.jpg','/demo/villas/villa-3.jpg','/demo/villas/villa-4.jpg','/demo/villas/villa-5.jpg','/demo/villas/villa-6.jpg','/demo/villas/villa-7.jpg','/demo/villas/villa-8.jpg','/demo/villas/villa-9.jpg']);
export function reviewedCover(villa){
 if(!villa?.photo_url)return false;
 const reviewed=Date.parse(villa.photo_reviewed_at),uploaded=Date.parse(villa.photo_uploaded_at);
 return Number.isFinite(reviewed)&&(!Number.isFinite(uploaded)||reviewed>=uploaded);
}
export function publicCover(villa){
 return reviewedCover(villa)||stagingDemosEnabled()&&isDemoVilla(villa)&&licensed.has(villa.photo_url)?villa.photo_url:'';
}
