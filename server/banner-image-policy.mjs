export const bannerImageWidths=Object.freeze([480,768,1280,1920]);
const cmsImage=/^\/api\/public\/cms-media\/[a-f0-9-]{36}$/;
export function responsiveBannerImage(src){
 if(typeof src!=='string'||!cmsImage.test(src))return {src};
 return {src:src+'?w=1280',srcSet:bannerImageWidths.map(width=>src+'?w='+width+' '+width+'w').join(', '),sizes:'100vw'};
}
export function bannerVariantWidth(params){
 if(!params.has('w'))return null;
 const width=params.get('w');
 if(params.getAll('w').length!==1||[...params.keys()].some(key=>key!=='w')||!bannerImageWidths.some(value=>String(value)===width))throw Object.assign(Error('Invalid banner image width'),{status:400});
 return Number(width);
}
