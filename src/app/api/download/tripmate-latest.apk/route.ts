import { NextResponse } from 'next/server'
import { APP_RELEASE } from '@/config/appRelease'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Total size of official tripmate-latest.apk (version 4.0.1, build 401)
const TOTAL_FILE_SIZE = APP_RELEASE.approxBytes || 116028587

function getPartUrls(): string[] {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qufmbheewymzyzkfaivr.supabase.co').replace(/\/+$/, '')
  return [
    `${supabaseUrl}/storage/v1/object/public/android-app/tripmate-latest.apk.part1`,
    `${supabaseUrl}/storage/v1/object/public/android-app/tripmate-latest.apk.part2`,
    `${supabaseUrl}/storage/v1/object/public/android-app/tripmate-latest.apk.part3`,
  ]
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${APP_RELEASE.fileName}"`,
      'Content-Length': String(TOTAL_FILE_SIZE),
      'Accept-Ranges': 'none',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  })
}

export async function GET() {
  const partUrls = getPartUrls()

  try {
    // Stream parts sequentially into a single unified HTTP response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const url of partUrls) {
            const res = await fetch(url, { cache: 'no-store' })
            if (!res.ok || !res.body) {
              controller.error(new Error(`Failed to fetch part ${url} (status: ${res.status})`))
              return
            }

            const reader = res.body.getReader()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(value)
            }
          }
          controller.close()
        } catch (streamErr) {
          controller.error(streamErr)
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${APP_RELEASE.fileName}"`,
        'Content-Length': String(TOTAL_FILE_SIZE),
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[Download Route Error]:', error)
    return NextResponse.json(
      { error: 'Failed to stream APK download', details: String(error) },
      { status: 500 }
    )
  }
}
