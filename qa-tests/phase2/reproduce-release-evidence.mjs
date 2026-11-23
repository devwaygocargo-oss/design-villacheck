// Local synthetic acceptance only. Never restore/overwrite historical evidence.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import inventory from './release-evidence-inventory.json' with {type:'json'};
if(!Array.isArray(inventory)||inventory.length!==48||new Set(inventory).size!==inventory.length||inventory.some(name=>typeof name!=='string'||!/^[A-Za-z0-9._-]+$/.test(name)))throw Error('Invalid tracked evidence inventory');
if(process.argv.includes('--verify-inventory')){console.log(JSON.stringify({artifacts:inventory.length,standalone:true}));process.exit(0);}
const output=process.argv[2];if(!output)throw Error('Provide a NEW evidence directory under existing reports');
const root=path.resolve(output);if(fs.existsSync(root))throw Error('Refusing to overwrite an existing evidence directory');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();if(dirty)throw Error('Commit reviewed source before capturing exact-SHA evidence');
const groups={
 'integrated-browser':name=>name.startsWith('integrated-'),
 'fullstack':name=>name.startsWith('fullstack'),
 'browser':name=>['browser-server.log','browser.json','phase2-1440.png','phase2-390.png','review-hidden-1440.png','review-hidden-390.png'].includes(name),
 'omise-browser':name=>name.startsWith('omise-'),
 'approved-decisions-browser':name=>name.startsWith('approved-')||name.startsWith('final-'),
 'game-responses-browser':()=>false,
};
fs.mkdirSync(root);const results=[],artifacts=[];
for(const [suite,match]of Object.entries(groups)){
 const suiteDir=path.join(root,suite);fs.mkdirSync(suiteDir);const log=path.join(suiteDir,'execution.log'),fd=fs.openSync(log,'wx');
 const started=Date.now();console.log('Running '+suite);
 const child=spawn(process.execPath,['qa-tests/phase2/run.mjs','--evidence-browser='+suite],{stdio:['ignore',fd,fd]});
 const code=await new Promise((resolve,reject)=>{child.once('exit',c=>resolve(c??1));child.once('error',reject)});fs.closeSync(fd);
 const files=inventory.filter(match);
 if(suite==='game-responses-browser')files.push('game-responses-browser.json','game-responses-server.log',...['admin','merchant'].flatMap(role=>[1440,390].map(width=>'game-responses-'+role+'-'+width+'.png')));
 let error=null;let assertions=0;
 try{
  if(code!==0)throw Error('Suite process failed; inspect retained execution log');
  const summary=JSON.parse(fs.readFileSync(path.join('qa-evidence',suite+'.json')));assertions=summary.rows.length;
  const expected={'integrated-browser':34,'fullstack':12,'browser':20,'omise-browser':2,'approved-decisions-browser':12,'game-responses-browser':18}[suite];
  if(assertions!==expected||summary.rows.some(row=>row.status!=='PASS'))throw Error('Unexpected or incomplete browser assertions');
  for(const name of files){const from=path.join('qa-evidence',name),to=path.join(suiteDir,name);if(fs.statSync(from).mtimeMs<started)throw Error('Stale artifact: '+name);const data=fs.readFileSync(from);fs.writeFileSync(to,data,{flag:'wx'});artifacts.push({historicalFile:suite==='game-responses-browser'?null:'source-browser/'+name,file:path.relative(root,to),sha256:createHash('sha256').update(data).digest('hex'),source,status:'REPRODUCED_CURRENT_SOURCE_NOT_HISTORICAL_RECOVERY'});}
 }catch(e){error=e.message;}
 const row={suite,assertions,executionLogSha256:createHash('sha256').update(fs.readFileSync(log)).digest('hex'),exitCode:code,status:error?'FAIL':'PASS',error,source,syntheticOnly:true};results.push(row);fs.writeFileSync(path.join(suiteDir,'result.json'),JSON.stringify(row,null,2)+'\n',{flag:'wx'});console.log(suite+': '+row.status);
}
const drift=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==source||Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim());
const manifest={source,sourceDrift:drift,results,artifacts,historicalOriginalsRecovered:false,productionAcceptance:false,realProviderAcceptance:false,physicalDeviceAcceptance:false,scope:'Synthetic loopback PostgreSQL and Chrome viewports. Mocked provider UI. New artifacts do not recover or validate lost historical bytes.'};
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
process.exitCode=drift||results.some(r=>r.status!=='PASS')?1:0;
