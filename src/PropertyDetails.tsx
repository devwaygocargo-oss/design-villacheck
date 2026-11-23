import {uiText} from "./uiLanguage";
import {getLocale} from "./uiLanguage";
import {propertyCount} from "./propertyFacts";
export type Details={isDemo:boolean;description:string;location:string;guestCapacity:number;bedrooms:number;bathrooms:number;amenities:string[];checkIn:string;checkOut:string;rules:string[];notice:string};
type DisplayDetails=Omit<Details,"guestCapacity"|"bedrooms"|"bathrooms"> & {guestCapacity?:number|null;bedrooms?:number|null;bathrooms?:number|null};
export default function PropertyDetails({details:d}:{details:DisplayDetails}){
  return <div className="property-full-details">
    {d.notice&&<p className="verification-reminder property-details-notice">{d.notice}</p>}
    {d.description&&<section className="property-about"><h2>{uiText("เกี่ยวกับที่พัก")}</h2><p>{d.description}</p></section>}
    <dl className="property-facts">{[[uiText("ผู้เข้าพัก"),propertyCount(d.guestCapacity,"guests",getLocale())],[uiText("ห้องนอน"),propertyCount(d.bedrooms,"rooms",getLocale())],[uiText("ห้องน้ำ"),propertyCount(d.bathrooms,"rooms",getLocale())],[uiText("เช็กอิน / เช็กเอาต์"),`${d.checkIn||"—"} / ${d.checkOut||"—"}`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {!!d.amenities.length&&<section className="property-amenities-section"><h2>{uiText("สิ่งอำนวยความสะดวก")}</h2><ul className="property-amenities">{d.amenities.map((item,index)=><li key={index}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>}
    {!!d.rules.length&&<section className="property-rules-section"><h2>{uiText("ข้อกำหนดการเข้าพัก")}</h2><ul>{d.rules.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
    {d.location&&<section className="property-location-section"><h2>{uiText("ทำเลที่พัก")}</h2><p>{d.location}</p></section>}
  </div>
}
