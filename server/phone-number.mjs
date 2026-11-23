// Shared pure validation; no provider, database or environment dependencies.
/** @param {unknown} value @returns {string|null} */
export function normalizeProfileOtpPhone(value){
 if(typeof value!=='string'||value.length>40)return null;
 let phone=value.trim().replace(/[ ()-]/g,'');
 if(/^0/.test(phone)){if(!/^0[689]\d{8}$/.test(phone))return null;phone='+66'+phone.slice(1);}
 if(phone.startsWith('+66'))return /^\+66[689]\d{8}$/.test(phone)?phone:null;
 return /^\+[1-9]\d{7,14}$/.test(phone)?phone:null;
}
