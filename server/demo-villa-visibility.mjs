import {pendingCleanupVillas} from './villa-archive.mjs';
import allocatedScope from './staging-merchant-scope.json' with {type:'json'};
const allocatedTestOwners=new Set(allocatedScope.merchants.map(actor=>actor.id));
export const demoVillaVisibilityKey='public_demo_villas_visible';
// Production always hides demo content. Both trusted deployment identifiers
// must identify the original Staging project before existing demos are exposed.
export const stagingDemosEnabled=(env=process.env)=>env.APP_ENV==='staging'&&env.VERCEL_PROJECT_ID===allocatedScope.target.vercelProjectId;
export const isDemoVilla=villa=>/^(?:demo|try)-[a-z0-9-]+@villacheck[.]example$/i.test(villa.email||'');
export const demoVillasVisibleValue=(row,env=process.env)=>stagingDemosEnabled(env)&&(!row||row.value==='true');
export async function demoVillasVisible(db,env=process.env){if(!stagingDemosEnabled(env))return false;return demoVillasVisibleValue(await db.prepare('SELECT value FROM system_settings WHERE key=?').get(demoVillaVisibilityKey),env)}
export const isAllocatedTestListing=(villa,env=process.env)=>allocatedTestOwners.has(villa?.owner_id)&&!stagingDemosEnabled(env);

// Exact approved legacy cleanup targets remain private until their independent cleanup gates close.
// This excludes only the two known Production test IDs; Stage demo visibility is unchanged.
export const isProductionCleanupTestListing=(villa,env=process.env)=>env.APP_ENV==='production'&&pendingCleanupVillas.includes(villa?.id);
