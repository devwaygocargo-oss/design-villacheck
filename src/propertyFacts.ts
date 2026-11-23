// Missing values are distinct from a supplied zero. Do not infer legacy intent.
export function propertyCount(value: number | null | undefined, unit: "guests" | "rooms", locale: "th" | "en"): string {
  if (value == null) return locale === "en" ? "Not specified" : "ไม่ระบุ";
  if (locale === "en") return `${value} ${unit}`;
  return `${value} ${unit === "guests" ? "คน" : "ห้อง"}`;
}
