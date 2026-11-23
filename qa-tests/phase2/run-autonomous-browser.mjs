import EmbeddedPostgres from 'embedded-postgres';
import {mkdtempSync,rmSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const dir=mkdtempSync(join(tmpdir(),'vc-p2-')),password=randomBytes(24).toString('hex');
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password,port,persistent:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
let code=0;
try{
 await pg.initialise();await pg.start();mkdirSync('qa-evidence',{recursive:true});
 const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,APP_ENV:'test',TEST_DATABASE_URL:`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`,NEXT_TELEMETRY_DISABLED:'1',SEED_PUBLIC_DEMO_DATA:'false',SEED_DEMO_ACCOUNTS:'false'};
 for(const key of ['DATABASE_URL','DIRECT_URL','VillaCheck_DATABASE_URL','SMTP_HOST','SMTP_FROM','SMTP_USER','SMTP_PASSWORD','SMTP_PORT','SMTP_SECURE','OTP_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','LINE_CHANNEL_ID','LINE_CHANNEL_SECRET','FACEBOOK_APP_ID','FACEBOOK_APP_SECRET','THAIBULKSMS_API_KEY','THAIBULKSMS_API_SECRET','THAIBULKSMS_SENDER','THAIBULKSMS_OTP_KEY','THAIBULKSMS_OTP_SECRET','OMISE_TEST_SECRET_KEY','OMISE_TEST_PUBLIC_KEY','CRON_SECRET'])env[key]='';
 const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{env,stdio:'inherit'});child.once('exit',c=>resolve(c??1));child.once('error',reject);});
 code=await run(process.argv.includes('--browser')?['qa-tests/phase2/autonomous-payments-browser.mjs',...(process.argv.includes('--layout-only')?['--layout-only']:[])]:['--test','qa-tests/phase2/tickets.test.mjs']);
}finally{await pg.stop().catch(()=>{});rmSync(dir,{recursive:true,force:true});}
process.exit(Number(code));
