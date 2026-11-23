import {stagingDemosEnabled,isDemoVilla} from './demo-villa-visibility.mjs';
import {diverseDemoImages} from './demo-image-catalog.mjs';
const licensed=new Set(diverseDemoImages.map(image=>image.url));
// Explicit fixture illustrations are distinct from reviewed property evidence.
// Only the pinned Staging project may expose these unreviewed licensed images.
export function publishedDemoIllustration(villa,media,options){
 return stagingDemosEnabled()&&options?.demoImages===true&&villa?.status==='approved'&&isDemoVilla(villa)&&media?.demoIllustration===true&&media.kind==='image'&&!media.removedAt&&licensed.has(media.url);
}
