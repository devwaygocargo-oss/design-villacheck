import {validAdminBinding} from './admin-access.mjs';
import {checkPermissionContext,ownerOperationalSession} from './business-permissions.mjs';
import {parseMerchantProfile} from './merchant-capability-record.mjs';
// Recheck after acquiring the existing write transaction, so revocation wins over queued writes.
export async function assertWriteSession(db,actor){
 await checkPermissionContext(db,actor);
 if(!actor.token_hash)return; // Trusted non-HTTP jobs/tests have no browser session.
 const row=await db.prepare("SELECT s.expires,u.role,u.email,p.value AS access,m.value AS merchant_access,EXISTS(SELECT 1 FROM villas owned WHERE owned.owner_id=u.id) AS merchant_existing_owner FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN system_settings p ON p.key='account_status:'||u.id LEFT JOIN system_settings m ON m.key='merchant_profile:'||u.id WHERE s.token_hash=? AND s.user_id=?").get(actor.token_hash,actor.id);
 let suspended=false;try{suspended=Boolean(row?.access&&JSON.parse(row.access).status==='suspended')}catch{suspended=true}
 const invalidRole=actor.role==='admin'&&row?.role!=='admin'&&!await validAdminBinding(db,actor,actor.token_hash)&&!await ownerOperationalSession(db,actor)||!['user','merchant','admin'].includes(actor.role);
 const revokedMerchant=actor.role==='merchant'&&actor.primaryRole==='user'&&!parseMerchantProfile(row?.merchant_access,actor.id);
 if(revokedMerchant||invalidRole||!row||!Number.isFinite(Number(row.expires))||Number(row.expires)<=Date.now()||row.role!==(actor.primaryRole||actor.role)||(typeof actor.email==='string'&&row.email!==actor.email)||suspended)throw Object.assign(Error('บัญชีหรือเซสชันเปลี่ยนแปลง กรุณาเข้าสู่ระบบอีกครั้ง'),{status:401,code:'SESSION_REVOKED'});
}
