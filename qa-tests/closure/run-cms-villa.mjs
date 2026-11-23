// Disposable loopback PostgreSQL only; no .env files or remote connection values.
import EmbeddedPostgres from 'embedded-postgres';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const dir=mkdtempSync(join(tmpdir(),'vc-three-bugs-pg-')),password=randomBytes(24).toString('hex');
const db=new EmbeddedPostgres({databaseDir:join(dir,'data'),user:'postgres',password,port,persistent:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
try{
  await db.initialise();await db.start();
  const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,APP_ENV:'test',TEST_DATABASE_URL:`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`};
  for(const key of ['SMTP_HOST','SMTP_FROM','SMTP_USER','SMTP_PASSWORD','SMTP_PORT','SMTP_SECURE','OTP_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','LINE_CHANNEL_ID','LINE_CHANNEL_SECRET','FACEBOOK_APP_ID','FACEBOOK_APP_SECRET','THAIBULKSMS_API_KEY','THAIBULKSMS_API_SECRET','THAIBULKSMS_SENDER','THAIBULKSMS_OTP_KEY','THAIBULKSMS_OTP_SECRET','THAIBULKSMS_EMAIL_OTP_TEMPLATE_ID','OMISE_TEST_SECRET_KEY','OMISE_TEST_PUBLIC_KEY','CRON_SECRET'])env[key]='';
  env.SEED_DEMO_ACCOUNTS='false';env.SEED_PUBLIC_DEMO_DATA='false';env.NEXT_TELEMETRY_DISABLED='1';
  const source=JSON.parse(readFileSync('qa-tests/closure/source-manifest.json'));source.artifact=process.cwd();source.files=source.files.map(f=>({...f,sha256:createHash('sha256').update(readFileSync(f.file)).digest('hex')}));writeFileSync(dir+'/source.json',JSON.stringify(source));env.VILLACHECK_SECURITY_SOURCE_MANIFEST=dir+'/source.json';
  const tests=process.argv.includes("--browser")?["qa-tests/closure/cms-villa-browser.test.mjs"]:["qa-tests/closure/cms-villa.test.mjs","qa-tests/closure/additional-admin.test.mjs","qa-tests/closure/admin-phase-a.test.mjs","qa-tests/closure/public-launch.test.mjs","qa-tests/closure/retained-cleanup-recovery.test.mjs","qa-tests/closure/session-expiration.test.mjs"];
  const child=spawn(process.execPath,['--test','--test-concurrency=2',...tests],{env,stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject)});
  if(code)throw Error('Regression failure; inspect sanitized log');
}finally{await db.stop().catch(()=>{});rmSync(dir,{recursive:true,force:true});}
