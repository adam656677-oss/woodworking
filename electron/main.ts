import { app, BrowserWindow, dialog, ipcMain, nativeImage, net, powerSaveBlocker, shell } from 'electron'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { autosavePath, defaultFolder, deleteAutosave, load, loadJson, safeSave, writeAutosave } from './fileStore'
import { checkPin, loadProgress, pinFilePath, pinIsSet, saveProgress, setPin, addProfile, familyProgress, loadProfiles, photoName, removeProfile, switchProfile } from './kidsStore'
import {
  attachDesign, createPlanFolder, deletePlanFolder, fileDataUrl, listPlans, loadPlan, plansRoot, readDesign, renamePlanFolder, savePage, savePhotoBytes, savePlan
} from './plansStore'
import type { Plan } from '../src/plans/types'
import { configureOcr, ocrImage } from './ocr'
import { heicToRgba, isHeic } from './heic'
import { capturePage } from './webCapture'
import { collectBackup, readPackage, restoreBackup, writeBackup, writePackage, type Package } from './backup'
import type { Progress } from '../src/kids/progress'

// Test hooks: e2e runs point these at temp folders so they never touch real documents or settings.
if (process.env.AA_USER_DATA) app.setPath('userData', process.env.AA_USER_DATA)
/** A file name Windows accepts: no reserved characters or names, no control characters, no trailing dots or spaces. */
const safeName = (n: unknown) => {
  let s = String(n ?? '').replace(/[\u0000-\u001f\\/:*?"<>|]/g, '-').replace(/[. ]+$/, '').trim().slice(0, 120)
  if (!s || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = `Drawings ${s}`.trim()
  return s
}
const docsDir = () => process.env.AA_DOCS_DIR ?? app.getPath('documents')
const AAW = [{ name: 'A&A Project', extensions: ['aaw'] }]

let win: BrowserWindow | null = null
let dirty = false
let allowClose = false

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'A&A Woodworking Studio',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.on('close', async e => {
    if (!dirty || allowClose) return
    e.preventDefault()
    const { response } = await dialog.showMessageBox(win!, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'Save changes to this project before closing?'
    })
    if (response === 2) return
    if (response === 0) {
      win!.webContents.send('aa:save-request')
      return // the renderer saves, then calls aa:close-after-save
    }
    allowClose = true
    win!.close()
  })
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

const PHOTO_TYPES = ['jpg', 'jpeg', 'png', 'heic', 'heif']

/** A photo file as a picture Electron can work with; iPhone HEIC photos are decoded first. */
async function loadPhoto(path: string): Promise<Electron.NativeImage> {
  return photoFromBytes(new Uint8Array(await readFile(path)))
}
async function photoFromBytes(bytes: Uint8Array): Promise<Electron.NativeImage> {
  if (isHeic(bytes)) {
    const { width, height, data } = await heicToRgba(bytes)
    const bgra = Buffer.alloc(data.length)
    for (let i = 0; i < data.length; i += 4) {
      bgra[i] = data[i + 2]
      bgra[i + 1] = data[i + 1]
      bgra[i + 2] = data[i]
      bgra[i + 3] = data[i + 3]
    }
    return nativeImage.createFromBitmap(bgra, { width, height })
  }
  return nativeImage.createFromBuffer(Buffer.from(bytes))
}

/** Lets the screen sleep again (Shop Mode's keep-awake). */
let releaseAwake = (): void => {}

function register(): void {
  ipcMain.handle('aa:openProject', async () => {
    const r = await dialog.showOpenDialog(win!, { defaultPath: defaultFolder(docsDir()), filters: AAW, properties: ['openFile'] })
    if (r.canceled || !r.filePaths[0]) return null
    const path = r.filePaths[0]
    const loaded = await load(path)
    let autosaveText: string | undefined
    if (loaded.autosaveNewer) autosaveText = await readFile(loaded.autosavePath, 'utf8')
    return { path, text: loaded.text, autosaveNewer: loaded.autosaveNewer, autosaveText, backupPath: loaded.backupPath }
  })
  // 3D files out (STL, OBJ+MTL, 3MF, GLB, STEP, DXF flat patterns) and reference models in.
  const EXPORTS: Record<string, string> = { stl: 'STL mesh', obj: 'OBJ model', '3mf': '3MF model', glb: 'glTF binary', step: 'STEP model', dxf: 'DXF flat patterns' }
  ipcMain.handle('aa:exportFile', async (_e, ext: string, data: Uint8Array | string, suggestedName: string, mtl?: string) => {
    if (!EXPORTS[ext]) return null
    const safe = String(suggestedName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'Design'
    const folder = defaultFolder(docsDir())
    await mkdir(folder, { recursive: true })
    const r = await dialog.showSaveDialog(win!, { defaultPath: join(folder, `${safe}.${ext}`), filters: [{ name: EXPORTS[ext], extensions: [ext] }] })
    if (r.canceled || !r.filePath) return null
    const path = r.filePath.toLowerCase().endsWith(`.${ext}`) ? r.filePath : `${r.filePath}.${ext}`
    if (ext === 'obj' && typeof data === 'string' && mtl !== undefined) {
      // The materials file sits beside the model, named to match.
      const mtlName = `${basename(path).replace(/\.obj$/i, '')}.mtl`
      await writeFile(join(path, '..', mtlName), mtl, 'utf8')
      data = data.replace(/^mtllib .*$/m, `mtllib ${mtlName}`)
    }
    await writeFile(path, typeof data === 'string' ? data : Buffer.from(data))
    return path
  })
  ipcMain.handle('aa:importModel', async () => {
    const r = await dialog.showOpenDialog(win!, { defaultPath: defaultFolder(docsDir()), properties: ['openFile'], filters: [{ name: '3D models', extensions: ['stl', 'obj', '3mf', 'glb', 'gltf', 'step', 'stp'] }] })
    if (r.canceled || !r.filePaths[0]) return null
    const bytes = await readFile(r.filePaths[0])
    return { name: basename(r.filePaths[0]), bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) }
  })
  ipcMain.handle('aa:saveProject', async (_e, path: string, text: string) => {
    await safeSave(path, text)
  })
  ipcMain.handle('aa:saveAs', async (_e, text: string, suggestedName: string) => {
    const folder = defaultFolder(docsDir())
    await mkdir(folder, { recursive: true })
    const r = await dialog.showSaveDialog(win!, { defaultPath: join(folder, `${suggestedName}.aaw`), filters: AAW })
    if (r.canceled || !r.filePath) return null
    const path = r.filePath.toLowerCase().endsWith('.aaw') ? r.filePath : `${r.filePath}.aaw`
    await safeSave(path, text)
    return path
  })
  ipcMain.handle('aa:writeAutosave', async (_e, path: string | null, text: string) => {
    const target = autosavePath(path, docsDir())
    await mkdir(join(target, '..'), { recursive: true })
    await writeAutosave(target, text)
  })
  ipcMain.handle('aa:deleteAutosave', async (_e, path: string | null) => {
    try {
      await deleteAutosave(autosavePath(path, docsDir()))
    } catch {
      // A leftover autosave is harmless; it is offered again only if newer than the file.
    }
  })
  ipcMain.handle('aa:readUntitledAutosave', async () => {
    try {
      return await readFile(autosavePath(null, docsDir()), 'utf8')
    } catch {
      return null
    }
  })
  ipcMain.handle('aa:exportCsv', async (_e, text: string, suggestedName: string) => {
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: join(defaultFolder(docsDir()), `${suggestedName} cut list.csv`),
      filters: [{ name: 'Spreadsheet (CSV)', extensions: ['csv'] }]
    })
    if (r.canceled || !r.filePath) return null
    await writeFile(r.filePath, text, 'utf8')
    return r.filePath
  })
  ipcMain.handle('aa:exportShape', async (_e, kind: 'dxf' | 'svg', text: string, suggestedName: string) => {
    if (kind !== 'dxf' && kind !== 'svg') return null
    const safe = String(suggestedName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'Shape'
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: join(defaultFolder(docsDir()), `${safe}.${kind}`),
      filters: [kind === 'dxf' ? { name: 'DXF drawing (CNC)', extensions: ['dxf'] } : { name: 'SVG picture (laser, vinyl)', extensions: ['svg'] }]
    })
    if (r.canceled || !r.filePath) return null
    await writeFile(r.filePath, String(text), 'utf8')
    return r.filePath
  })
  // Shop Mode keeps the screen on while it is open.
  let awake: number | null = null
  const release = () => { if (awake !== null) { powerSaveBlocker.stop(awake); awake = null } }
  ipcMain.handle('aa:keepAwake', async (_e, on: boolean) => {
    if (on && awake === null) awake = powerSaveBlocker.start('prevent-display-sleep')
    if (!on) release()
  })
  releaseAwake = release
  ipcMain.handle('aa:print', async (_e, opts?: { landscape?: boolean; edgeToEdge?: boolean }) => {
    const landscape = opts?.landscape ?? true
    // Label sheets: no printer margins, so the labels land where the sheet's die cuts are.
    await new Promise<void>(resolve => win!.webContents.print({ landscape, ...(opts?.edgeToEdge ? { margins: { marginType: 'none' as const } } : {}) }, () => resolve()))
  })
  ipcMain.handle('aa:printPdf', async (_e, name: string) => {
    // A temporary PDF opened in the system viewer: each page keeps its own size, so templates print 1:1.
    try {
      const dir = join(app.getPath('temp'), 'aa-print')
      await mkdir(dir, { recursive: true })
      const file = join(dir, `${safeName(name)}.pdf`)
      await writeFile(file, await win!.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true }))
      return (await shell.openPath(file)) === ''
    } catch {
      return false
    }
  })
  ipcMain.handle('aa:openLink', async (_e, url: string) => {
    // Only the outside sites the app links to, and only over https.
    let u: URL
    try { u = new URL(String(url)) } catch { return false }
    if (u.protocol !== 'https:' || !['www.mohawk-finishing.com', 'mohawk-finishing.com'].includes(u.hostname)) return false
    await shell.openExternal(u.toString())
    return true
  })
  // A picture of the 3D view (PNG data URL from the page).
  // Family & sharing: a whole backup (app data + the projects folder) and project packages.
  const BACKUP = [{ name: 'A&A Woodworking backup', extensions: ['aabackup'] }]
  const PACKAGE = [{ name: 'A&A Woodworking project package', extensions: ['aapkg'] }]
  ipcMain.handle('aa:backup', async () => {
    const day = new Date().toISOString().slice(0, 10)
    const r = await dialog.showSaveDialog(win!, { defaultPath: join(docsDir(), `A&A Woodworking backup ${day}.aabackup`), filters: BACKUP })
    if (r.canceled || !r.filePath) return null
    const { files, skipped } = await collectBackup(app.getPath('userData'), defaultFolder(docsDir()))
    await writeBackup(r.filePath, files)
    return { path: r.filePath, files: files.length, skipped }
  })
  // Restoring replaces the kids' progress and PIN too, so it needs the parent PIN when one is set.
  ipcMain.handle('aa:restore', async (_e, pin: string) => {
    const d = await kidsDir()
    if ((await pinIsSet(d)) && !(await checkPin(d, pin))) throw new Error('That PIN is not right.')
    const r = await dialog.showOpenDialog(win!, { defaultPath: docsDir(), filters: BACKUP, properties: ['openFile'] })
    if (r.canceled || !r.filePaths[0]) return null
    await mkdir(defaultFolder(docsDir()), { recursive: true })
    return restoreBackup(r.filePaths[0], app.getPath('userData'), defaultFolder(docsDir()))
  })
  // Opens a folder a restore set files aside in (only those).
  ipcMain.handle('aa:showFolder', async (_e, path: string) => {
    const ok = typeof path === 'string' && /[\\/]_before-restore-[\w-]+$/.test(path) && (path.startsWith(app.getPath('userData')) || path.startsWith(defaultFolder(docsDir())))
    if (ok) await shell.openPath(path)
  })
  ipcMain.handle('aa:savePackage', async (_e, name: string, pkg: Package) => {
    const r = await dialog.showSaveDialog(win!, { defaultPath: join(defaultFolder(docsDir()), `${safeName(name)}.aapkg`), filters: PACKAGE })
    if (r.canceled || !r.filePath) return null
    await writePackage(r.filePath, pkg)
    return r.filePath
  })
  ipcMain.handle('aa:openPackage', async () => {
    const r = await dialog.showOpenDialog(win!, { defaultPath: defaultFolder(docsDir()), filters: PACKAGE, properties: ['openFile'] })
    if (r.canceled || !r.filePaths[0]) return null
    return readPackage(r.filePaths[0])
  })
  ipcMain.handle('aa:savePng', async (_e, suggestedName: string, dataUrl: string) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return null
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: join(defaultFolder(docsDir()), `${safeName(suggestedName)}.png`),
      filters: [{ name: 'PNG picture', extensions: ['png'] }]
    })
    if (r.canceled || !r.filePath) return null
    await writeFile(r.filePath, Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'))
    return r.filePath
  })
  ipcMain.handle('aa:savePdf', async (_e, suggestedName: string) => {
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: join(defaultFolder(docsDir()), `${safeName(suggestedName)}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (r.canceled || !r.filePath) return null
    // Each page's own size and orientation come from the page's CSS (@page rules).
    const pdf = await win!.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true })
    await writeFile(r.filePath, pdf)
    return r.filePath
  })
  ipcMain.handle('aa:loadUserWoods', async () => {
    try {
      return JSON.parse(await readFile(join(app.getPath('userData'), 'woods.json'), 'utf8'))
    } catch {
      return []
    }
  })
  ipcMain.handle('aa:saveUserWoods', async (_e, woods: unknown) => {
    await mkdir(app.getPath('userData'), { recursive: true })
    await safeSave(join(app.getPath('userData'), 'woods.json'), JSON.stringify(woods, null, 2))
  })
  // The shop journal and inventory: JSON files in the app's data folder (only these names). A damaged file is
  // kept aside as name.json.damaged and the last good copy (.bak) is used, so a save can't make the loss permanent.
  const DATA = new Set(['journal', 'inventory'])
  // A photo the page can't read itself (iPhone HEIC) as a JPEG no bigger than `max` pixels, or null.
  ipcMain.handle('aa:photoThumbnail', async (_e, bytes: Uint8Array, max: number) => {
    try {
      const img = await photoFromBytes(new Uint8Array(bytes))
      if (img.isEmpty()) return null
      const { width, height } = img.getSize()
      const k = Math.min(1, max / Math.max(width, height))
      const small = k < 1 ? img.resize({ width: Math.round(width * k), height: Math.round(height * k) }) : img
      return `data:image/jpeg;base64,${small.toJPEG(80).toString('base64')}`
    } catch { return null }
  })
  ipcMain.handle('aa:loadData', async (_e, name: string) => {
    if (!DATA.has(name)) return { data: null, damaged: false }
    const path = join(app.getPath('userData'), `${name}.json`)
    const r = await loadJson(path)
    if (r.damaged) await copyFile(path, `${path}.damaged`).catch(() => {})
    return r
  })
  ipcMain.handle('aa:saveData', async (_e, name: string, data: unknown) => {
    if (!DATA.has(name)) return
    await mkdir(app.getPath('userData'), { recursive: true })
    await safeSave(join(app.getPath('userData'), `${name}.json`), JSON.stringify(data, null, 2))
  })
  // The shop's stock on hand (sheets, offcuts, boards), shared by every project.
  ipcMain.handle('aa:loadStock', async () => {
    try { return JSON.parse(await readFile(join(app.getPath('userData'), 'stock.json'), 'utf8')) } catch { return [] }
  })
  ipcMain.handle('aa:saveStock', async (_e, items: unknown) => {
    await mkdir(app.getPath('userData'), { recursive: true })
    await safeSave(join(app.getPath('userData'), 'stock.json'), JSON.stringify(items, null, 2))
  })
  // ---- Kids' Workshop ----
  const kidsDir = async () => {
    const d = app.getPath('userData')
    await mkdir(d, { recursive: true })
    return d
  }
  const PHOTO_MAX = 1600
  ipcMain.handle('kids:load', async () => loadProgress(await kidsDir()))
  ipcMain.handle('kids:save', async (_e, p: Progress, profile?: string) => saveProgress(await kidsDir(), p, typeof profile === 'string' ? profile : undefined))
  ipcMain.handle('kids:pinIsSet', async () => pinIsSet(await kidsDir()))
  ipcMain.handle('kids:setPin', async (_e, pin: string) => setPin(await kidsDir(), pin))
  ipcMain.handle('kids:checkPin', async (_e, pin: string) => checkPin(await kidsDir(), pin))
  ipcMain.handle('kids:pinPath', async () => pinFilePath(await kidsDir()))
  // More than one child. Adding or removing a child and the family page need the parent PIN; picking who's working doesn't.
  ipcMain.handle('kids:profiles', async () => loadProfiles(await kidsDir()))
  ipcMain.handle('kids:switch', async (_e, id: string) => switchProfile(await kidsDir(), id))
  ipcMain.handle('kids:addProfile', async (_e, name: string, pin: string) => {
    const d = await kidsDir()
    if (typeof name !== 'string' || !name.trim() || !(await checkPin(d, pin))) return null
    return addProfile(d, name)
  })
  ipcMain.handle('kids:removeProfile', async (_e, id: string, pin: string) => {
    const d = await kidsDir()
    if (!(await checkPin(d, pin))) return false
    await removeProfile(d, id)
    return true
  })
  ipcMain.handle('kids:family', async (_e, pin: string) => {
    const d = await kidsDir()
    return (await checkPin(d, pin)) ? familyProgress(d) : null
  })
  ipcMain.handle('kids:addPhoto', async (_e, projectId: string, profile?: string) => {
    if (!/^[a-z0-9-]+$/.test(projectId)) return null
    const profiles = await loadProfiles(await kidsDir())
    const who = typeof profile === 'string' && profiles.profiles.some(x => x.id === profile) ? profile : profiles.active
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'Photos', extensions: PHOTO_TYPES }] })
    if (r.canceled || !r.filePaths[0]) return null
    let img = await loadPhoto(r.filePaths[0]).catch(() => nativeImage.createEmpty())
    if (img.isEmpty()) throw new Error("That photo couldn't be read. Try a JPG or PNG.")
    const { width, height } = img.getSize()
    const scale = Math.min(1, PHOTO_MAX / Math.max(width, height))
    if (scale < 1) img = img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' })
    const folder = join(await kidsDir(), 'kids-photos')
    await mkdir(folder, { recursive: true })
    const name = photoName(who, projectId)
    await writeFile(join(folder, name), img.toJPEG(85))
    return name
  })
  ipcMain.handle('kids:photoUrl', async (_e, name: string) => {
    if (!/^[a-z0-9-]+\.jpg$/.test(name)) return null
    try {
      const data = await readFile(join(app.getPath('userData'), 'kids-photos', name))
      return `data:image/jpeg;base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })
  // ---- My Plans ----
  const root = () => plansRoot(docsDir())
  ipcMain.handle('plans:list', async () => listPlans(root()))
  ipcMain.handle('plans:load', async (_e, folder: string) => loadPlan(root(), folder))
  ipcMain.handle('plans:create', async (_e, plan: Plan) => createPlanFolder(root(), plan))
  ipcMain.handle('plans:save', async (_e, folder: string, plan: Plan) => savePlan(root(), folder, plan))
  ipcMain.handle('plans:discard', async (_e, folder: string) => deletePlanFolder(root(), folder))
  ipcMain.handle('plans:rename', async (_e, folder: string, name: string) => renamePlanFolder(root(), folder, name))
  ipcMain.handle('plans:attachDesign', async (_e, folder: string, text: string) => attachDesign(root(), folder, text))
  ipcMain.handle('plans:pickDesign', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: AAW, defaultPath: defaultFolder(docsDir()) })
    if (r.canceled || !r.filePaths[0]) return null
    return readFile(r.filePaths[0], 'utf8')
  })
  ipcMain.handle('plans:readDesign', async (_e, folder: string) => readDesign(root(), folder))
  ipcMain.handle('plans:savePage', async (_e, folder: string, n: number, png: Uint8Array) => savePage(root(), folder, n, png))
  ipcMain.handle('plans:fileUrl', async (_e, folder: string, rel: string) => fileDataUrl(root(), folder, rel))
  ipcMain.handle('plans:addPhoto', async (_e, folder: string, id: string) => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'Photos', extensions: PHOTO_TYPES }] })
    if (r.canceled || !r.filePaths[0]) return null
    let img = await loadPhoto(r.filePaths[0]).catch(() => nativeImage.createEmpty())
    if (img.isEmpty()) throw new Error("That photo couldn't be read. Try a JPG or PNG.")
    const { width, height } = img.getSize()
    const scale = Math.min(1, PHOTO_MAX / Math.max(width, height))
    if (scale < 1) img = img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' })
    return savePhotoBytes(root(), folder, id, img.toJPEG(85))
  })
  ipcMain.handle('plans:ocr', async (_e, bytes: Uint8Array, page: number) => ocrImage(bytes, page))
  ipcMain.handle('plans:capture', async (_e, url: string) =>
    capturePage(url, { fetcher: u => net.fetch(u), makeWindow: opts => new BrowserWindow(opts) })
  )
  ipcMain.handle('plans:pickImport', async (_e, kind: 'pdf' | 'photos') => {
    const filters = kind === 'pdf' ? [{ name: 'PDF plans', extensions: ['pdf'] }] : [{ name: 'Photos and scans', extensions: PHOTO_TYPES }]
    const r = await dialog.showOpenDialog(win!, { properties: kind === 'pdf' ? ['openFile'] : ['openFile', 'multiSelections'], filters })
    if (r.canceled) return []
    return Promise.all(r.filePaths.map(async p => {
      if (kind === 'pdf') return { name: basename(p), bytes: new Uint8Array(await readFile(p)) }
      // Photos arrive as PNG/JPEG bytes the page can draw (HEIC is decoded here).
      const raw = new Uint8Array(await readFile(p))
      if (!isHeic(raw)) return { name: basename(p), bytes: raw }
      const img = await loadPhoto(p)
      return { name: basename(p).replace(/\.hei[cf]$/i, '.png'), bytes: new Uint8Array(img.toPNG()) }
    }))
  })
  ipcMain.on('aa:setDirty', (_e, value: boolean) => {
    dirty = value
  })
  ipcMain.on('aa:setTitle', (_e, title: string) => {
    win?.setTitle(title)
  })
  ipcMain.on('aa:closeAfterSave', (_e, saved: boolean) => {
    if (saved) {
      allowClose = true
      win?.close()
    }
  })
}

app.whenReady().then(async () => {
  // The text reader's language data ships unpacked next to the app archive (see electron-builder.yml).
  configureOcr({ langPath: join(app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked'), 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int') })
  await mkdir(defaultFolder(docsDir()), { recursive: true }).catch(() => undefined)
  register()
  createWindow()
  // A reload or a crashed page can't say Shop Mode closed: let the screen sleep again.
  win?.webContents.on('did-start-loading', () => releaseAwake())
  win?.webContents.on('render-process-gone', () => releaseAwake())
})
app.on('window-all-closed', () => app.quit())

