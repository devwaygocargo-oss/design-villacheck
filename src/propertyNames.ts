export function propertyName(property: {name?: string; nameEn?: string}, locale: "th" | "en"): string {
  return locale === "en" && property.nameEn?.trim() ? property.nameEn : property.name || "";
}
