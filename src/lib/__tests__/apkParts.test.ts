import { describe, expect, it } from 'vitest'
import { totalLength } from '@/lib/apkParts'

const headFetch = (sizes: Record<string, number | 'error' | 404>) =>
  (async (url: string) => {
    const s = sizes[url]
    if (s === 'error') throw new Error('network')
    if (s === 404) return new Response(null, { status: 404 })
    return new Response(null, { status: 200, headers: { 'content-length': String(s) } })
  }) as unknown as typeof fetch

describe('totalLength (APK download size)', () => {
  it('sums the real part sizes', async () => {
    expect(await totalLength(['a', 'b', 'c'], headFetch({ a: 41943040, b: 41943040, c: 32142507 }))).toBe(116028587)
  })

  it('returns null when a part is missing, so the route answers 503 instead of a corrupt file', async () => {
    expect(await totalLength(['a', 'b'], headFetch({ a: 10, b: 404 }))).toBeNull()
  })

  it('returns null when a part cannot be reached', async () => {
    expect(await totalLength(['a', 'b'], headFetch({ a: 10, b: 'error' }))).toBeNull()
  })
})
