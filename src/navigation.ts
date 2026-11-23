import {useUiLanguage} from './uiLanguage';
import { useEffect, useState } from "react";
const pages = new Set(["admin-tickets","admin-audit-log","user-membership","owner-membership","admin-membership","business-owner-workspace","admin-archived-villas","not-found","admin-villa-page","admin-advertising","admin-reviews","admin-owner-verification","admin-receiving-bank","admin-approved-villas","admin-verify","admin-pending-villas","admin-login","admin-cms", "cms-page", "user-registration", "admin-users", "admin-leads", "admin-settings", "admin-payments", "admin-subscriptions", "home", "directory", "detail", "scan", "verify", "pricing", "login", "about", "verification-standard", "articles", "article-detail", "owner-guide", "help", "contact", "privacy", "terms", "social-facebook", "social-instagram", "social-line", "gallery", "owner-auth", "owner-registration", "owner-information", "owner-onboarding-villa", "package-confirmation", "owner-select-villa", "package-request-pending", "owner-profile", "owner-dashboard", "owner-villas", "owner-villa-detail", "owner-villa-edit", "owner-add-villa", "owner-preview", "owner-pending", "owner-analytics", "owner-reports", "owner-package", "user-profile", "user-dashboard", "user-checks", "user-check-detail", "user-reports", "user-report-detail", "user-precheck", "user-check-success", "villa-report", "villa-report-success", "admin-dashboard", "admin-owners", "admin-villas", "admin-checks", "admin-reports", "admin-qr", "admin-packages"]);
const adminReturnKey="villacheck-admin-return";
const returnableAdmin=(page:string)=>pages.has(page)&&page.startsWith("admin-")&&!["admin-login","admin-verify","admin-villa-page"].includes(page);
export function lastAdminPage(){
 try{const saved=JSON.parse(sessionStorage.getItem(adminReturnKey)||"null");if(saved&&returnableAdmin(saved.page)&&typeof saved.item==="string")return {page:saved.page as import("./prototype").Page,item:saved.item};}catch{/* Storage may be unavailable in private browsing. */}
 return {page:"admin-approved-villas" as import("./prototype").Page,item:""};
}
function rememberAdminPage(location:{page:string;item:string}){
 try{if(location.page==="admin-login")sessionStorage.removeItem(adminReturnKey);else if(returnableAdmin(location.page))sessionStorage.setItem(adminReturnKey,JSON.stringify(location));}catch{/* Storage may be unavailable in private browsing. */}
}
function readLocation() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const requestedAdmin = params.get("page")?.startsWith("admin-");
  const adminPath = /^\/admin(?:\/|$)/.test(window.location.pathname);
  if(adminPath && params.has("page") && !requestedAdmin){window.location.replace("/#"+params);return {page:"home",item:""};}
  if(requestedAdmin && !adminPath){window.location.replace("/admin/login");return {page:"admin-login",item:""};}
  if(window.location.pathname === "/admin/login")return {page:"admin-login",item:""};
  const requested = params.get("page") || (window.location.pathname === "/dashboard" ? "user-dashboard" : window.location.pathname === "/merchant" ? "owner-dashboard" : window.location.pathname === "/owner" ? "business-owner-workspace" : "") || (window.location.pathname === "/admin/login" ? "admin-login" : window.location.pathname === "/admin" ? "admin-cms" : window.location.pathname === "/login" ? "login" : "home");
  const page = requested === "admin-review" ? "admin-pending-villas" : requested;
  return { page: pages.has(page) ? page : "not-found", item: params.get("item") || "" };
}
export function usePageNavigation<T extends string>() {
  const {locale}=useUiLanguage();
  const [location, setLocation] = useState(readLocation);
  useEffect(()=>{rememberAdminPage(location)},[location.page,location.item]);
  useEffect(()=>{
    let focused=false;
    const meaningful=(node:HTMLElement)=>!node.closest("[data-villacheck-loading]")&&!/^(กำลังโหลด|Loading|Please wait)/i.test(node.textContent?.trim()||"");
    const sync=()=>{const target=[...document.querySelectorAll<HTMLElement>("main h1, .portal-content h1")].find(meaningful)||[...document.querySelectorAll<HTMLElement>("main h2, .portal-content h2")].find(meaningful);if(!target)return;const title=(target.textContent?.trim().slice(0,100)||"VillaCheck")+" | VillaCheck";if(document.title!==title)document.title=title;if(!focused){focused=true;target.setAttribute("tabindex","-1");target.focus({preventScroll:true});}};
    // Hash routes share one Next page. Keep its title aligned after asynchronous
    // headings and Next metadata hydration without moving focus a second time.
    const content=new MutationObserver(sync),metadata=new MutationObserver(sync);content.observe(document.body,{childList:true,subtree:true,characterData:true});metadata.observe(document.head,{childList:true,subtree:true,characterData:true});const frame=requestAnimationFrame(sync);
    return()=>{cancelAnimationFrame(frame);content.disconnect();metadata.disconnect();};
  },[location.page,location.item,locale]);
  useEffect(() => {
    const restore = () => { setLocation(readLocation()); window.scrollTo(0, 0); };
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, []);
  const navigate = (page: T, item = "") => {
    if (!pages.has(page)) return;
    const params = new URLSearchParams({ page });
    if (item) params.set("item", item);
    const base = page === "business-owner-workspace" ? "/owner" : page.startsWith("user-") && page !== "user-registration" ? "/dashboard" : page.startsWith("owner-") && !["owner-auth","owner-registration","owner-guide"].includes(page) ? "/merchant" : "/";
    const hash = page === "admin-login" ? "/admin/login" : page.startsWith("admin-") ? `/admin#${params}` : `${base}${base === "/owner" && new URLSearchParams(window.location.search).get("context")==="admin" ? "?context=admin" : ""}${base === "/" && window.location.pathname === "/" ? window.location.search : ""}#${params}`;
    if(/^\/admin(?:\/|$)/.test(window.location.pathname) !== page.startsWith("admin-")){window.location.assign(hash);return;}
    if (window.location.pathname + window.location.hash !== hash) window.history.pushState(null, "", hash);
    setLocation({ page, item });
    window.dispatchEvent(new Event("app-navigation"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return [location.page as T, navigate, location.item] as const;
}
