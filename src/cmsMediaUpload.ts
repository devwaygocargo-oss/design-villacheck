import { api, currentAccount } from "./api"
import type { CmsMedia } from "./CmsMediaPicker"
import { CMS_IMAGE_MAX_BYTES } from "../server/cms-media-limits.mjs"

export async function uploadCmsImage(file: File): Promise<CmsMedia> {
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size < 1 || file.size > CMS_IMAGE_MAX_BYTES)
    throw Error("ใช้ JPG/PNG ขนาดไม่เกิน 5 MB")
  await currentAccount()
  const endpoint = "/admin/cms/media"
  const { uploadId, chunkBytes } = await api<{ uploadId: string; chunkBytes: number }>(endpoint, { action: "start", name: file.name, type: file.type, size: file.size })
  try {
    for (let offset = 0, index = 0; offset < file.size; offset += chunkBytes, index++) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(",")[1])
        reader.onerror = () => reject(Error("อ่านรูปไม่สำเร็จ"))
        reader.readAsDataURL(file.slice(offset, offset + chunkBytes))
      })
      await api(endpoint, { action: "part", uploadId, index, base64 })
    }
    return await api<CmsMedia>(endpoint, { action: "finish", uploadId })
  } catch (error) {
    await api(endpoint, { action: "cancel", uploadId }).catch(() => {})
    throw error
  }
}
