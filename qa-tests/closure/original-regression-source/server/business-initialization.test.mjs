import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {openPostgres} from './postgres.mjs'
import {createUser} from './database.mjs'
import {effectivePlans} from './catalog.mjs'
import {verificationCapabilities} from './package-entitlements.mjs'
import {decisionKeys,businessSourceFingerprint,manifestChecksum,planBusinessInitialization,initializeBusiness,catalogReadModel} from './business-initialization.mjs'
const ids=['basic','starter','pro','premium']
function fixture(target){
 const rows=ids.map((id,i)=>({id,name:['Basic Verify','Online Verify','Social Verify','Premium Verify'][i],slug:id,description:'Local rehearsal business configuration',amount:[99000,199000,299000,499000][i],currency:'THB',billing_cycle:'MONTHLY',trial_months:0,capacity:1,features:['Local rehearsal approved feature'],max_level:i===0?'BASIC_CHECKED':i===3?'PREMIUM_VERIFIED':'VERIFIED',banner:i===3?1:0,active:1,sort_order:i}))
 const settings=[{key:'demo_mode',value:false},{key:'public_demo_villas_visible',value:false},{key:'launch_promotion_active',value:false},{key:'basic_promotion',value:{active:false,revision:1}},...ids.map(id=>({key:'package_promotion:'+id,value:{active:false,percent:0,revision:1}})),...ids.map(id=>({key:'package_entitlements:'+id,value:{reviewModerationRequired:true,guarantee:null,revision:1}}))]
 const decisions=Object.fromEntries(decisionKeys.map(k=>[k,{status:'CONFIRMED',value:{localScenarioOnly:true},basis:'Synthetic Local rehearsal approval; never Production approval'}]));decisions.packageCatalog.value={currency:'THB',amountsMinor:Object.fromEntries(rows.map(r=>[r.id,r.amount]))};decisions.billingCycle.value='MONTHLY';decisions.tax.value={included:true};decisions.freeTrial.value={monthsByTier:Object.fromEntries(ids.map(id=>[id,0]))};decisions.merchantCapacity.value={villasPerMerchant:1};decisions.runtimeCompatibility.value={sourceChangesRequested:false};decisions.demoVisibility.value=false;decisions.launchEligibility.value={launchActive:false,basicActive:false};decisions.launchPromotion.value={percent:Object.fromEntries(ids.map(id=>[id,0]))};decisions.reviewModeration.value=Object.fromEntries(ids.map(id=>[id,true]));decisions.guaranteeVerification.value={publishGuarantee:false}
 const catalog=effectivePlans(rows.map(r=>({...r,features:JSON.stringify(r.features)}))).map(p=>catalogReadModel({...p,regularAmount:p.amount,discountAmount:0,netAmount:p.amount,pricingPending:false,promotion:null})).sort((a,b)=>a.id.localeCompare(b.id));const entitlements=Object.fromEntries(ids.map(id=>[id,{reviewModerationRequired:true,guarantee:null,capabilities:verificationCapabilities[id],guaranteeTermsConfirmed:false}]))
 return {formatVersion:1,version:'LOCAL-REHEARSAL-v1',state:'APPROVED',localRehearsal:true,target,sourceFingerprint:businessSourceFingerprint(),decisions,writeSet:{catalog:rows,settings},expectedReadModels:{catalog,entitlements}}
}
const approval=m=>({approvedVersion:m.version,approvedChecksum:manifestChecksum(m)})
test('Business draft cannot self-approve; checksum/version/pending/unsafe payload fail closed',()=>{
 const draft=JSON.parse(readFileSync('config/business-initialization.v1.json','utf8'));assert.throws(()=>planBusinessInitialization(draft,approval(draft)),/Approved manifest/)
 const m=fixture({});assert.throws(()=>planBusinessInitialization(m,{...approval(m),approvedChecksum:'wrong'}),/checksum/)
 for(const change of [x=>{x.decisions.tax.status='PENDING BUSINESS APPROVAL'},x=>{x.writeSet.settings.push({key:'SMTP_PASSWORD',value:'local-sentinel'})},x=>{x.writeSet.catalog[0].amount=-1},x=>{x.writeSet.catalog[0].billing_cycle='YEARLY'},x=>{x.writeSet.catalog[0].trial_months=3},x=>{x.writeSet.catalog[0].capacity=2},x=>{x.sourceFingerprint='wrong'},x=>{x.decisions.runtimeCompatibility.value.sourceChangesRequested=true},x=>{x.writeSet.catalog[0].amount++}]){const copy=structuredClone(m);change(copy);assert.throws(()=>planBusinessInitialization(copy,approval(copy)))}
})
async function localDb(t){
 const u=new URL(process.env.TEST_DATABASE_URL);assert.ok(['127.0.0.1','localhost'].includes(u.hostname),'Local database required')
 const schema='business_'+randomUUID().replaceAll('-',''),admin=new pg.Pool({connectionString:u.toString()});await admin.query('CREATE SCHEMA '+schema)
 u.searchParams.delete('options');u.searchParams.set('schema',schema)
 const child=spawn(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--config','prisma.production.config.ts'],{env:{...process.env,DIRECT_URL:u.toString(),APP_ENV:'production',PRODUCTION_SCHEMA_APPROVED:'true',PRODUCTION_DATABASE_HOST:u.hostname,PRODUCTION_DATABASE_NAME:u.pathname.slice(1),PRODUCTION_DATABASE_SCHEMA:schema,PRODUCTION_MIGRATION_ROLE:decodeURIComponent(u.username)},stdio:['ignore','pipe','pipe']});let error='';child.stdout.on('data',()=>{});child.stderr.on('data',x=>{error+=x});const code=await new Promise((r,j)=>{child.on('exit',r);child.on('error',j)});assert.equal(code,0,'Local real-Prisma baseline must apply')
 const db=await openPostgres(process.env.TEST_DATABASE_URL,{bootstrap:false,options:'-c search_path='+schema});t.after(async()=>{await db.close();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end()});await createUser(db,'initializer-operator@rehearsal.invalid','LocalOnlyRandomAdminPassword123456789','Local Operator','admin')
 const target={projectId:'local-rehearsal',branchId:'local-rehearsal-branch',endpointId:'local-endpoint',database:u.pathname.slice(1),schema,role:decodeURIComponent(u.username)};return {db,target,verifiedTarget:{...target,host:u.hostname,localClusterVerified:true}}
}
test('Real Local PostgreSQL business initializer: identity, dry run, rollback, read-model consistency, idempotency and no test entity creation',{skip:!process.env.TEST_DATABASE_URL,timeout:60000},async t=>{
 const {db,target,verifiedTarget}=await localDb(t),m=fixture(target),opts={...approval(m),verifiedTarget};const beforeHistory=await db.prepare('SELECT * FROM _prisma_migrations').all();const userBefore=await db.prepare('SELECT id,password_hash FROM users').all()
 await assert.rejects(initializeBusiness(db,m,{...opts,verifiedTarget:{...verifiedTarget,branchId:'wrong'}}),/target identity/)
 const wrong=structuredClone(m);wrong.target.database='wrong';await assert.rejects(initializeBusiness(db,wrong,{...approval(wrong),verifiedTarget:{...verifiedTarget,database:'wrong'}}),/Actual adapter connection/)
 const wrongSchema=structuredClone(m);wrongSchema.target.schema='wrong_schema';await assert.rejects(initializeBusiness(db,wrongSchema,{...approval(wrongSchema),verifiedTarget:{...verifiedTarget,schema:'wrong_schema'}}),/SQL target/)
 await assert.rejects(initializeBusiness(db,m,{...opts,verifiedTarget:{...verifiedTarget,host:'not-local.neon.tech'}}),/connection does not match|cannot target Production/)
 let outboundCalls=0;const originalFetch=globalThis.fetch;globalThis.fetch=()=>{outboundCalls++;throw Error('Unexpected outbound request')};t.after(()=>{globalThis.fetch=originalFetch})
 const dry=await initializeBusiness(db,m,opts);assert.equal(dry.rolledBack,true);assert.equal((await db.prepare('SELECT count(*) AS count FROM package_catalog').get()).count,0);assert.equal((await db.prepare('SELECT count(*) AS count FROM system_settings').get()).count,0)
 let writes=0;const broken=Object.create(db);broken.prepare=function(sql){const p=db.prepare(sql);if(/INSERT INTO .*system_settings/.test(sql))return {...p,run:async(...args)=>{if(++writes===2)throw Error('Injected Local write failure');return p.run(...args)}};return p}
 await assert.rejects(initializeBusiness(broken,m,{...opts,dryRun:false}),/Injected Local/);assert.equal((await db.prepare('SELECT count(*) AS count FROM package_catalog').get()).count,0);assert.equal((await db.prepare('SELECT count(*) AS count FROM system_settings').get()).count,0)
 const incompatible=structuredClone(m);incompatible.expectedReadModels.catalog[0].taxIncluded=false;await assert.rejects(initializeBusiness(db,incompatible,{...approval(incompatible),verifiedTarget,dryRun:false}),/read model differs/);assert.equal((await db.prepare('SELECT count(*) AS count FROM package_catalog').get()).count,0)
 const outcomes=await Promise.all([initializeBusiness(db,m,{...opts,dryRun:false}),initializeBusiness(db,m,{...opts,dryRun:false})]);assert.equal(outcomes.filter(x=>x.applied).length,1);assert.equal(outcomes.filter(x=>x.idempotent).length,1)
 const catalog=await db.prepare('SELECT * FROM package_catalog ORDER BY id').all(),settings=await db.prepare('SELECT * FROM system_settings ORDER BY key').all();const repeat=await initializeBusiness(db,m,{...opts,dryRun:false});assert.equal(repeat.idempotent,true);assert.deepEqual(await db.prepare('SELECT * FROM package_catalog ORDER BY id').all(),catalog);assert.deepEqual(await db.prepare('SELECT * FROM system_settings ORDER BY key').all(),settings)
 const changed=structuredClone(m);changed.writeSet.catalog[0].description+=' changed';await assert.rejects(initializeBusiness(db,changed,{...approval(changed),verifiedTarget,dryRun:false}),/overwrites are forbidden/)
 assert.deepEqual(await db.prepare('SELECT * FROM _prisma_migrations').all(),beforeHistory);assert.deepEqual(await db.prepare('SELECT id,password_hash FROM users').all(),userBefore)
 for(const table of ['villas','invoices','mails','login_otps','sessions','leads','documents','subscriptions','audits'])assert.equal((await db.prepare('SELECT count(*) AS count FROM '+table).get()).count,0)
 assert.equal(catalog.length,4);assert.equal(settings.length,12);assert.equal(outboundCalls,0)
 if(process.env.VILLACHECK_BUSINESS_REHEARSAL_REPORT)writeFileSync(process.env.VILLACHECK_BUSINESS_REHEARSAL_REPORT,JSON.stringify({localOnly:true,syntheticApprovalNotProductionApproval:true,actualPrismaHistory:beforeHistory.map(r=>({name:r.migration_name,checksum:r.checksum})),catalogRows:catalog.length,settingRows:settings.length,adminFixtureUnchanged:true,dryRunRolledBack:true,injectedFailureRolledBack:true,incompatibleReadModelRolledBack:true,concurrentApplied:outcomes.filter(x=>x.applied).length,concurrentIdempotent:outcomes.filter(x=>x.idempotent).length,repeatUnchanged:true,historyUnchanged:true,outboundCalls},null,2)+'\n')
})
