import { NextResponse } from 'next/server'
import { APP_RELEASE } from '@/config/appRelease'
import { totalLength } from '@/lib/apkParts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The APK is stored as parts (Supabase free tier caps objects at 50 MB) and
// streamed back as one file. The length header is the sum of the parts' real
// sizes: a stale hard-coded length makes browsers truncate or reject the file,
// and Android then reports "App not installed".

function getPartUrls(): string[] {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qufmbheewymzyzkfaivr.supabase.co').replace(/\/+$/, '')
  return [1, 2, 3].map(n => `${supabaseUrl}/storage/v1/object/public/android-app/tripmate-latest.apk.part${n}`)
}

function apkHeaders(length: number): HeadersInit {
  return {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': `attachment; filename="${APP_RELEASE.fileName}"`,
    'Content-Length': String(length),
    'Accept-Ranges': 'none',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'X-Content-Type-Options': 'nosniff',
  }
}

const unavailable = () =>
  NextResponse.json(
    { error: 'The Android app download is temporarily unavailable. Please try again in a few minutes.' },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '300' } }
  )

export async function HEAD() {
  const length = await totalLength(getPartUrls())
  if (length === null) return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return new Response(null, { status: 200, headers: apkHeaders(length) })
}

export async function GET() {
  const partUrls = getPartUrls()
  const length = await totalLength(partUrls)
  if (length === null) {
    console.error('[download] an APK part is missing or unreadable')
    return unavailable()
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const url of partUrls) {
          const res = await fetch(url, { cache: 'no-store' })
          if (!res.ok || !res.body) throw new Error(`part fetch failed (${res.status})`)
          const reader = res.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        }
        controller.close()
      } catch (err) {
        console.error('[download] stream failed:', err)
        controller.error(err)
      }
    },
  })

  return new Response(stream, { status: 200, headers: apkHeaders(length) })
}
