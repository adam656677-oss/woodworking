import { app, BrowserWindow, dialog, ipcMain, nativeImage, net } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { autosavePath, defaultFolder, deleteAutosave, load, safeSave, writeAutosave } from './fileStore'
import { checkPin, loadProgress, pinFilePath, pinIsSet, saveProgress, setPin } from './kidsStore'
import {
  attachDesign, createPlanFolder, deletePlanFolder, fileDataUrl, listPlans, loadPlan, plansRoot, readDesign, renamePlanFolder, savePage, savePhotoBytes, savePlan
} from './plansStore'
import type { Plan } from '../src/plans/types'
import { configureOcr, ocrImage } from './ocr'
import { heicToRgba, isHeic } from './heic'
import { capturePage } from './webCapture'
import type { Progress } from '../src/kids/progress'

// Test hooks: e2e runs point these at temp folders so they never touch real documents or settings.
if (process.env.AA_USER_DATA) app.setPath('userData', process.env.AA_USER_DATA)
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
  const bytes = new Uint8Array(await readFile(path))
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
  ipcMain.handle('aa:print', async (_e, opts?: { landscape?: boolean }) => {
    const landscape = opts?.landscape ?? true
    await new Promise<void>(resolve => win!.webContents.print({ landscape }, () => resolve()))
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
  // ---- Kids' Workshop ----
  const kidsDir = async () => {
    const d = app.getPath('userData')
    await mkdir(d, { recursive: true })
    return d
  }
  const PHOTO_MAX = 1600
  ipcMain.handle('kids:load', async () => loadProgress(await kidsDir()))
  ipcMain.handle('kids:save', async (_e, p: Progress) => saveProgress(await kidsDir(), p))
  ipcMain.handle('kids:pinIsSet', async () => pinIsSet(await kidsDir()))
  ipcMain.handle('kids:setPin', async (_e, pin: string) => setPin(await kidsDir(), pin))
  ipcMain.handle('kids:checkPin', async (_e, pin: string) => checkPin(await kidsDir(), pin))
  ipcMain.handle('kids:pinPath', async () => pinFilePath(await kidsDir()))
  ipcMain.handle('kids:addPhoto', async (_e, projectId: string) => {
    if (!/^[a-z0-9-]+$/.test(projectId)) return null
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'Photos', extensions: PHOTO_TYPES }] })
    if (r.canceled || !r.filePaths[0]) return null
    let img = await loadPhoto(r.filePaths[0]).catch(() => nativeImage.createEmpty())
    if (img.isEmpty()) throw new Error("That photo couldn't be read. Try a JPG or PNG.")
    const { width, height } = img.getSize()
    const scale = Math.min(1, PHOTO_MAX / Math.max(width, height))
    if (scale < 1) img = img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' })
    const folder = join(await kidsDir(), 'kids-photos')
    await mkdir(folder, { recursive: true })
    const name = `${projectId}.jpg`
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
})
app.on('window-all-closed', () => app.quit())

