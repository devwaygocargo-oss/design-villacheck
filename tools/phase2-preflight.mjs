import {phase2Runtime} from '../server/phase2-policy.mjs';
import {phase2OperationsPreflight} from '../server/phase2-operations-config.mjs';
try{
 // Read injected environment only. Do not load files, connect or print secrets.
 phase2Runtime(process.env);
 console.log(JSON.stringify(phase2OperationsPreflight(process.env),null,2));
}catch{
 console.log(JSON.stringify({status:'BLOCKED',reason:'INVALID_CONFIGURATION',networkCalls:0,externalEmailSent:0}));process.exitCode=1;
}
