"use client";
import dynamic from "next/dynamic";
const VillaCheck = dynamic(() => import("../src/App"), {ssr:false,loading:()=><main data-villacheck-loading><h1>VillaCheck — ตรวจสอบข้อมูลที่พักก่อนโอนเงิน</h1><p>ค้นหาที่พัก ตรวจสอบสถานะ QR และเปรียบเทียบข้อมูลบัญชีก่อนชำระเงิน ผลการตรวจสอบไม่ใช่การรับประกันการจองหรือการชำระเงิน</p><nav aria-label="เมนูหลัก"><a href="/#page=directory">ค้นหาที่พัก</a> · <a href="/#page=scan">ตรวจสอบ QR</a> · <a href="/#page=privacy">นโยบายความเป็นส่วนตัว</a></nav></main>});
export default function HomePage() { return <VillaCheck />; }
