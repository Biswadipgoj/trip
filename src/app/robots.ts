import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/config/site'

// Public pages are crawlable; private trip pages and the API are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/expenses/', '/members/', '/payments/', '/settlements/', '/report/', '/api/', '/s/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
