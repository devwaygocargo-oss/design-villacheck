import {knownApiPath} from '../../server/api-route-manifest.mjs';
import {withTiming,timed} from "../../server/vc04-timing.mjs";
import {attestRuntimeTarget} from "../../server/target-attestation.mjs";
import type { NextApiRequest,NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";
import {productionRuntimePolicy,productionRequestAllowed,isProductionRuntime} from "../../server/production-runtime.mjs";
// Compiled with Nest's decorator metadata by build:backend before next build.
import { createBackend } from "../../.build/backend/bootstrap.js";
let backend:ReturnType<typeof createBackend>|undefined;
export const config={api:{bodyParser:false,externalResolver:true},maxDuration:60};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 return withTiming(req,res,async()=>{
 res.setHeader("Cache-Control","no-store");
 try{
  const requestedPath=new URL(req.url||"/","http://localhost").pathname;
  if(!knownApiPath(requestedPath)){res.status(404).json({error:"ไม่พบ API"});return;}
  if(req.method==="HEAD")req.method="GET";
  const incomingUrl=new URL(req.url||"/","http://localhost");
  const attestation=await attestRuntimeTarget({method:req.method||"GET",path:incomingUrl.pathname,headers:req.headers,query:Object.fromEntries(incomingUrl.searchParams),env:process.env});
  if(attestation){res.status(attestation.status).json(attestation.body);return;}
  const policy=productionRuntimePolicy(process.env);
  if((isProductionRuntime(process.env)||policy.phase1)&&!productionRequestAllowed(req.method||"GET",new URL(req.url||"/","http://localhost").pathname,policy.releaseMode||(policy.phase1?"PHASE1":"PRELAUNCH"),policy)){res.status(503).json({error:"Production prelaunch: action disabled"});return;}
  backend ||= createBackend().catch((error:unknown)=>{backend=undefined;throw error;});
  const runtime=await timed("backendInit",()=>backend!);
  // Register with the request context while it is still alive. Registering only
  // after finish can lose the job when the serverless response is completed.
  const responseDone=new Promise<void>(resolve=>{
   const done=()=>{res.off("finish",done);res.off("close",done);resolve();};
   res.once("finish",done);res.once("close",done);
   if(res.writableFinished||res.destroyed)done();
  });
  waitUntil(responseDone.then(()=>runtime.domain.runOtpDeliveries()).catch(()=>console.error("OTP background delivery failed")));
  if(process.env.APP_ENV!=="production")waitUntil(responseDone.then(()=>runtime.domain.runMail()).catch(()=>console.error("Mail delivery failed")));
  await timed("application",()=>new Promise<void>((resolve,reject)=>{responseDone.then(resolve);runtime.handler(req,res,(error:unknown)=>error?reject(error):resolve());}));
 }catch{if(!res.headersSent)res.status(503).json({error:"Backend ไม่พร้อม กรุณาตรวจ PostgreSQL และ Admin config"});}
});
}
