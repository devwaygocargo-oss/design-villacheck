import {phase2VillaAccess} from './phase2-access.mjs';
import {phase2VillaGrants,selectedPhase2Grant,grantEnvironment} from './phase2-grants.mjs';
import {packageEntitlements} from './package-entitlements.mjs';
import {phase2Capabilities,phase2Defaults,requirePhase2,requirePhase2Database} from './phase2-policy.mjs';
// Read-only bridge. Legacy rights are never replaced by Sandbox grants or expiry.
export async function villaPackageRights(db,villa,config,now=config?.phase2Clock?.()??Date.now()){
 const legacy={packageId:villa.package_id,entitlements:await packageEntitlements(db,villa.package_id)};
 if(config?.phase2Enabled!==true)return {legacy};
 requirePhase2(config);requirePhase2Database(db,config);
 const row=await db.prepare("SELECT value FROM system_settings WHERE key='phase2:v1:policy'").get(),policy=row?JSON.parse(row.value):phase2Defaults;
 const access=await phase2VillaAccess(db,villa,config,now);
 const all=await phase2VillaGrants(db,villa),selected=await selectedPhase2Grant(db,villa,now),grants=selected?[selected]:[];
 return {legacy,phase2:{environment:grantEnvironment(db),active:grants.map(g=>({id:g.id,packageId:g.packageId,startsAt:g.startsAt,endsAt:g.endsAt,capabilities:phase2Capabilities(g.packageId,policy)})),selectedPackageId:selected?.packageId||null,trial:all.find(g=>g.scope==='MERCHANT_ACCOUNT')||null,access,expiryRightsPolicy:access?.paidQrExpiryScoped?'PAID_QR_INFORMATION_HIDDEN_AFTER_EXPIRY_IDENTITY_RETAINED':'PUBLIC_APPROVED_QR_RETAINED_MERCHANT_EDITING_DISABLED_AFTER_EXPIRY_OTHER_FEATURES_PENDING',legacyPreserved:true,mediaQuotaPolicy:'LEGACY_UNCHANGED',billingMutation:false}};
}
