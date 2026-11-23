// Existing banner fields are Thai. English overrides are optional per field.
export function validateBannerEnglish(value, url, text) {
 if(value===undefined)return undefined;
 if(!value||typeof value!=="object"||Array.isArray(value))throw Object.assign(new Error("ข้อมูลแบนเนอร์ภาษาอังกฤษไม่ถูกต้อง"),{status:400});
 return {image:url(value.image||"",true),mobileImage:url(value.mobileImage||"",true),href:url(value.href||""),title:text(value.title||"",300),description:text(value.description||"",2000,true),label:text(value.label||"",100),eyebrow:text(value.eyebrow||"",300)};
}
export function localizedBanner(banner,locale){
 if(locale!=="en")return banner;
 const overrides=Object.fromEntries(Object.entries(banner.en||{}).filter(([,value])=>typeof value==="string"&&value.trim()));
 return {...banner,...overrides,...Object.fromEntries(["title","description","label","eyebrow"].map(key=>[key,banner.en?.[key]?.trim()||""])),mobileImage:overrides.mobileImage||(overrides.image?"":banner.mobileImage)};
}
export function bannerMedia(banner){return [banner.image,banner.mobileImage,banner.en?.image,banner.en?.mobileImage].filter(Boolean)}
