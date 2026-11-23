import type {ReactNode} from "react";
// Public signup is open. The server still enforces OTP and review permissions.
export default function MerchantRegistrationGate({children}:{onBack:()=>void;children:ReactNode}){
 return <>{children}</>;
}
