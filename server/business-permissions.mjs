import {independentOwnerEnabled,independentOwnerAuthorized} from './phase2-owner-capability.mjs';
import {canApprovePhase2} from './phase2-approvers.mjs';
import {validAdminBinding} from './admin-access.mjs';
import {randomUUID} from 'node:crypto';
// Server-owned permission context. JSON/header fields cannot create this symbol.
const context=Symbol('business-permission-context');
const correlations=new WeakMap();
export function requestCorrelation(req){if(!correlations.has(req))correlations.set(req,randomUUID());return correlations.get(req);}
export const dailyPermissions=Object.freeze(['dashboard.read','villas.manage','accounts.manage','payments.review','kyc.review','memberships.manage','entitlements.manage','reports.manage','content.manage','audit.read']);
export const ownerPermissions=Object.freeze(['bank.manage','packages.configure','subscriptions.configure','promotions.configure','gateway.configure','system.configure','roles.manage']);
export const permissionCatalog=Object.freeze([...dailyPermissions,...ownerPermissions]);
export async function businessPermissions(db,actor,config){
 const user=await db.prepare('SELECT id,email,role FROM users WHERE id=?').get(actor?.id||'');
 if(!user||(actor.primaryRole||actor.role)!==user.role)return {owner:false,admin:false,permissions:[]};
 const status=await db.prepare('SELECT value FROM system_settings WHERE key=?').get('account_status:'+user.id);
 if(status){let access;try{access=JSON.parse(status.value);}catch{return {owner:false,admin:false,permissions:[]};}if(!access||typeof access!=='object'||Array.isArray(access)||access.status!=='active')return {owner:false,admin:false,permissions:[]};}
 const owner=independentOwnerEnabled(config)?await independentOwnerAuthorized(db,actor,config):canApprovePhase2(user,config);
 const admin=user.role==='admin'||actor.adminSession===true&&actor.role==='admin'&&Boolean(actor.token_hash)&&await validAdminBinding(db,actor,actor.token_hash);
 return {owner,admin,permissions:owner?[...permissionCatalog]:admin?[...dailyPermissions]:[]};
}
export async function requireBusinessPermission(db,actor,config,permission){
 const access=await businessPermissions(db,actor,config);
 if(!permissionCatalog.includes(permission)||!access.permissions.includes(permission))throw Object.assign(Error('ไม่มีสิทธิ์ดำเนินการ / Permission required: '+permission),{status:403,code:'PERMISSION_DENIED'});
 return access;
}
export function permissionForRequest(method,path,actor){
 const write=!['GET','HEAD'].includes(method);
 if(path==='/api/state'&&actor?.role==='admin')return 'dashboard.read';
 if(/^\/api\/villas\/[^/]+\/review$/.test(path))return 'villas.manage';
 if(path==='/api/admin/password-invitation')return 'roles.manage';
 if(/^\/api\/admin\/(receiving-bank|change-approvals)(?:\/|$)/.test(path))return 'bank.manage';
 if(/^\/api\/admin\/(access-roles|role|roles|permissions)(?:\/|$)/.test(path))return 'roles.manage';
 if(/^\/api\/admin\/(gateway|payment-gateway)(?:\/|$)/.test(path))return 'gateway.configure';
 if(/^\/api\/admin\/(settings|email-test|otp)(?:\/|$)/.test(path))return 'system.configure';
 if(/^\/api\/admin\/package-entitlements(?:\/|$)/.test(path))return 'entitlements.manage';
 if(write&&/^\/api\/admin\/(packages|package-promotions|basic-promotion)(?:\/|$)/.test(path))return 'packages.configure';
 if(write&&/^\/api\/admin\/promotions(?:\/|$)/.test(path))return 'promotions.configure';
 if(/^\/api\/admin\/subscriptions(?:\/|$)/.test(path))return 'memberships.manage';
 if(/^\/api\/admin\/cms(?:\/|$)/.test(path))return 'content.manage';
 if(/^\/api\/admin\/(accounts|users|merchants)(?:\/|$)/.test(path))return 'accounts.manage';
 if(/^\/api\/admin\/(merchant-registrations|registration-documents|owner-verification|ownership-documents|bank-evidence)(?:\/|$)/.test(path))return 'kyc.review';
 if(path==='/api/admin/registry-bank-verification')return 'kyc.review';
 if(/^\/api\/admin\/payments(?:\/|$)/.test(path)||/^\/api\/invoices\/[^/]+\/(confirm|reject)$/.test(path))return 'payments.review';
 if(/^\/api\/admin\/(reports|tickets|checks|leads)(?:\/|$)/.test(path))return 'reports.manage';
 if(path==='/api/admin/audit-log')return write?'unmapped.admin':'audit.read';
 if(/^\/api\/admin\/(packages|package-promotions|package-entitlements|basic-promotion|promotions)(?:\/|$)/.test(path))return 'memberships.manage';
 if(/^\/api\/admin\/(reviews|advertisements|social-jobs|social-materials)(?:\/|$)/.test(path))return 'content.manage';
 if(/^\/api\/admin\/(privacy-requests|owner-notifications)(?:\/|$)/.test(path))return 'reports.manage';
 if(/^\/api\/admin\/(documents|review-sample-document)(?:\/|$)/.test(path))return 'kyc.review';
 if(/^\/api\/admin\/(villa-archive|villa-pages|merchant-changes|property-media|media-upload|qr|qr-verification)(?:\/|$)/.test(path))return 'villas.manage';
 if(path==='/api/admin/readiness'||path==='/api/admin/acceptance')return write?'villas.manage':'dashboard.read';
 if(path.startsWith('/api/admin/'))return 'unmapped.admin';
 return null;
}
export function permissionContext(actor){return actor?.[context];}
export function withPermissionContext(actor,config,permission,owner=false,requestId=actor?.[context]?.requestId||randomUUID()){const result={...actor};result[context]={config,permission,owner,requestId};return result;}
export async function checkPermissionContext(db,actor){const c=permissionContext(actor);if(c?.permission)await requireBusinessPermission(db,actor,c.config,c.permission);}
export async function ownerOperationalSession(db,actor){const c=permissionContext(actor);return Boolean(c?.owner&&(await businessPermissions(db,actor,c.config)).owner);}
export function cmsCoreSettings(content){return {business:content?.business||{},site:Object.fromEntries(['name','email','phone','hours','facebook','instagram','line','logo','accent','paymentInstructions','paymentQrImage'].map(k=>[k,content?.site?.[k]??'']))};}
export async function assertCmsCoreUnchanged(db,actor,config,before,after){
 const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
 if(JSON.stringify(stable(cmsCoreSettings(before)))!==JSON.stringify(stable(cmsCoreSettings(after))))await requireBusinessPermission(db,actor,config,'system.configure');
}
