import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'

// Share card for WhatsApp, Telegram, X and search results: 1200x630, as the
// Open Graph spec expects (the old tag pointed at the square 512px logo).
export const alt = 'TripMate — split trip expenses with friends and settle up on UPI'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  const logo = `data:image/png;base64,${(await readFile(path.join(process.cwd(), 'public/logo.png'))).toString('base64')}`
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '72px 80px', background: 'linear-gradient(135deg, #FDF9F2 0%, #F3E8FF 45%, #FCE7F3 100%)',
          fontFamily: 'sans-serif', color: '#2A1F3D',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={84} height={84} style={{ borderRadius: 22 }} alt="" />
          <div style={{ fontSize: 40, fontWeight: 800 }}>TripMate</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Split trips,</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: '#7C3BED' }}>not friendships.</div>
          <div style={{ marginTop: 28, fontSize: 32, color: '#5B4E70' }}>
            Track group expenses · settle up by UPI or cash · works offline
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 26, color: '#5720B6' }}>
          <span>Free</span><span>·</span><span>No ads</span><span>·</span><span>20 Indian languages</span><span>·</span><span>tripmate.boats</span>
        </div>
      </div>
    ),
    size,
  )
}
