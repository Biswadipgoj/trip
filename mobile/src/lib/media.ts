// Image picking for bill photos and UPI payment screenshots:
// camera / gallery → downscale + JPEG-compress → private on-device copy.
// Uploading is handled separately (uploads.ts) so it survives offline periods
// and app restarts.
import { Linking } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { Directory, File, Paths } from 'expo-file-system'
import { generateId } from './utils'

export type PickSource = 'camera' | 'library'

export interface PreparedImage {
  uri: string
  width: number
  height: number
  sizeBytes: number
  mimeType: 'image/jpeg'
}

/** Longest side after downscaling: bills stay legible, uploads stay small
 *  (~150–400 KB instead of 3–8 MB camera originals). */
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.72

export class MediaPermissionError extends Error {
  canAskAgain: boolean
  constructor(message: string, canAskAgain: boolean) {
    super(message)
    this.canAskAgain = canAskAgain
  }
}

export const openAppSettings = () => Linking.openSettings().catch(() => {})

function mediaDir(): Directory {
  const dir = new Directory(Paths.document, 'tripmate-media')
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

/** Downscales + compresses a picked image and moves it into app storage
 *  (the picker's cache copy can be purged by the OS at any time). */
export async function prepareImage(sourceUri: string, width: number, height: number): Promise<PreparedImage> {
  const ctx = ImageManipulator.manipulate(sourceUri)
  const longest = Math.max(width, height)
  if (longest > MAX_DIMENSION) {
    if (width >= height) ctx.resize({ width: MAX_DIMENSION, height: null })
    else ctx.resize({ width: null, height: MAX_DIMENSION })
  }
  const rendered = await ctx.renderAsync()
  const result = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG })

  const target = new File(mediaDir(), `${generateId()}.jpg`)
  const temp = new File(result.uri)
  try {
    await temp.move(target)
  } catch {
    // Some content providers refuse a move — copy instead.
    await temp.copy(target)
    try { temp.delete() } catch { /* cache cleanup is best-effort */ }
  }
  return {
    uri: target.uri,
    width: result.width,
    height: result.height,
    sizeBytes: target.size ?? 0,
    mimeType: 'image/jpeg',
  }
}

/** Opens the camera or photo library. Returns null if the user cancelled. */
export async function pickImage(source: PickSource): Promise<PreparedImage | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      throw new MediaPermissionError(
        'Camera access is off. Allow it in Settings to snap bills.',
        perm.canAskAgain
      )
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1, // compression happens once, in prepareImage
    allowsEditing: false,
    exif: false,
  }
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options)
  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]
  return prepareImage(asset.uri, asset.width, asset.height)
}

// ─── Android: recover a pick after the OS killed the app ──────────────────────
// On low-memory phones Android may kill TripMate while the camera app is open.
// Before launching the picker we remember what the image was for; on restart
// ImagePicker.getPendingResultAsync() hands back the photo.

export type PickContext =
  /** A bill for an existing expense/stay, or (no ids) for the add-expense form. */
  | { kind: 'bill'; tripId?: string; expenseId?: string; hotelExpenseId?: string }
  | { kind: 'payment_proof'; tripId: string; settlementId: string }

const PENDING_KEY = 'tripmate_pending_pick'

export async function savePickContext(context: PickContext | null) {
  try {
    if (context) await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ context, at: new Date().toISOString() }))
    else await AsyncStorage.removeItem(PENDING_KEY)
  } catch {
    /* recovery is best-effort */
  }
}

/** Returns an image picked before the app was killed, with its context. */
export async function takePendingPick(): Promise<{ image: PreparedImage; context: PickContext } | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY)
    if (!raw) return null
    await AsyncStorage.removeItem(PENDING_KEY)
    const { context, at } = JSON.parse(raw) as { context: PickContext; at: string }
    // Ignore stale contexts (older than an hour).
    if (Date.now() - new Date(at).getTime() > 60 * 60 * 1000) return null
    const pending = await ImagePicker.getPendingResultAsync()
    if (!pending || 'code' in pending || pending.canceled || !pending.assets?.[0]) return null
    const asset = pending.assets[0]
    return { image: await prepareImage(asset.uri, asset.width, asset.height), context }
  } catch {
    return null
  }
}

/** Deletes on-device image copies (only files inside the app's media dir). */
export function deleteLocalFiles(uris: string[]) {
  for (const uri of uris) {
    if (!uri || !uri.includes('tripmate-media')) continue
    try {
      const f = new File(uri)
      if (f.exists) f.delete()
    } catch {
      /* already gone */
    }
  }
}

export function localFileExists(uri: string | undefined): boolean {
  if (!uri) return false
  try {
    return new File(uri).exists
  } catch {
    return false
  }
}
