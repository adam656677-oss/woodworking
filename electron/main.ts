import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { autosavePath, defaultFolder, deleteAutosave, load, safeSave, writeAutosave } from './fileStore'
import { checkPin, loadProgress, pinFilePath, pinIsSet, saveProgress, setPin } from './kidsStore'
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
  ipcMain.handle('aa:print', async () => {
    await new Promise<void>(resolve => win!.webContents.print({ landscape: true }, () => resolve()))
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
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'Photos', extensions: ['jpg', 'jpeg', 'png'] }] })
    if (r.canceled || !r.filePaths[0]) return null
    let img = nativeImage.createFromPath(r.filePaths[0])
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
  await mkdir(defaultFolder(docsDir()), { recursive: true }).catch(() => undefined)
  register()
  createWindow()
})
app.on('window-all-closed', () => app.quit())

