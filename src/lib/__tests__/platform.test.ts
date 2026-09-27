import { describe, expect, it } from 'vitest'
import { detectPlatform } from '../platform'

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  linuxChrome:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
}

describe('detectPlatform', () => {
  it('recognises Android browsers', () => {
    expect(detectPlatform(UA.androidChrome)).toBe('android')
    expect(detectPlatform(UA.androidSamsung)).toBe('android')
  })

  it('recognises iPhone browsers, including Chrome on iOS', () => {
    expect(detectPlatform(UA.iphoneSafari, 5)).toBe('ios')
    expect(detectPlatform(UA.iphoneChrome, 5)).toBe('ios')
  })

  it('treats a touch-capable "Macintosh" as an iPad', () => {
    expect(detectPlatform(UA.macSafari, 5)).toBe('ios')
  })

  it('never offers the Android app on desktops', () => {
    expect(detectPlatform(UA.macSafari, 0)).toBe('other')
    expect(detectPlatform(UA.windowsChrome)).toBe('other')
    expect(detectPlatform(UA.linuxChrome)).toBe('other')
    expect(detectPlatform('')).toBe('other')
  })
})
