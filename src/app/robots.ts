import type { MetadataRoute } from 'next'
import { IS_PRODUCTION, SITE_URL } from '@/lib/site'

// Production: everything but the admin page and the API. Elsewhere (dev, previews), crawlers may fetch
// pages only to read their noindex, which is what takes an already-indexed URL out of search.
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION) return { rules: { userAgent: '*', allow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
