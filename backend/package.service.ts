import {phase2Prices} from "../server/phase2-policy.mjs";
import {listPlans} from "../server/catalog.mjs";
import {Injectable} from "@nestjs/common";
import {PrismaDatabaseService} from "./prisma.service.js";
import {DomainService} from "./domain.service.js";
import {productionRuntimePolicy,phase1PackageDisplay} from "../server/production-runtime.mjs";
@Injectable()
export class PackageService {
 constructor(private readonly database:PrismaDatabaseService,private readonly domain:DomainService){}
 async listActive(){
  await this.domain.ready();
  const plans=await listPlans(this.database);
  return {packages:productionRuntimePolicy(process.env).phase1?plans.map(phase1PackageDisplay):plans,...(["phase2-local","phase2-preview"].includes(process.env.APP_ENV||"")?{phase2:{environment:"SANDBOX",packages:Object.entries(phase2Prices).map(([id,amountSatang])=>({id,amountSatang,currency:"THB"}))}}:{})};
 }
}
