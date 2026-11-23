import type { MetadataRoute } from 'next';
export default function robots():MetadataRoute.Robots {
 const production=process.env.PUBLIC_PHASE1_STAGE!=='ADMIN_ONLY'&&process.env.VERCEL_ENV==='production'&&process.env.APP_ENV==='production';
 return {rules:{userAgent:'*',allow:production?'/':undefined,disallow:production?['/api/','/admin']:['/']},...(production?{sitemap:'https://www.villacheckth.com/sitemap.xml'}:{})};
}
