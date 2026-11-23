import {uiText} from "./uiLanguage";
import { useCms,useCopy,usePresentation } from "./cms";
import { useState } from "react";
import usePublishedProvinces from "./usePublishedProvinces";

export const popularProvinces = ["ชลบุรี", "ประจวบคีรีขันธ์", "นครราชสีมา", "ภูเก็ต", "เชียงใหม่", "กระบี่", "สุราษฎร์ธานี", "ระยอง", "เพชรบุรี", "กรุงเทพมหานคร"];
export const googleMapsUrl = (province: string) => `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${province} ประเทศไทย` })}`;
function Pin() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>; }

const pinPositions = [
  [28, 46], [27, 63], [72, 29], [30, 80], [28, 12],
  [71, 80], [72, 63], [73, 46], [27, 29], [70, 12],
];

export default function ProvinceExplorer({ onSearch }: { onSearch: (query: string, province: string) => void }) {
  const t=useCopy(),provinces=usePublishedProvinces();
  const {home}=useCms();const section=home.sections.find(s=>s.id==="provinces");
  const [chosen, setSelected] = useState("");
  const selected=provinces.includes(chosen)?chosen:provinces[0]||"";
  const openProvince = (province: string) => {
    setSelected(province);
    onSearch("", province);
  };
  return (
    <section className="section province-section">
      <div className="container province-layout">
        <div className="province-copy">
          <span className="kicker">{t("home.provinceKicker")}</span>
          <h2 style={{whiteSpace:"pre-line"}}>{uiText(section?.title||uiText("เริ่มจากจุดหมาย\nที่คุณกำลังจะไป"))}</h2>
          <p role={provinces.length?undefined:"status"}>{provinces.length?uiText(section?.description||uiText("เลือกจังหวัดหรือกดหมุดบนแผนที่ เพื่อดู Villa ในจังหวัดนั้น พร้อมตัวกรองที่พักทันที")):uiText("ยังไม่มีที่พักที่พร้อมแสดงในขณะนี้")}</p>
          <div className="province-chips">
            {provinces.map(province => (
              <button key={province} className={province === selected ? "active" : ""} onClick={() => openProvince(province)}>
                <Pin />{uiText(province)}
              </button>
            ))}
          </div>
          {selected&&<a className="province-google-link" href={googleMapsUrl(selected)} target="_blank" rel="noopener noreferrer">{uiText("ดู")}{uiText(selected)}{uiText("บน Google Maps ↗")}</a>}
        </div>
        <div className="province-map province-map-destinations" role="group" aria-label={uiText(`ปักหมุดจุดหมาย ${provinces.length} จังหวัด คลิกเพื่อดู Villa`)}>
          <div className="map-route route-one" aria-hidden="true" />
          <div className="map-route route-two" aria-hidden="true" />
          {provinces.slice(0,pinPositions.length).map((province, index) => (
            <button
              className={`map-pin province-destination-pin ${province === selected ? "selected" : ""}`}
              key={province}
              style={{ left: `${pinPositions[index][0]}%`, top: `${pinPositions[index][1]}%` }}
              onClick={() => openProvince(province)}
              aria-label={uiText(`ดู Villa ในจังหวัด${uiText(province)}`)}
            >
              <i aria-hidden="true" />
              <span>{uiText(province)}<small>{uiText("ดู Villa ในจังหวัด →")}</small></span>
            </button>
          ))}
          <div className="map-index"><span>{uiText("POPULAR DESTINATIONS")}</span><span>{provinces.length}{uiText(" จังหวัด · ")}{t("home.provinceMap")}</span></div>
        </div>
      </div>
    </section>
  );
}
