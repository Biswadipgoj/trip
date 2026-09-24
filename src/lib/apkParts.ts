// Size of the release APK, which is stored as several parts (Supabase free
// tier caps an object at 50 MB) and streamed back as one file.

/** Sum of the parts' sizes, or null when any part is missing or unreadable. */
export async function totalLength(urls: string[], fetchImpl: typeof fetch = fetch): Promise<number | null> {
  const sizes = await Promise.all(
    urls.map(async url => {
      try {
        const res = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' })
        const len = Number(res.headers.get('content-length'))
        return res.ok && Number.isFinite(len) && len > 0 ? len : null
      } catch {
        return null
      }
    })
  )
  return sizes.every((s): s is number => s !== null) ? sizes.reduce((a, b) => a + b, 0) : null
}
