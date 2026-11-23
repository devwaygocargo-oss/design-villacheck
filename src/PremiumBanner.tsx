import {uiText} from "./uiLanguage";
import {localeTag} from "./uiLanguage";
import { useCms } from "./cms";
import { usePackages, billingLabel, billingValidityLabel } from "./packagePlans";

export default function PremiumBanner({ onSelect }: { onSelect: (id: string) => void }) {
  const {business}=useCms();
  const { plans, error } = usePackages();
  const plan = [...plans].filter(p => p.isActive).sort((a, b) => b.amount - a.amount || b.capacity - a.capacity || b.sort_order - a.sort_order)[0];
  if (!plan) return error ? <p role="alert" className="merchant-panel">{uiText("โหลดแพ็กเกจแนะนำไม่สำเร็จ: ")}{uiText(error)}</p> : <p role="status">{uiText("กำลังโหลดแพ็กเกจแนะนำ…")}</p>;
  return <section className="premium-merchant-banner premium-package-promo" aria-label={uiText(`แพ็กเกจสูงสุด ${plan.name}`)}>
    <span className="premium-banner-emblem" aria-hidden="true">✦</span>
    <div className="premium-promo-copy"><small>{uiText("สำหรับ MERCHANT · แพ็กเกจสูงสุด")}</small>
      <h2>{plan.name}{uiText(" — ยกระดับความน่าเชื่อถือของธุรกิจ Villa")}</h2>
      <p>{(plan.amount / 100).toLocaleString(localeTag(), { style: "currency", currency: plan.currency })} / {billingLabel(plan.billingCycle)}{uiText(" · รองรับที่พักสูงสุด ")}{plan.capacity}{uiText(" แห่ง")}</p>
      {plan.amount > 0 && <p>{billingValidityLabel(plan.billingCycle,business)}</p>}
      <ul>{plan.features.map(feature => <li key={feature}>{uiText(feature)}</li>)}{plan.maximumVerificationLevel === "PREMIUM_VERIFIED" && <li>{uiText("สิทธิ์รับการตรวจสอบระดับ Premium")}</li>}</ul>
      <p className="premium-promo-note">{uiText("รับสิทธิ์การตรวจสอบระดับสูงสุด โดยต้องผ่านการตรวจเอกสารและอนุมัติจาก Admin")}</p>
    </div>
    <button className="white-button" onClick={() => onSelect(plan.id)}>{uiText("เลือก ")}{plan.name} →</button>
  </section>;
}
