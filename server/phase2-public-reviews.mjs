import {phase2Defaults,requirePhase2,requirePhase2Database} from './phase2-policy.mjs';

// Read-only projection for the main public QR review surface. Existing legacy
// reviews and their moderation paths remain intact; no records are copied.
export async function phase2PublicReviewRecords(db,villaId,config={}){
 if(config.phase2Enabled!==true)return [];
 requirePhase2(config);requirePhase2Database(db,config);
 const stored=await db.prepare("SELECT value FROM system_settings WHERE key='phase2:v1:policy'").get();
 const policy={...phase2Defaults,...(stored?JSON.parse(stored.value):{})};
 if(policy.reviewsEnabled!==true||policy.publicReviews!==true)return [];
 return (await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'phase2:v1:review:%'").all())
  .map(row=>JSON.parse(row.value))
  .filter(review=>review.villaId===villaId&&review.status==='published')
  .map(({id,rating,content,createdAt,publishedAt,reply})=>({id,rating,content,createdAt,publishedAt,status:'published',author:'',media:[],reply:reply?{content:reply.content,at:reply.at,author:''}:null}));
}
