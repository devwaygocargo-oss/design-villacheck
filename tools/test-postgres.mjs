// Disposable local PostgreSQL only. Never reads .env or an existing database URL.
import EmbeddedPostgres from "embedded-postgres"
import { mkdtempSync, rmSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import { createServer } from "node:net"
import { spawn } from "node:child_process"
const reserve=createServer()
await new Promise(resolve=>reserve.listen(0,"127.0.0.1",resolve))
const port=reserve.address().port
await new Promise(resolve=>reserve.close(resolve))
const directory=mkdtempSync(join(tmpdir(),"villacheck-regression-pg-")),password=randomBytes(24).toString("hex")
const postgres=new EmbeddedPostgres({databaseDir:join(directory,"database"),user:"postgres",password,port,persistent:false,postgresFlags:["-h","127.0.0.1"],onLog:()=>{},onError:()=>{}})
let finalExitCode=0
try {
 await postgres.initialise();await postgres.start()
 const url=`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`
 const isolatedEnv={...process.env,TEST_DATABASE_URL:url,DATABASE_URL:url,DIRECT_URL:url,VillaCheck_DATABASE_URL:url,NEXT_TELEMETRY_DISABLED:"1",SMTP_HOST:"",SMTP_FROM:"",SMTP_USER:"",SMTP_PASSWORD:"",OTP_SECRET:"",APP_ENV:"test",PAYMENT_ACCESS_MODE:"",OMISE_TEST_ENABLED:"false",OMISE_TEST_SECRET_KEY:"",SEED_PUBLIC_DEMO_DATA:"false"}
 // Next loads .env even when the test runner does not. Explicit empty values
 // prevent developer provider credentials from entering localhost test servers.
 for(const key of ['SMTP_PORT','SMTP_SECURE','THAIBULKSMS_API_KEY','THAIBULKSMS_API_SECRET','THAIBULKSMS_SENDER','THAIBULKSMS_OTP_KEY','THAIBULKSMS_OTP_SECRET','THAIBULKSMS_EMAIL_OTP_TEMPLATE_ID','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','FACEBOOK_APP_ID','FACEBOOK_APP_SECRET','LINE_CHANNEL_ID','LINE_CHANNEL_SECRET','OMISE_TEST_PUBLIC_KEY','CRON_SECRET'])isolatedEnv[key]=''
 const tests=readdirSync("server").filter(file=>file.endsWith(".test.mjs")).map(file=>"server/"+file)
 const child=spawn(process.execPath,["--test","--test-concurrency=2",...tests],{stdio:"inherit",env:isolatedEnv})
 const exitCode=await new Promise((resolve,reject)=>{child.once("exit",resolve);child.once("error",reject)})
 finalExitCode=exitCode??1
 if(exitCode===0 && ["--browser","--payment-browser","--all-browsers","--business-browser","--phase1-browser","--staging-browser"].some(flag=>process.argv.includes(flag))) {
  const scripts=(process.argv.includes("--all-browsers")||process.argv.includes("--business-browser")||process.argv.includes("--phase1-browser")||process.argv.includes("--staging-browser"))?["tools/browser-regression.mjs","tools/payment-browser-regression.mjs"]:[process.argv.includes("--payment-browser")?"tools/payment-browser-regression.mjs":"tools/browser-regression.mjs"]
  for(const script of scripts){
   const browser=spawn(process.execPath,[script],{stdio:"inherit",env:{...isolatedEnv,...((process.argv.includes("--phase1-browser")||process.argv.includes("--staging-browser"))?{VILLACHECK_PHASE1_QA:"1",VILLACHECK_BUSINESS_QA:"1",VILLACHECK_BROWSER_EVIDENCE_DIR:process.argv.includes("--staging-browser")?"docs/validation/staging-readiness/general":"docs/validation/phase1-release/general",VILLACHECK_PAYMENT_EVIDENCE_DIR:process.argv.includes("--staging-browser")?"docs/validation/staging-readiness/payment":"docs/validation/phase1-release/payment"}:{}),...(process.argv.includes("--business-browser")?{VILLACHECK_BUSINESS_QA:"1",VILLACHECK_BROWSER_EVIDENCE_DIR:"docs/validation/business-20261024/general",VILLACHECK_PAYMENT_EVIDENCE_DIR:"docs/validation/business-20261024/payment"}:{}),...(process.argv.includes("--all-browsers")?{VILLACHECK_BROWSER_EVIDENCE_DIR:"docs/validation/phase3/general"}:{})}})
   finalExitCode=await new Promise((resolve,reject)=>{browser.once("exit",resolve);browser.once("error",reject)})??1
   if(finalExitCode)break
  }
 }
 if(finalExitCode===0 && process.argv.includes("--phase1-release-browser")){
  const browser=spawn(process.execPath,["tools/phase1-browser-regression.mjs"],{stdio:"inherit",env:isolatedEnv})
  finalExitCode=await new Promise((resolve,reject)=>{browser.once("exit",resolve);browser.once("error",reject)})??1
 }
}finally{await postgres.stop().catch(()=>{});rmSync(directory,{recursive:true,force:true})}

// embedded-postgres async exit hooks otherwise turn beforeExit into status 0.
// Cleanup and child log streams have completed; propagate the actual result.
process.exit(finalExitCode)
