// Server-owned registration provenance; never accept this marker from request data.
export async function publicOAuthUser(db,user,config={}) {
  if(config.oauthExistingAccountsOnly!==true||!['user','merchant'].includes(user?.role))return false;
  const row=await db.prepare("SELECT u.created,s.value FROM users u JOIN system_settings s ON s.key='public_oauth_user:'||u.id WHERE u.id=? AND u.role=? AND EXISTS (SELECT 1 FROM oauth_identities o WHERE o.user_id=u.id AND o.provider IN ('google','line'))").get(user.id,user.role);
  if(!row)return false;
  try {const marker=JSON.parse(row.value);return marker.userId===user.id&&marker.role===user.role&&['google','line'].includes(marker.provider)&&marker.created===row.created;} catch {return false;}
}
export async function recordPublicOAuthUser(db,user,provider) {
  if(!['user','merchant'].includes(user.role)||!['google','line'].includes(provider))throw Error('account_type_mismatch');
  const row=await db.prepare('SELECT created FROM users WHERE id=?').get(user.id);
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('public_oauth_user:'+user.id,JSON.stringify({userId:user.id,role:user.role,provider,created:row.created}));
}
