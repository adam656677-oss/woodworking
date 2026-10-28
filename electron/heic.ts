// iPhone photos (HEIC/HEIF) decoded on this computer, so they can be read like any other photo.
import decode from 'heic-decode'

/** True for HEIC/HEIF files (the "ftyp" box names heic, heix, mif1 …). */
export function isHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const box = String.fromCharCode(...bytes.slice(4, 8))
  const brand = String.fromCharCode(...bytes.slice(8, 12))
  return box === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)
}

export async function heicToRgba(bytes: Uint8Array): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const img = await decode({ buffer: bytes })
  return { width: img.width, height: img.height, data: img.data as Uint8ClampedArray }
}
