# คู่มือ Admin — Phase 1 remediation candidate

สถานะ: ฉบับร่าง Staging closure candidate วันที่ 6 พฤศจิกายน 2026 ไม่รับรอง Production และไม่ให้อำนาจ cleanup หรือ deploy เพิ่มเติม

1. **เข้าสู่ระบบ Admin** ใช้หน้า /admin/login บัญชี Admin ที่ตรวจสิทธิ์แล้วเข้าสู่ Admin Dashboard session ของ User/Merchant แยกจาก Admin เอกสาร Admin ใช้ /api/admin/documents/ ไม่สลับไปใช้ cookie ของอีก role เพื่อให้เปิดไฟล์สำเร็จ
2. **ตรวจสื่อก่อนอนุมัติ** เปิดภาพจริงและตรวจความเกี่ยวข้อง ตรวจรูปปกและสื่อที่ส่งมา บันทึกผลตรวจรูปปกก่อนอนุมัติ Villa API ปฏิเสธการอนุมัติเมื่อ photoReviewedAt ยังว่าง ภาพใหม่หรือรูป gallery ที่เลือกเป็นรูปปกใหม่ต้องผ่านการตรวจรูปปกตามบริบทใหม่ การตรวจสื่อไม่ใช่การลบข้อมูลหรือขยาย entitlement
3. **กลั่นกรองรีวิว** ทุกแพ็กเกจเริ่ม pending ตรวจตามเนื้อหาและนโยบายเดียวกันทุกคะแนน Approve จึงเผยแพร่ Reject ต้องระบุเหตุผลและไม่แสดงสาธารณะ pending/rejected ไม่รวมคะแนนเฉลี่ย ผู้ประกอบการตอบได้เฉพาะรีวิวเผยแพร่ของที่พักตนเอง
4. **คำขอข้อมูลส่วนบุคคล** เปิดเมนูคำขอข้อมูลส่วนบุคคล กรอง Pending/In Progress/Completed/Rejected ตรวจประเภทคำขอและกำหนดตรวจสอบ บันทึกเหตุผลเมื่อรับงาน/ปิดงาน/ปฏิเสธ ระบบเก็บประวัติและ revision ปิด Completed ได้หลัง In Progress การเปลี่ยนสถานะไม่ส่งออก ไม่ลบ และไม่ทำ anonymization อัตโนมัติ ต้องดำเนิน privacy review ก่อนงานข้อมูลจริง
5. **รายงานปัญหา** ตรวจ Villa ID/QR และชื่อที่ระบบผูก ตัวตนจากบัญชีแยกจากชื่อที่ผู้แจ้งพิมพ์เอง ผู้ดูแลเท่านั้นที่อ่านข้อมูลผู้แจ้งได้ Anonymous ระบุชัดเจน บันทึกภายในไม่เผยแพร่สาธารณะ
6. **Production cleanup / release** คง public containment ของรายการทดสอบ ห้ามลบ Basic Grant หรือ entitlement ที่ยกเว้น แผนใหม่เสนอ 2 Villas/9 keys และ retention context เพื่อรักษาสิทธิ์อ่านสื่อ ต้องอนุมัติ exact set ใหม่และผ่าน identity/dependency/security/recovery preconditions ก่อน ไม่ใช้ผล synthetic เป็น Production PASS Cold Risk คง ACCEPTED TEMPORARILY และห้าม deploy Production ขณะ release gates ยังไม่ผ่าน

ภาพหน้าจอระบบจริงที่ทดสอบ Local: [Admin Dashboard](../reports/full-remediation-20261106/admin-dashboard-th-1440.png), [Privacy Mobile TH](../reports/full-remediation-20261106/privacy-admin-th-390.png), [Privacy Desktop EN](../reports/full-remediation-20261106/privacy-admin-en-1440.png)

รอรับมอบ: การตรวจรับเนื้อหาและการปฏิบัติงาน, ภาพ media review/เอกสารจริงที่ได้รับอนุญาต และการตรวจรับคู่มือ ห้ามอ้างภาพ Local ว่าแก้ข้อมูลหรือปล่อย Production แล้ว

หลักฐานปัจจุบัน: canonical Staging deployment `dpl_DNPBXRb7izuy21XwmXq7DG9jtJXP`, manifest และ regression อยู่ใน `reports/phase1-closure-20261106/` การทดสอบ live OTP/OAuth เดิมของ Owner คงไว้โดยไม่ทดสอบซ้ำ ไม่อ้างว่าเป็นหลักฐาน instrumented ใหม่ คู่มือยังเป็น DRAFT จนตรวจรับเนื้อหา
