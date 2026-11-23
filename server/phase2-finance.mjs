const fail=message=>{throw Object.assign(Error(message),{status:409});};
// Explicit inputs only: no VAT rate, period boundary or rounding default.
export function inclusiveSatang(total,rateBasisPoints,rounding){
 if(!Number.isSafeInteger(total)||total<0||!Number.isInteger(rateBasisPoints)||rateBasisPoints<0||rateBasisPoints>10000||!['HALF_UP','HALF_EVEN','DOWN'].includes(rounding))fail('Finance rate and rounding policy required');
 const numerator=BigInt(total)*BigInt(rateBasisPoints),denominator=10000n+BigInt(rateBasisPoints);
 let vat=numerator/denominator;const remainder=numerator%denominator;
 if(rounding==='HALF_UP'&&remainder*2n>=denominator||rounding==='HALF_EVEN'&&(remainder*2n>denominator||remainder*2n===denominator&&vat%2n===1n))vat++;
 return {totalSatang:total,vatSatang:Number(vat),netSatang:total-Number(vat)};
}
// Inactive VAT-exclusive arithmetic; rate/rounding must be supplied by Finance.
// Does not authorize quotes, payment collection or changes to historical snapshots.
export function exclusiveSatang(net,rateBasisPoints,rounding){
 if(!Number.isSafeInteger(net)||net<0||!Number.isInteger(rateBasisPoints)||rateBasisPoints<0||rateBasisPoints>10000||!['HALF_UP','HALF_EVEN','DOWN'].includes(rounding))fail('Finance rate and rounding policy required');
 const numerator=BigInt(net)*BigInt(rateBasisPoints),denominator=10000n;
 let vat=numerator/denominator;const remainder=numerator%denominator;
 if(rounding==='HALF_UP'&&remainder*2n>=denominator||rounding==='HALF_EVEN'&&(remainder*2n>denominator||remainder*2n===denominator&&vat%2n===1n))vat++;
 const total=BigInt(net)+vat;if(total>BigInt(Number.MAX_SAFE_INTEGER))fail('Finance total exceeds safe integer range');
 return {netSatang:net,vatSatang:Number(vat),totalSatang:Number(total)};
}
export function monthlyQuote(plan,prices,p){
 if(!Object.hasOwn(prices,plan))throw Object.assign(Error('Unknown package'),{status:400});
 if(p.billingCycle!=='MONTHLY'||p.vatMode!=='INCLUSIVE'||p.billingUnit!=='VILLA'||p.monthlyBoundary!=='EXPLICIT_ELAPSED_DAYS'||!Number.isInteger(p.billingDays)||p.billingDays<28||p.billingDays>31||!p.financeApprovalReference?.trim()||p.paidStartRule!=='AFTER_TRIAL_OR_SETTLEMENT')fail('Monthly Finance boundary/unit/rate/rounding/invoice confirmation pending');
 const amount=prices[plan],money=inclusiveSatang(amount,p.vatBasisPoints,p.vatRoundingPolicy);
 if(p.invoiceRequirementsConfirmed!==true)fail('Finance invoice requirements pending');
 return {switchingPolicy:{version:1,effective:'CONFIRMED_SUCCESS_IMMEDIATE',refund:'NONE',unusedDaysCarryover:0,balanceCarryoverSatang:0,proration:'NONE',approvalReference:'BUSINESS_OWNER_FINAL_DECISIONS_20261117'},...money,listSatang:amount,currency:'THB',billingCycle:'MONTHLY',billingUnit:p.billingUnit,billingDays:p.billingDays,monthlyBoundary:p.monthlyBoundary,vatMode:'INCLUSIVE',vatBasisPoints:p.vatBasisPoints,vatRoundingPolicy:p.vatRoundingPolicy,financeApprovalReference:p.financeApprovalReference,invoiceRequirementsConfirmed:true,policyRevision:p.revision,paidStartRule:p.paidStartRule};
}
export function assertPhase2OrderTerms(order){
 if(order.billingCycle!=='MONTHLY'||order.vatMode!=='INCLUSIVE'||order.monthlyBoundary!=='EXPLICIT_ELAPSED_DAYS'||order.billingUnit!=='VILLA'||!Number.isInteger(order.billingDays)||order.billingDays<28||order.billingDays>31||!order.financeApprovalReference?.trim()||order.invoiceRequirementsConfirmed!==true)fail('Existing order terms require Finance review; history preserved');
 const money=inclusiveSatang(order.listSatang,order.vatBasisPoints,order.vatRoundingPolicy);
 if(money.totalSatang!==order.totalSatang||money.vatSatang!==order.vatSatang||money.netSatang!==order.netSatang)fail('Order Finance snapshot mismatch');
}
