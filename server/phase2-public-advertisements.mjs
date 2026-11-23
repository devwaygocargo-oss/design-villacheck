import {phase2Api} from './phase2.mjs';
import {phase2Defaults,requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
import {demoVillasVisible,isDemoVilla,isAllocatedTestListing,isProductionCleanupTestListing} from './demo-villa-visibility.mjs';

// Reuse the approved schedule, entitlement, public-QR and media-ownership
// projection. This never enables legacy ads, changes policy or creates data.
export async function phase2PublicAdvertisements(db,url,config={}){
 if(config.phase2Enabled!==true&&config.phase2ProductionCoreOnly!==true)return [];
 const placement=url.searchParams.get('placement')||'detail';
 if(!['home','detail'].includes(placement))return [];
 requirePhase2(config);requirePhase2Database(db,config);
 const stored=await db.prepare("SELECT value FROM system_settings WHERE key='phase2:v1:policy'").get();
 const policy={...phase2Defaults,...(stored?JSON.parse(stored.value):{})};
 if(policy.publicPromotions!==true)return [];
 const query=new URL('http://localhost/api/phase2/public');query.searchParams.set('placement',placement);query.searchParams.set('seed',url.searchParams.get('seed')||'');
 const projected=await phase2Api(db,null,{method:'GET'},'/api/phase2/public',query,async()=>({}),config);
 const demosVisible=await demoVillasVisible(db),result=[];
 for(const row of projected.promotions){
  const villa=await db.prepare('SELECT id,owner_id,email FROM villas WHERE id=?').get(row.villaId);
  if(!villa||!demosVisible&&isDemoVilla(villa)||isAllocatedTestListing(villa)||isProductionCleanupTestListing(villa))continue;
  result.push({id:row.id,image:row.image,mobileImage:'',title:row.title,description:'',href:row.href,label:'ตรวจสอบที่พัก',visible:true,approved:true,eligible:true,sponsored:false,placement,order:result.length,startsAt:'',endsAt:''});
 }
 return result;
}
