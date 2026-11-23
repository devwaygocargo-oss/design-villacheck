import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap {
 // Only the canonical public entry is server-addressable; never list account or query-state URLs.
 return process.env.PUBLIC_PHASE1_STAGE!=='ADMIN_ONLY'&&process.env.VERCEL_ENV==='production'&&process.env.APP_ENV==='production'?[{url:'https://www.villacheckth.com/',changeFrequency:'weekly',priority:1}]:[];
}
