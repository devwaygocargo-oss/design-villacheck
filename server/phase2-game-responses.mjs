
// Local synthetic acceptance only. This is a response record, not Finance/Prin approval.
export const gameResponseReference='USER_RELAY_GAME_20261118_SIX_RESPONSES';
export async function gameResponsesEnabled(db,config){
 void db;void config;return false; // Superseded by consolidated enforced business requirements.
}
export function gameResponsePolicy(policy){
 return {...policy,vatBasisPoints:null,vatRoundingPolicy:null,financeApprovalReference:null,invoiceRequirementsConfirmed:false,billingUnit:null,monthlyBoundary:null,vatMode:'EXCLUSIVE',billingDays:30,paidStartRule:'COMPANY_APPROVAL',premiumChannels:['facebook'],publicPromotions:false,homeSlots:null,homeRotation:null};
}
// Pure period simulation; caller-supplied timestamp is not proof of company approval.
export function simulateCompanyApprovalPeriod(approvedAt){
 if(typeof approvedAt!=='string'||!Number.isFinite(Date.parse(approvedAt))||new Date(approvedAt).toISOString()!==approvedAt)throw new Error('Explicit company approval timestamp required');
 const end=Date.parse(approvedAt)+30*86400000;if(!Number.isFinite(new Date(end).getTime()))throw new Error('Invalid period');
 return {startsAt:approvedAt,endsAt:new Date(end).toISOString(),days:30,simulationOnly:true,enforcement:false};
}
