import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import{randomBytes,randomUUID}from'node:crypto';
import {fixture,approvedTestBilling} from './fixture.mjs';import {openPostgres} from '../../server/postgres.mjs';
import {exportSnapshot,readSnapshot,restoreSnapshot,durableTables,transientTables} from '../../tools/application-backup.mjs';
import {requirePhase2} from '../../server/phase2-policy.mjs';import {phase2Environment,verifyPhase2SyntheticDatabase} from '../../server/phase2-environment.mjs';
test('Handover isolation contract rejects Production/Staging and unsafe local bindings without opening connections',()=>{
 for(const appEnvironment of ['production','staging'])assert.throws(()=>requirePhase2({phase2Enabled:true,appEnvironment}),e=>e.status===503);
 const env={APP_ENV:'phase2-local',DATABASE_URL:'postgresql://synthetic:unused@127.0.0.1:5432/local?schema=p2_'+ 'a'.repeat(32),APP_URL:'http://127.0.0.1:8443',PHASE2_ENABLED:'true',PAYMENT_ACCESS_MODE:'DISABLED',SEED_DEMO_ACCOUNTS:'false',SEED_PUBLIC_DEMO_DATA:'false',OTP_SECRET:'SYNTHETIC_LOCAL_ONLY_SECRET_'+'x'.repeat(32)};
 assert.equal(phase2Environment(env).APP_ENV,'phase2-local');for(const change of [{DATABASE_URL:'postgresql://synthetic:unused@example.invalid/db'},{APP_URL:'https://www.villacheckth.com'},{SEED_DEMO_ACCOUNTS:'true'},{SEED_PUBLIC_DEMO_DATA:'true'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'},{SMTP_HOST:'smtp.synthetic.invalid'},{VERCEL_PROJECT_ID:'unapproved'}])assert.throws(()=>phase2Environment({...env,...change}));
});
test('Local encrypted backup/recovery retains Phase 2 ledger, QR/snapshots and audit history, excludes sessions, rejects tampering and nonempty/remote restore',async t=>{
 const f=await fixture();t.after(f.close);await f.setPolicy(approvedTestBilling);await f.expect('/phase2/trial',{villaId:f.villas[0].id},f.sessions.admin);await f.settle((await f.buy(f.villas[0],'premium')).order);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vc-handover-backup-')),file=path.join(dir,'synthetic.vcb'),secret=randomBytes(48).toString('hex'),schema='restore_'+randomUUID().replaceAll('-','');let restored;
 try{
  const saved=await exportSnapshot(f.url,file,secret,{schema:f.schema});assert.equal(saved.tables,durableTables.length);assert.equal(readSnapshot(file,secret).format,1);assert.throws(()=>readSnapshot(file,randomBytes(48).toString('hex')));
  await f.db.exec('CREATE SCHEMA '+schema);restored=await openPostgres(f.url,{options:'-c search_path='+schema,bootstrap:false});await restored.exec(fs.readFileSync('server/postgres-schema.sql','utf8'));await restored.exec(fs.readFileSync('server/business-schema.sql','utf8'));
  const result=await restoreSnapshot(f.url,file,secret,{schema});assert.equal(result.transientSessionsRestored,false);assert.equal(result.rows,saved.rows);
  for(const table of durableTables){const a=await f.db.prepare('SELECT * FROM '+table).all(),b=await restored.prepare('SELECT * FROM '+table).all();const normalize=rows=>rows.map(row=>JSON.stringify(row)).sort();assert(JSON.stringify(normalize(a))===JSON.stringify(normalize(b)),'Restored durable table differs: '+table);}
  for(const table of transientTables)assert.equal((await restored.prepare('SELECT count(*)::int n FROM '+table).get()).n,0);
  await assert.rejects(restoreSnapshot(f.url,file,secret,{schema}),/empty/);await assert.rejects(restoreSnapshot('postgresql://synthetic:unused@example.invalid/unapproved',file,secret),/Remote restore/);
  const bytes=fs.readFileSync(file);bytes[bytes.length-1]^=1;fs.writeFileSync(file,bytes);assert.throws(()=>readSnapshot(file,secret));
  await verifyPhase2SyntheticDatabase(f.db);await f.db.prepare("UPDATE users SET email='not-synthetic@example.invalid' WHERE id=?").run(f.users.foreign.id);await assert.rejects(verifyPhase2SyntheticDatabase(f.db),/Non-synthetic/);
 }finally{await restored?.close();await f.db.exec('DROP SCHEMA IF EXISTS '+schema+' CASCADE');fs.rmSync(dir,{recursive:true,force:true});}
});
