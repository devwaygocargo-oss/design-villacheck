// Explicitly approved property submission/review workflow; unrelated business,
// payments, account roles and membership grants keep their existing policies.
export function propertyWorkflowPolicy(env){
 if(env.PROPERTY_MEDIA_WORKFLOW_ENABLED===undefined||env.PROPERTY_MEDIA_WORKFLOW_ENABLED==='false')return {};
 if(env.PROPERTY_MEDIA_WORKFLOW_ENABLED!=='true'||env.APP_ENV!=='production'||env.VERCEL_PROJECT_ID!=='prj_AojlAe1eFqvqEnKd3FPENLbr3DtO'||env.APP_URL!=='https://www.villacheckth.com'||!['MEMBER_PREVIEW','PRODUCTION','PHASE1_PUBLIC'].includes(env.PRODUCTION_RELEASE_MODE)||env.PAYMENT_ACCESS_MODE!=='DISABLED'||env.BUSINESS_INITIALIZATION_MODE!==(['PRODUCTION','PHASE1_PUBLIC'].includes(env.PRODUCTION_RELEASE_MODE)?'EXISTING_CATALOG':'DISABLED_UNTIL_APPROVAL'))throw Error('Property workflow target rejected');
 return{propertyMediaWorkflowEnabled:true};
}
export function propertyWorkflowRequestAllowed(method,path){
 if(method!=='POST')return false;
 return ['/api/villas','/api/merchant/villa-draft','/api/merchant/property-media','/api/admin/property-media','/api/merchant/ownership-documents','/api/admin/ownership-documents'].includes(path)||/^\/api\/merchant\/villas\/[a-f0-9-]{36}$/.test(path)||/^\/api\/villas\/[a-f0-9-]{36}\/(review|resubmit)$/.test(path);
}
