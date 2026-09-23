// UPI QR code rendered as one SVG path (web: qrcode.react's QRCodeSVG).
// `QRCode.create` only computes the module matrix — no canvas needed, which
// is why the old toDataURL approach never worked in React Native.
import { memo, useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import QRCodeLib from 'qrcode'
import { C } from '../../theme/colors'
import { T } from './Text'

const MARGIN = 2 // quiet zone, in modules

function buildPath(value: string): { d: string; size: number } | null {
  try {
    const qr = QRCodeLib.create(value, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const data = qr.modules.data
    let d = ''
    for (let y = 0; y < n; y++) {
      let x = 0
      while (x < n) {
        if (!data[y * n + x]) {
          x++
          continue
        }
        const start = x
        while (x < n && data[y * n + x]) x++
        d += `M${start + MARGIN} ${y + MARGIN}h${x - start}v1h-${x - start}z`
      }
    }
    return { d, size: n + MARGIN * 2 }
  } catch {
    return null
  }
}

export const QRCode = memo(function QRCode({ value, size = 168 }: { value: string; size?: number }) {
  const qr = useMemo(() => buildPath(value), [value])
  if (!qr) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <T variant="small" center>QR unavailable</T>
      </View>
    )
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${qr.size} ${qr.size}`} accessibilityLabel="UPI payment QR code">
      <Rect x={0} y={0} width={qr.size} height={qr.size} fill={C.white} />
      <Path d={qr.d} fill="#1B1330" />
    </Svg>
  )
})
