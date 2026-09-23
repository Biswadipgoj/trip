// Renders the app icon, Android adaptive icon layers, themed (monochrome)
// icon, splash image and in-app logo from the traced web logo.
//
//   node mobile/scripts/generate-icons.mjs [--preview <dir>]
//
// Inputs:  mobile/assets/brand/tripmate-glyph.json (from trace-logo.py)
//          public/logo.png (the web logo)
// Outputs: mobile/assets/images/*.png (referenced by app.json)
// Uses `sharp`, resolved from the repo root node_modules (installed by Next.js).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('sharp not found — run `npm install` in the repo root first.')
  process.exit(1)
}

const MOBILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(MOBILE, '..')
const IMAGES = path.join(MOBILE, 'assets', 'images')
const brand = JSON.parse(fs.readFileSync(path.join(MOBILE, 'assets', 'brand', 'tripmate-glyph.json'), 'utf8'))
const logoPng = fs.readFileSync(path.join(ROOT, 'public', 'logo.png'))

const previewIdx = process.argv.indexOf('--preview')
const PREVIEW = previewIdx > -1 ? process.argv[previewIdx + 1] : null

// Scene shapes are filled with the original artwork, upscaled — its gradients
// survive upscaling, while every edge stays a crisp vector.
const logoFill = (await sharp(logoPng).resize(2048, 2048, { kernel: 'lanczos3' }).png().toBuffer()).toString('base64')

// Glyph placement on the 1024 canvas: this source point lands on the centre.
// Keeps the whole glyph (plane tip included) inside the 66dp safe circle.
const CX = 268
const CY = 219
const SCALE = 1.6

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`

const place = (inner, s = SCALE) =>
  `<g transform="translate(512 512) scale(${s}) translate(${-CX} ${-CY})">${inner}</g>`

// Vivid mesh echoing the logo: magenta top-left, orange top-right, blue left,
// cyan bottom, coral centre.
const BLOBS = [
  ['tl', 0, 0, 660, '#9D1CF2', 1],
  ['tr', 1024, 0, 640, '#FF8A24', 1],
  ['r', 1080, 640, 440, '#F770A6', 0.75],
  ['l', -40, 600, 520, '#2E5BF5', 0.95],
  ['bl', 0, 1024, 600, '#15BDF6', 1],
  ['br', 1040, 1060, 520, '#5AD6F8', 0.85],
  ['c', 560, 430, 360, '#F2567C', 0.6],
]
const background = () => `
  <defs>
    <linearGradient id="bgBase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F2508F"/>
      <stop offset="0.55" stop-color="#F45B7A"/>
      <stop offset="1" stop-color="#3CC4F5"/>
    </linearGradient>
    ${BLOBS.map(([id, cx, cy, r, c, o]) => `
    <radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${c}" stop-opacity="${o}"/>
      <stop offset="0.55" stop-color="${c}" stop-opacity="${o * 0.55}"/>
      <stop offset="1" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>`).join('')}
    <radialGradient id="sheen" cx="820" cy="120" r="520" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bgBase)"/>
  ${BLOBS.map(([id]) => `<rect width="1024" height="1024" fill="url(#${id})"/>`).join('')}
  <rect width="1024" height="1024" fill="url(#sheen)"/>`

const { sun } = brand
const glyph = ({ mono = false } = {}) => `
  <defs>
    <pattern id="art" patternUnits="userSpaceOnUse" width="512" height="512">
      <image href="data:image/png;base64,${logoFill}" width="512" height="512"/>
    </pattern>
    <linearGradient id="sunGrad" x1="0" y1="${sun.cy - sun.r}" x2="0" y2="${sun.cy + sun.r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FAD0BC"/>
      <stop offset="0.6" stop-color="#F7B878"/>
      <stop offset="1" stop-color="#F59C45"/>
    </linearGradient>
  </defs>
  ${mono ? '' : `
  <circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}" fill="url(#sunGrad)"/>
  <path d="${brand.mountains}" fill="url(#art)" stroke="url(#art)" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="${brand.lake}" fill="url(#art)" stroke="url(#art)" stroke-width="1.4" stroke-linejoin="round"/>`}
  <path d="${brand.glyph}" fill="#FFFFFF" fill-rule="evenodd"/>`

async function render(file, markup, size) {
  await sharp(Buffer.from(markup)).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
  console.log('  ✓', path.relative(ROOT, file))
}

fs.mkdirSync(IMAGES, { recursive: true })
console.log('Rendering TripMate icons…')

// Android adaptive icon (Android 8+) and themed icon (Android 13+)
await render(path.join(IMAGES, 'adaptive-background.png'), svg(1024, 1024, background()), 1024)
await render(path.join(IMAGES, 'adaptive-foreground.png'), svg(1024, 1024, place(glyph())), 1024)
await render(path.join(IMAGES, 'adaptive-monochrome.png'), svg(1024, 1024, place(glyph({ mono: true }))), 1024)

// Full-bleed icon: iOS, legacy Android launchers and the store listing
await render(path.join(IMAGES, 'icon.png'), svg(1024, 1024, background() + place(glyph())), 1024)
await render(path.join(IMAGES, 'favicon.png'), svg(1024, 1024, background() + place(glyph())), 48)

// Splash: rounded tile small enough for the Android 12+ circular splash mask
const tile = 470
const t0 = (1024 - tile) / 2
await render(path.join(IMAGES, 'splash-icon.png'), svg(1024, 1024, `
  <defs><clipPath id="tile"><rect x="${t0}" y="${t0}" width="${tile}" height="${tile}" rx="118"/></clipPath></defs>
  <g clip-path="url(#tile)">
    <g transform="translate(${t0} ${t0}) scale(${tile / 1024})">${background()}${place(glyph(), SCALE * 1.32)}</g>
  </g>`), 1024)

// In-app logo: the web logo tile (with its wordmark) with transparent corners.
// Tile geometry measured from public/logo.png.
const TILE = { x: 50, y: 36, w: 412, h: 436, r: 83 }
const side = TILE.h
const logoB64 = logoPng.toString('base64')
await render(path.join(IMAGES, 'logo.png'), svg(side, side, `
  <defs><clipPath id="t"><rect x="${(side - TILE.w) / 2}" y="0" width="${TILE.w}" height="${TILE.h}" rx="${TILE.r}"/></clipPath></defs>
  <g clip-path="url(#t)">
    <image href="data:image/png;base64,${logoB64}" x="${(side - TILE.w) / 2 - TILE.x}" y="${-TILE.y}" width="512" height="512"/>
  </g>`), side)

if (PREVIEW) {
  // Launcher previews: Android shows the inner 72/108 of the adaptive canvas.
  fs.mkdirSync(PREVIEW, { recursive: true })
  const icon = fs.readFileSync(path.join(IMAGES, 'icon.png')).toString('base64')
  const crop = 1024 * (72 / 108)
  const off = (1024 - crop) / 2
  const shapes = {
    circle: s => `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/>`,
    squircle: s => `<rect width="${s}" height="${s}" rx="${s * 0.3}"/>`,
    rounded: s => `<rect width="${s}" height="${s}" rx="${s * 0.16}"/>`,
  }
  const sizes = [288, 144, 72, 48]
  let x = 20
  let cells = ''
  for (const [name, shape] of Object.entries(shapes)) {
    let y = 20
    for (const s of sizes) {
      const k = s / crop
      cells += `<defs><clipPath id="${name}${s}">${shape(s)}</clipPath></defs>
        <g transform="translate(${x} ${y})"><g clip-path="url(#${name}${s})">
          <image href="data:image/png;base64,${icon}" x="${-off * k}" y="${-off * k}" width="${1024 * k}" height="${1024 * k}"/>
        </g></g>`
      y += s + 24
    }
    x += 328
  }
  const h = 20 + sizes.reduce((acc, s) => acc + s + 24, 0)
  await sharp(Buffer.from(svg(x, h, `<rect width="100%" height="100%" fill="#FDF9F2"/>${cells}`)))
    .png().toFile(path.join(PREVIEW, 'launcher-preview.png'))
  console.log('  ✓ preview →', PREVIEW)
}
console.log('Done.')
