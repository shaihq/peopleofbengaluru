import type { MetadataRoute } from 'next'
import { IS_PRODUCTION, SITE_URL } from '@/lib/site'

// The city is one page; people live inside it, not at URLs of their own.
export default function sitemap(): MetadataRoute.Sitemap {
  if (!IS_PRODUCTION) return []
  return [{ url: SITE_URL, changeFrequency: 'daily', priority: 1 }]
}
