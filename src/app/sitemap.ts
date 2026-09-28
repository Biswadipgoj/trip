import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/config/site'
import { GUIDES } from '@/lib/guides'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const page = (path: string, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly') => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  })
  return [
    page('/', 1.0, 'weekly'),
    ...GUIDES.map(g => page(`/${g.slug}`, 0.9)),
    page('/download', 0.8),
    page('/create-trip', 0.7),
    page('/join-trip', 0.7),
    page('/login', 0.5),
    page('/privacy', 0.3, 'yearly'),
    page('/terms', 0.3, 'yearly'),
  ]
}
