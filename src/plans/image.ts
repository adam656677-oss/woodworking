// Getting a phone photo or scan ready to read: turned the right way up (from the camera's own
// orientation tag), sized sensibly, grey, and with its contrast stretched so faint text stands out.

const MAX_SIDE = 2500

export async function prepareForReading(bytes: Uint8Array): Promise<Uint8Array> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart]), { imageOrientation: 'from-image' })
  } catch {
    throw new Error('unreadable')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  // Grey, then stretch the darkest 1% to black and the lightest 1% to white.
  const hist = new Array(256).fill(0)
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    d[i] = g
    hist[g]++
  }
  const total = w * h
  let lo = 0
  let hi = 255
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.01; hi--);
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(((d[i] - lo) * 255) / span)))
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}
