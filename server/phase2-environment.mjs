import target from './phase2-preview-target.json' with {type:'json'};
// Explicit synthetic-only runtime. Existing Stage/Production targets never pass here.
export function phase2Environment(env){
 if(env.APP_ENV==='phase2-preview'){
  const deny=()=>{throw Error('Phase2 Preview target rejected');};let u;try{u=new URL(env.DATABASE_URL);}catch{deny();}
  if(env.VERCEL!=='1'||env.VERCEL_ENV!=='preview'||env.VERCEL_PROJECT_ID!==target.vercelProjectId||u.hostname.replace('-pooler.','.')!==target.host||decodeURIComponent(u.pathname.slice(1))!==target.database||decodeURIComponent(u.username)!==target.role||!u.password||!['postgres:','postgresql:'].includes(u.protocol)||u.searchParams.get('sslmode')!=='verify-full'||[...u.searchParams.keys()].some(k=>k!=='sslmode')||u.hash||!/^villacheck-qa-phase1-[a-z0-9]+-villa-check\.vercel\.app$/.test(env.VERCEL_URL||'')||env.PHASE2_ENABLED!=='true'||env.PAYMENT_ACCESS_MODE!=='DISABLED'||env.SEED_DEMO_ACCOUNTS!=='false'||env.SEED_PUBLIC_DEMO_DATA!=='false'||(env.OTP_SECRET||'').length<32||env.NODE_TLS_REJECT_UNAUTHORIZED==='0')deny();
  if(Object.entries(env).some(([k,v])=>v&&(/^(SMTP_|GOOGLE_CLIENT_|LINE_CHANNEL_|THAIBULKSMS_|OMISE_)/.test(k)||['DIRECT_URL','VillaCheck_DATABASE_URL','PRODUCTION_RELEASE_MODE','STAGING_RELEASE_POLICY','QA_SYNTHETIC_GRANT_APPROVAL','CUSTOMER_OAUTH_EXISTING_ENABLED'].includes(k))))deny();
  return {...env,APP_URL:'https://'+env.VERCEL_URL};
 }
 if(env.APP_ENV!=='phase2-local')return null;
 const deny=()=>{throw Error('Isolated Phase2 runtime rejected');};
 let u,origin;try{u=new URL(env.DATABASE_URL);origin=new URL(env.APP_URL);}catch{deny();}
 if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||env.VERCEL||env.VERCEL_PROJECT_ID||!['localhost','127.0.0.1'].includes(u.hostname)||!['postgres:','postgresql:'].includes(u.protocol)||!u.password||u.hash||![...u.searchParams.keys()].every(k=>k==='schema')||!/^p2_[a-f0-9]{32}$/.test(u.searchParams.get('schema')||'')||!['localhost','127.0.0.1'].includes(origin.hostname)||origin.protocol!=='http:'||env.PHASE2_ENABLED!=='true'||env.PAYMENT_ACCESS_MODE!=='DISABLED'||env.SEED_DEMO_ACCOUNTS!=='false'||env.SEED_PUBLIC_DEMO_DATA!=='false'||(env.OTP_SECRET||'').length<32)deny();
 if(Object.entries(env).some(([k,v])=>v&&(/^(SMTP_|GOOGLE_CLIENT_|LINE_CHANNEL_|THAIBULKSMS_|OMISE_)/.test(k)||['DIRECT_URL','VillaCheck_DATABASE_URL','PRODUCTION_RELEASE_MODE','STAGING_RELEASE_POLICY','QA_SYNTHETIC_GRANT_APPROVAL','CUSTOMER_OAUTH_EXISTING_ENABLED'].includes(k))))deny();
 return {...env};
}
export async function verifyPhase2SyntheticDatabase(db){
 const row=await db.prepare("SELECT value FROM system_settings WHERE key='phase2:synthetic-runtime'").get();
 if(!['LOCAL_SYNTHETIC_ONLY','PHASE2_PREVIEW_SYNTHETIC_ONLY'].includes(row?.value))throw Error('Synthetic database marker required');
 const people=await db.prepare('SELECT email FROM users').all();
 if(!people.length||people.some(u=>!u.email.endsWith('@synthetic.invalid')))throw Error('Non-synthetic identity in Phase2 database');
}
