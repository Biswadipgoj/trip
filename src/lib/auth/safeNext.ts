/** A same-site path to return to after login, or null. Blocks `//evil.com` and `/\evil.com`. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}
