import {usePublicLanguage} from "./publicLanguage";

export default function WebsiteQr() {
  const {locale} = usePublicLanguage();
  const english = locale === "en";
  return <section className="website-qr" aria-label={english ? "VillaCheck website QR code" : "QR code เข้าเว็บไซต์ VillaCheck"}>
    <strong>{english ? "Scan to visit VillaCheck" : "สแกนเข้าเว็บไซต์ VillaCheck"}</strong>
    <a className="website-qr-image" href="https://villacheckth.com" aria-label={english ? "Visit villacheckth.com" : "เข้าเว็บไซต์ villacheckth.com"}>
      <img src="/qr/villacheck-website.svg?v=2" width={198} height={198} alt={english ? "QR code for https://villacheckth.com" : "QR code สำหรับ https://villacheckth.com"}/>
    </a>
    <a className="website-qr-url" href="https://villacheckth.com">villacheckth.com</a>
    <div className="website-qr-downloads">
      <a className="website-qr-large" href="/qr/villacheck-website.png?v=2" target="_blank" rel="noopener noreferrer">{english ? "Open large QR" : "เปิด QR ขนาดใหญ่"}</a>
      <a href="/qr/villacheck-website.png?v=2" download="villacheck-website.png">{english ? "Download PNG" : "ดาวน์โหลด PNG"}</a>
      <a href="/qr/villacheck-website.svg?v=2" download="villacheck-website.svg">{english ? "Download SVG" : "ดาวน์โหลด SVG"}</a>
    </div>
  </section>;
}
