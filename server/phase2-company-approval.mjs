import {createHash} from 'node:crypto';
import {exclusiveSatang} from './phase2-finance.mjs';
import {phase2Prices} from './phase2-policy.mjs';
import {simulateCompanyApprovalPeriod} from './phase2-game-responses.mjs';
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
export const approvalReviewDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Server-only synthetic Finance inputs. Never a Finance sign-off or settlement adapter.
export function companyApprovalPreview(request,terms,now){
 if(terms?.simulationOnly!==true||terms.billingUnit!=='VILLA'||typeof terms.reference!=='string'||!terms.reference.startsWith('SYNTHETIC_'))fail('Explicit synthetic Finance preview terms required');
 if(!request||request.status!=='PENDING_REVIEW'||!Object.hasOwn(phase2Prices,request.packageId))fail('Pending package request required');
 const period=simulateCompanyApprovalPeriod(now),money=exclusiveSatang(phase2Prices[request.packageId],terms.vatBasisPoints,terms.vatRoundingPolicy);
 return {requestId:request.id,revision:request.revision,packageId:request.packageId,currency:'THB',vatMode:'EXCLUSIVE',...money,vatBasisPoints:terms.vatBasisPoints,vatRoundingPolicy:terms.vatRoundingPolicy,period,simulationOnly:true,companyApproved:false,financeSignOff:false,financialActionsEnabled:false,entitlementCreated:false};
}
