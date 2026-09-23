// Colour helpers. Member avatar colours arrive from the server as hsl()
// strings (web format) or hex (older mobile data); these add alpha to either.

interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

const cache = new Map<string, RGBA | null>()

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

const parseAlpha = (p: string) => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p))

/** Parses #rgb, #rrggbb, #rrggbbaa, rgb(a)() and hsl(a)() strings. */
export function parseColor(input: string): RGBA | null {
  const cached = cache.get(input)
  if (cached !== undefined) return cached
  let out: RGBA | null = null
  const s = (input || '').trim().toLowerCase()
  if (s.startsWith('#')) {
    let hex = s.slice(1)
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('')
    if ((hex.length === 6 || hex.length === 8) && /^[0-9a-f]+$/.test(hex)) {
      const n = parseInt(hex.slice(0, 6), 16)
      out = {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255,
        a: hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1,
      }
    }
  } else {
    const m = s.match(/^(rgba?|hsla?)\(([^)]+)\)$/)
    if (m) {
      const parts = m[2].split(/[\s,/]+/).filter(Boolean)
      if (parts.length >= 3) {
        const alpha = parts[3] !== undefined ? parseAlpha(parts[3]) : 1
        if (m[1].startsWith('rgb')) {
          out = { r: parseFloat(parts[0]), g: parseFloat(parts[1]), b: parseFloat(parts[2]), a: alpha }
        } else {
          const [r, g, b] = hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]) / 100, parseFloat(parts[2]) / 100)
          out = { r, g, b, a: alpha }
        }
      }
    }
  }
  if (out && [out.r, out.g, out.b, out.a].some(v => !Number.isFinite(v))) out = null
  cache.set(input, out)
  return out
}

/** Returns `color` as rgba() with its alpha multiplied by `alpha`. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color)
  if (!c) return color
  const a = Math.max(0, Math.min(1, alpha * c.a))
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(a.toFixed(3))})`
}

/** Opaque #rrggbb form (for APIs that reject hsl()). */
export function toHex(color: string): string {
  const c = parseColor(color)
  if (!c) return color
  return `#${[c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}
