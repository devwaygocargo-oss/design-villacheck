const uuid=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
export function approvedOwnerMappings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['prin','game'].includes(k)))return false;
 const entries=['prin','game'].map(k=>value[k]);
 return entries.every(e=>e&&Object.keys(e).every(k=>['accountId','grantReference'].includes(k))&&uuid(e.accountId)&&typeof e.grantReference==='string'&&Boolean(e.grantReference.trim()))&&entries[0].accountId!==entries[1].accountId;
}
export function canApprovePhase2(user,config){
 const mappings=config.phase2OwnerApproverMappings;
 if(user?.role!=='admin'||!config.phase2OwnerApprovalReference||!approvedOwnerMappings(mappings))return false;
 // Mapping is not a grant. Both confirmations must be supplied by secure admin.
 if(!['prin','game'].every(k=>config.phase2BusinessOwnerIds?.includes(mappings[k].accountId)))return false;
 return ['prin','game'].some(k=>mappings[k].accountId===user.id);
}
