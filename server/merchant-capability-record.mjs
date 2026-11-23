// Shared fail-closed validation for session reads and queued writes.
export const merchantProfileKey=id=>'merchant_profile:'+id;
export function parseMerchantProfile(value,id){
 try{const p=typeof value==='string'?JSON.parse(value):value;
  const legacy=p?.version===1&&p.source==='AUTHENTICATED_SELF_REGISTRATION'&&p.consent?.version===1&&Number.isFinite(Date.parse(p.consent.acceptedAt));
  const business=p?.version===2&&p.source==='AUTHENTICATED_MERCHANT_PROFILE';
  if((!legacy&&!business)||p.userId!==id||p.status!=='ACTIVE'||!Number.isFinite(Date.parse(p.createdAt))||!Number.isFinite(Date.parse(p.updatedAt)))return null;
  for(const [field,max] of Object.entries({businessName:200,businessNameEn:200,contactName:200,phone:30,address:2000})){const value=p.fields?.[field];if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f\x7f]/.test(value))return null;}
  return /^[+0-9 ()-]{8,30}$/.test(p.fields.phone)?p:null;
 }catch{return null;}
}
