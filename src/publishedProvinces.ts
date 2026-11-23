// Geographic CMS destinations do not imply a published Villa exists there.
// Listing input must come from the public endpoint, never a private state DTO.
export function publishedProvinces(villas: readonly {province: string; qrStatus: string}[], configured: readonly string[] = []): string[] {
  return [...new Set([...configured, ...villas.filter(v => v.qrStatus === "ACTIVE").map(v => v.province)].map(value => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "th"));
}
