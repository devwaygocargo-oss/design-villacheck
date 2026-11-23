import {phase2Defaults,requirePhase2,requirePhase2Database} from './phase2-policy.mjs';

// Read-only projection for the main public QR review surface. Existing legacy
// reviews and their moderation paths remain intact; no records are copied.
export async function phase2PublicReviewPolicy(db,config={}){
 if(config.phase2Enabled!==true&&config.phase2ProductionCoreOnly!==true)return null;
 requirePhase2(config);requirePhase2Database(db,config);
 const stored=await db.prepare("SELECT value FROM system_settings WHERE key='phase2:v1:policy'").get();
 const policy={...phase2Defaults,...(stored?JSON.parse(stored.value):{})};
 return policy.reviewsEnabled===true&&policy.publicReviews===true?policy:null;
}
export async function phase2PublicReviewRecords(db,villaId,config={},checkedPolicy){
 const policy=checkedPolicy||await phase2PublicReviewPolicy(db,config);
 if(!policy)return [];
 return (await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:review:%'").all())
  .map(row=>JSON.parse(row.value))
  .filter(review=>review.villaId===villaId&&review.status==='published')
  .map(({id,rating,content,createdAt,publishedAt,reply})=>({id,rating,content,createdAt,publishedAt,status:'published',author:'',media:[],reply:reply?{content:reply.content,at:reply.at,author:''}:null}));
}

// Both submission paths already run inside the shared database transaction.
// Check both inventories before inserting, without rewriting historical records.
async function hasReview(db,prefix,userId,villaId){
 return (await db.prepare("SELECT value FROM system_settings WHERE key LIKE ?").all(prefix+'%'))
  .some(row=>{const review=JSON.parse(row.value);return review.userId===userId&&review.villaId===villaId;});
}
export const hasLegacyReview=(db,userId,villaId)=>hasReview(db,'customer_review:',userId,villaId);
export const hasPhase2Review=(db,userId,villaId)=>hasReview(db,'phase2:v1:review:',userId,villaId);
