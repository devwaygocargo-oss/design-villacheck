import {assertWriteSession} from './write-session.mjs';
import {validateCmsImage} from './cms-image-validation.mjs';
import { randomUUID } from "node:crypto"
import { audit } from "./database.mjs"
import { initializeCmsChanges, recordCmsChange } from "./cms-change-history.mjs"
import { CMS_IMAGE_MAX_BYTES, CMS_IMAGE_CHUNK_BYTES } from "./cms-media-limits.mjs"

const fail = (status, message) => { throw Object.assign(Error(message), { status }) }
const validName = name => typeof name === "string" && name.length > 0 && name.length <= 120 && !/[\x00-\x1f]/.test(name)
const validType = type => ["image/png", "image/jpeg"].includes(type)
const key = (user, id) => `cms_upload:${user.id}:${id}`
const partName = id => `cms-upload-part:${id}`
const discard = async (db, user, id) => {
  await db.prepare("DELETE FROM documents WHERE name=? AND owner_id=?").run(partName(id), user.id)
  await db.prepare("DELETE FROM system_settings WHERE key=?").run(key(user, id))
}

export async function storeCmsMedia(db, user, file) {
  if(user?.role!=="admin")fail(403,"Admin required");
  if (!file || !validType(file.type) || !validName(file.name) || typeof file.data !== "string")
    fail(400, "ใช้รูป JPG/PNG ขนาดไม่เกิน 5 MB")
  const prefix = `data:${file.type};base64,`
  if (!file.data.startsWith(prefix)) fail(400, "ข้อมูลรูปไม่ถูกต้อง")
  const encoded = file.data.slice(prefix.length)
  if (encoded.length > Math.ceil(CMS_IMAGE_MAX_BYTES / 3) * 4) fail(400, "รูปไม่ถูกต้องหรือใหญ่เกิน 5 MB")
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail(400, "ข้อมูลรูปไม่ถูกต้อง")
  const bytes = Buffer.from(encoded, "base64")
  if (!bytes.length || bytes.length > CMS_IMAGE_MAX_BYTES ||
    (file.type === "image/png"
      ? !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)))
    fail(400, "รูปไม่ถูกต้องหรือใหญ่เกิน 5 MB")
  await validateCmsImage(file.type,bytes);
  return db.transaction(async () => {
    await assertWriteSession(db,user);
    const count = await db.prepare("SELECT COUNT(*) AS n FROM documents WHERE name LIKE 'cms-image:%'").get()
    if (count.n >= 200) fail(400, "คลังรูปเต็ม (200 รูป) กรุณาลบรูปที่ไม่ได้ใช้งาน")
    const id = randomUUID(), name = "cms-image:" + file.name
    await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)").run(id, user.id, name, file.type, bytes)
    await initializeCmsChanges(db)
    await recordCmsChange(db, { kind: "media", action: "upload", snapshot: { id, name, mime: file.type }, user })
    await audit(db, user, "CMS_MEDIA_UPLOAD", id)
    return { id, name, mime: file.type, url: `/api/public/cms-media/${id}` }
  })
}

// Each request stays below the existing JSON body limit. Parts remain private
// in the database, so upload sessions work across serverless instances.
export async function uploadCmsMedia(db, user, data) {
  if(user?.role!=="admin")fail(403,"Admin required");
  if (!data.action) return storeCmsMedia(db, user, data.file)
  return db.transaction(async () => {
    await assertWriteSession(db,user);
    if (data.action === "start") {
      if (!validName(data.name) || !validType(data.type)) fail(400, "ใช้รูป JPG/PNG ขนาดไม่เกิน 5 MB")
      if (!Number.isInteger(data.size) || data.size < 1 || data.size > CMS_IMAGE_MAX_BYTES) fail(413, "ใช้รูป JPG/PNG ขนาดไม่เกิน 5 MB")
      const rows = await db.prepare("SELECT value FROM system_settings WHERE key LIKE ?").all(`cms_upload:${user.id}:%`)
      let active = 0
      for (const row of rows) {
        const upload = JSON.parse(row.value)
        if (upload.expiresAt <= Date.now()) await discard(db, user, upload.id)
        else active++
      }
      if (active >= 2) fail(409, "มีไฟล์กำลังอัปโหลดอยู่ กรุณารอหรือยกเลิกก่อน")
      const upload = { id: randomUUID(), name: data.name, type: data.type, size: data.size, received: 0, parts: 0, expiresAt: Date.now() + 30 * 60 * 1000 }
      await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run(key(user, upload.id), JSON.stringify(upload))
      return { uploadId: upload.id, chunkBytes: CMS_IMAGE_CHUNK_BYTES }
    }
    if (!/^[a-f0-9-]{36}$/.test(data.uploadId)) fail(400, "รหัสรูปไม่ถูกต้อง")
    if (data.action === "cancel") { await discard(db, user, data.uploadId); return { cancelled: true } }
    const row = await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key(user, data.uploadId))
    if (!row) fail(404, "การอัปโหลดหมดอายุ กรุณาเลือกไฟล์ใหม่")
    const upload = JSON.parse(row.value)
    if (upload.expiresAt <= Date.now()) fail(404, "การอัปโหลดหมดอายุ กรุณาเลือกไฟล์ใหม่")
    if (data.action === "part") {
      if (!Number.isInteger(data.index) || data.index !== upload.parts) fail(409, "ส่วนของไฟล์ไม่ถูกต้อง")
      if (typeof data.base64 !== "string" || data.base64.length > Math.ceil(CMS_IMAGE_CHUNK_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64)) fail(400, "ส่วนของไฟล์ไม่ถูกต้อง")
      const bytes = Buffer.from(data.base64, "base64")
      if (bytes.length !== Math.min(CMS_IMAGE_CHUNK_BYTES, upload.size - upload.received) || !bytes.length) fail(400, "ส่วนของไฟล์ไม่ถูกต้อง")
      await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)").run(`${upload.id}-${String(upload.parts).padStart(4, "0")}`, user.id, partName(upload.id), upload.type, bytes)
      upload.received += bytes.length; upload.parts++
      await db.prepare("UPDATE system_settings SET value=? WHERE key=?").run(JSON.stringify(upload), key(user, upload.id))
      return { received: upload.received }
    }
    if (data.action !== "finish") fail(400, "ส่วนของไฟล์ไม่ถูกต้อง")
    if (upload.received !== upload.size) fail(409, "ไฟล์ยังอัปโหลดไม่ครบ")
    const parts = await db.prepare("SELECT bytes FROM documents WHERE name=? AND owner_id=? ORDER BY id").all(partName(upload.id), user.id)
    const bytes = Buffer.concat(parts.map(part => Buffer.from(part.bytes)))
    if (bytes.length !== upload.size) fail(409, "ไฟล์ยังอัปโหลดไม่ครบ")
    const result = await storeCmsMedia(db, user, { name: upload.name, type: upload.type, data: `data:${upload.type};base64,${bytes.toString("base64")}` })
    await discard(db, user, upload.id)
    return result
  })
}
