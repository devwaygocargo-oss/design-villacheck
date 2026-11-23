import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('Evidence inventory verification works outside the repo without private reports or Git history',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vc-evidence-portability-'));
 try{
  for(const name of ['reproduce-release-evidence.mjs','release-evidence-inventory.json'])fs.copyFileSync(new URL(name,import.meta.url),path.join(dir,name));
  const before=fs.readdirSync(dir).sort();const output=execFileSync(process.execPath,[path.join(dir,'reproduce-release-evidence.mjs'),'--verify-inventory'],{cwd:dir,encoding:'utf8'});
  assert.deepEqual(JSON.parse(output),{artifacts:48,standalone:true});assert.deepEqual(fs.readdirSync(dir).sort(),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
