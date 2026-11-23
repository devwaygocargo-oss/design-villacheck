// Existing authenticated menu reads. This changes route reachability only;
// handlers retain role, owner, document and session checks. Social writes below still use the existing owner and protected-record guards.
const routes = new Set([
  '/api/admin/users', '/api/admin/merchants', '/api/admin/payments',
  '/api/admin/subscriptions', '/api/admin/owner-notifications',
  '/api/admin/promotions', '/api/admin/social-materials', '/api/admin/social-jobs',
  '/api/merchant/social-materials', '/api/merchant/social-jobs',
  '/api/merchant/registration', '/api/admin/merchant-registrations',
]);
export function menuReadAllowed(method, path) {
  return method === 'GET' && (routes.has(path) || /^\/api\/(?:(merchant|admin)\/registration-documents|social-material-files)\/[a-f0-9-]{36}$/.test(path));
}

// Advertisement mutation belongs to the deferred phase; inventory reads stay available.
const socialWrites=new Set(['/api/admin/social-jobs','/api/merchant/social-jobs','/api/admin/social-materials','/api/merchant/social-materials']);
export function socialMenuWriteAllowed(method,path){return method==='POST'&&socialWrites.has(path);}

export function stagingSettingsWriteAllowed(method,path){return method==='POST'&&['/api/admin/settings','/api/admin/settings/demo-villas'].includes(path);}
