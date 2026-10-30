// Reading a picture file for a reference: a data URL (scaled down past 8 MB) and its shape.
const MAX = 8 * 1024 * 1024

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("That picture couldn't be read — use a PNG, JPEG or WebP file."))
    img.src = src
  })
}

export async function readPicture(file: File): Promise<{ name: string; dataUrl: string; aspect: number }> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Pick a PNG, JPEG or WebP picture.')
  let dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error("That picture couldn't be read."))
    r.readAsDataURL(file)
  })
  const img = await loadImage(dataUrl)
  const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
  if (dataUrl.length > MAX) {
    const f = Math.sqrt(MAX / dataUrl.length) * 0.9
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * f))
    c.height = Math.max(1, Math.round(img.naturalHeight * f))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    dataUrl = c.toDataURL('image/jpeg', 0.85)
  }
  return { name: file.name.replace(/\.[^.]+$/, ''), dataUrl, aspect }
}
