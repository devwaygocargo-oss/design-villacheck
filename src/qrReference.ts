export function villaVerificationUrl(siteUrl: string, reference: string): string {
  const url = new URL(siteUrl)
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("URL เว็บไซต์ไม่ถูกต้อง")
  }
  url.pathname = "/"
  url.search = ""
  url.hash = new URLSearchParams({ page: "verify", item: reference }).toString()
  return url.href
}

export function qrReference(value: string): string | null {
  const raw = value.trim()
  const valid = (code: string | null) =>
    code && /^VC-[a-z0-9-]{4,100}$/i.test(code) ? code : null
  if (valid(raw)) return raw
  try {
    const url = new URL(raw)
    if (!["https:", "http:"].includes(url.protocol)) return null
    return valid(new URLSearchParams(url.hash.slice(1)).get("item"))
  } catch {
    return null
  }
}
