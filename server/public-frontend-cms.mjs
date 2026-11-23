// Public read-only CMS projection does not authorize Villa/media publication.
const generic='/villa-placeholder.svg';
const bundled=new Set([generic,'/illustrations/platform-updates.svg','/illustrations/qr-evidence.svg','/illustrations/merchant-trust.svg']);
export function publicFrontendCms(release,approvedMedia=[]){
 const walk=(value,key='')=>{
  if(Array.isArray(value))return value.map(v=>walk(v,key));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v,k)]));
  if(typeof value!=='string')return value;
  const media=/image|photo|logo|thumbnail|poster|src/i.test(key);
  if(media&&value&&(/^(?:\/|[a-z]+:)/i.test(value)||/^(?:image|images|mobileImage|logo|src|poster|thumbnail)$/i.test(key)))return bundled.has(value)||approvedMedia.includes(value)?value:generic;
  if(value.startsWith('/api/')||value.startsWith('/demo/'))return /href|url/i.test(key)?'#':generic;
  return value;
 };
 const content=walk(release.content);
 for(const key of ['paymentInstructions','paymentQrImage','phone'])content.site[key]='';
 for(const key of ['paymentEmailSubject','paymentEmailIntro','emailOtpSubject','emailOtpBody','smsOtpBody','emailOtpTemplateId'])content.business[key]='';
 content.articles=content.articles.filter(x=>x.visible);content.faqs=content.faqs.filter(x=>x.visible);
 content.home.blocks=content.home.blocks.filter(x=>x.visible);content.pages=content.pages.map(p=>({...p,blocks:p.blocks.filter(x=>x.visible)}));
 return{revision:release.revision,carouselTimingVersion:release.carouselTimingVersion??0,content,publicFrontendReadOnly:true,mediaPublicationApproved:approvedMedia.length>0};
}
