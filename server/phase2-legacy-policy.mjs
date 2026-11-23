// Phase2 has its own audited Sandbox ledger. Never mutate legacy commercial
// records via old URLs while the new unit/transition policies remain unresolved.
export function phase2LegacyWriteBlocked(config,method,path){
 return config.phase2Enabled===true&&!['GET','HEAD'].includes(method)&&path.startsWith('/api/')&&/^(?:merchant\/villa-package|subscription(?:\/|$)|payments(?:\/|$)|invoices(?:\/|$)|omise(?:\/|$)|admin\/(?:basic-promotion|packages|package-entitlements|package-promotions|promotions|payments|subscriptions)(?:\/|$))/.test(path.slice(5));
}
