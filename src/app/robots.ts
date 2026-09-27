import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tripmate.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/download',
          '/create-trip',
          '/join-trip',
          '/login',
          '/s/',
          '/api/download/',
          '/manifest.json',
          '/icon.png',
          '/logo.png',
        ],
        disallow: [
          '/dashboard/',
          '/expenses/',
          '/members/',
          '/payments/',
          '/settlements/',
          '/report/',
          '/api/shorten',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/expenses/',
          '/members/',
          '/payments/',
          '/settlements/',
          '/report/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl.replace(/\/$/, '')}/sitemap.xml`,
    host: baseUrl.replace(/\/$/, ''),
  }
}
