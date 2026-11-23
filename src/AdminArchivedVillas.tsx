import {useEffect, useState} from "react";
import {api, ApiError} from "./api";
import type {MerchantVilla, Store} from "./merchantStore";
import {PortalShell, type Page} from "./prototype";
import {usePublicLanguage} from "./publicLanguage";
import ListPagination from "./ListPagination";
import VillaArchiveAction from "./VillaArchiveAction";

export default function AdminArchivedVillas({go}: {go: (page: Page, item?: string) => void}) {
  const {locale} = usePublicLanguage();
  const en = locale === "en";
  const [villas, setVillas] = useState<MerchantVilla[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    void api<Store>("/state").then(state => {
      if (active) setVillas(state.villas.filter(villa => villa.archived));
    }).catch(error => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) go("admin-login");
      else setFailed(true);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const search = query.trim().toLocaleLowerCase();
  const visible = villas.filter(villa => [villa.name, villa.nameEn, villa.province, villa.merchant, villa.email, villa.qr].some(value => value.toLocaleLowerCase().includes(search)));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 10)));
  return <PortalShell role="Admin" page="admin-archived-villas" go={go}>
    <div className="portal-head"><div><h1>{en ? "Archived properties" : "ที่พัก Archived"}</h1><p>{en ? "Properties removed from active listings. View details or restore a property." : "ที่พักที่นำออกจากรายการใช้งาน สามารถดูรายละเอียดหรือคืนรายการได้"}</p></div><button type="button" className="outline-button" disabled={loading} onClick={() => setRevision(value => value + 1)}>{en ? "Refresh" : "อัปเดตรายการ"}</button></div>
    <section className="merchant-panel portal-form archived-villa-search">
      <label>{en ? "Search archived properties" : "ค้นหาที่พัก Archived"}<input type="search" value={query} onChange={event => {setQuery(event.target.value); setPage(1);}} placeholder={en ? "Property, merchant, province or QR" : "ชื่อที่พัก ผู้ประกอบการ จังหวัด หรือ QR"}/></label>
      <p role="status">{loading ? (en ? "Loading…" : "กำลังโหลดรายการ…") : failed ? (en ? "Could not refresh the list" : "อัปเดตรายการไม่สำเร็จ") : (en ? `Archived ${villas.length} properties · Showing ${visible.length}` : `Archived ${villas.length} รายการ · แสดง ${visible.length} รายการ`)}</p>
    </section>
    {failed && <div className="form-message" role="alert">{en ? "Could not load archived properties. Please try again." : "โหลดรายการ Archived ไม่สำเร็จ กรุณาลองใหม่"} <button type="button" onClick={() => setRevision(value => value + 1)}>{en ? "Try again" : "ลองใหม่"}</button></div>}
    {restored && <p role="status">{en ? "Property restored. It is no longer in Archived." : "คืนรายการแล้ว ที่พักถูกนำออกจากรายการ Archived"}</p>}
    {!loading && !failed && !visible.length && <section className="merchant-panel archived-villa-empty">{search ? (en ? "No matching archived properties" : "ไม่พบที่พัก Archived ที่ตรงกับการค้นหา") : (en ? "No archived properties" : "ยังไม่มีที่พัก Archived")}</section>}
    <ListPagination page={currentPage} total={visible.length} pageSize={10} onPage={setPage} disabled={loading}/>
    <div className="approved-villa-grid archived-villa-grid">
      {visible.slice((currentPage - 1) * 10, currentPage * 10).map(villa => <article key={villa.id} className="merchant-panel archived-villa" data-villa-id={villa.id}>
        <span className="merchant-status">Archived</span><h2>{en && villa.nameEn ? villa.nameEn : villa.name}</h2>
        <p>{villa.province} · {villa.merchant}</p><p>{villa.qr}</p>
        <button type="button" className="outline-button" onClick={() => go("admin-villa-page", villa.id)}>{en ? "View property details" : "ดูรายละเอียดที่พัก"}</button>
        <VillaArchiveAction id={villa.id} name={villa.name} admin onChanged={() => {setVillas(current => current.filter(item => item.id !== villa.id)); setRestored(true); setRevision(value => value + 1);}}/>
      </article>)}
    </div>
  </PortalShell>;
}
