// Explicit retention context, populated only by a separately approved cleanup.
// No migration or startup path writes this record. It never restores public visibility.
export async function retainedMediaParent(db,villaId,documentId,user){
 if(!user||!['user','merchant','admin'].includes(user.role))return null;
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('retained_media_parent:'+villaId);
 if(!row)return null;
 let context;try{context=JSON.parse(row.value)}catch{return null}
 if(!context||typeof context!=='object'||Array.isArray(context))return null;
 if(context.version!==1||context.villaId!==villaId||typeof context.ownerId!=='string'||!Array.isArray(context.documentIds)||!context.documentIds.includes(documentId)||typeof context.approvalReference!=='string'||!context.approvalReference.trim())return null;
 if(user.role!=='admin'&&user.id!==context.ownerId)return null;
 const file=await db.prepare('SELECT owner_id FROM documents WHERE id=?').get(documentId);
 if(!file||file.owner_id!==context.ownerId)return null;
 return {id:villaId,owner_id:context.ownerId,status:'retained',retained:true};
}

// Preserve an already-authorized Merchant's access to explicitly retained review
// attachments. The review author and every chunk owner remain unchanged.
export async function retainedReviewMerchantAccess(db,file,user){
 if(user?.role!=='merchant')return false;
 const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('retained_media_parent:'+file.villaId);
 if(!row)return false;
 let context;try{context=JSON.parse(row.value)}catch{return false}
 if(!context||context.version!==1||context.villaId!==file.villaId||context.ownerId!==user.id||typeof context.approvalReference!=='string'||!context.approvalReference.trim()||!Array.isArray(context.reviewFiles))return false;
 return context.reviewFiles.some(item=>item&&item.id===file.id&&item.ownerId===file.ownerId&&item.reviewId===file.reviewId);
}
