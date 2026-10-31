import type { Progress } from '../kids/progress'
import type { Plan, TextLine } from '../plans/types'
import type { Wood } from '../model/types'

export type OpenedProject = {
  path: string
  text: string
  autosaveNewer: boolean
  autosaveText?: string
  backupPath: string
}

export type AaApi = {
  openProject(): Promise<OpenedProject | null>
  saveProject(path: string, text: string): Promise<void>
  saveAs(text: string, suggestedName: string): Promise<string | null>
  writeAutosave(path: string | null, text: string): Promise<void>
  readUntitledAutosave(): Promise<string | null>
  /** Remove the autosave for a file (null: the untitled autosave). */
  deleteAutosave(path: string | null): Promise<void>
  exportCsv(text: string, suggestedName: string): Promise<string | null>
  /** Save a 3D file (OBJ also writes its .mtl beside it). Returns the path, or null when cancelled. */
  exportFile(ext: string, data: Uint8Array | string, suggestedName: string, mtl?: string): Promise<string | null>
  /** Pick a 3D model to bring in as a reference. */
  importModel(): Promise<{ name: string; bytes: Uint8Array } | null>
  /** The shop's stock on hand (shared by every project). */
  loadStock(): Promise<unknown>
  saveStock(items: unknown): Promise<void>
  /** Save a shape for a CNC (DXF) or laser/vinyl cutter (SVG); returns where, or null if cancelled. */
  exportShape(kind: 'dxf' | 'svg', text: string, suggestedName: string): Promise<string | null>
  /** Opens an allowed https link in the system browser. */
  openLink(url: string): Promise<boolean>
  /** The shop journal or inventory from the app's data folder (null if none yet). */
  /** The file's contents (or its last good copy when `damaged`); null data when there's no file yet. */
  loadData(name: 'journal' | 'inventory'): Promise<{ data: unknown; damaged: boolean }>
  saveData(name: 'journal' | 'inventory', data: unknown): Promise<void>
  /** A photo the page can't decode (iPhone HEIC) as a small JPEG data URL, or null. */
  photoThumbnail?(bytes: Uint8Array, max: number): Promise<string | null>
  /** Saves what printing would print as a PDF; the chosen path, or null. */
  savePdf(name: string): Promise<string | null>
  /** Saves a PNG picture (a data URL) where the user picks; the path, or null if cancelled. */
  savePng(name: string, dataUrl: string): Promise<string | null>
  /** Makes that PDF in a temporary folder and opens it in the system's PDF viewer to print; false if it couldn't. */
  printPdf(name: string): Promise<boolean>
  /** Print the page; landscape unless told otherwise. */
  print(opts?: { landscape?: boolean; edgeToEdge?: boolean }): Promise<void>
  /** Keep the display awake (Shop Mode). */
  keepAwake(on: boolean): Promise<void>
  loadUserWoods(): Promise<Wood[]>
  saveUserWoods(woods: Wood[]): Promise<void>
  setDirty(dirty: boolean): void
  setTitle(title: string): void
  onSaveRequest(cb: () => void): void
  closeAfterSave(saved: boolean): void
  kidsLoad(): Promise<{ progress: Progress; notice: string | null }>
  kidsSave(p: Progress): Promise<void>
  kidsPinIsSet(): Promise<boolean>
  /** Rejects with 'PIN must be 4 digits' for anything else. */
  kidsSetPin(pin: string): Promise<void>
  kidsCheckPin(pin: string): Promise<boolean>
  kidsPinPath(): Promise<string>
  /** Opens a file picker; returns the saved photo's file name, or null if cancelled. */
  kidsAddPhoto(projectId: string): Promise<string | null>
  kidsPhotoUrl(name: string): Promise<string | null>
  plansList(): Promise<{ folder: string; plan: Plan | null; error?: string; notice?: string }[]>
  plansLoad(folder: string): Promise<{ plan: Plan; notice: string | null }>
  /** Makes the plan's folder (named after the plan) and returns the folder name. */
  plansCreate(plan: Plan): Promise<string>
  plansSave(folder: string, plan: Plan): Promise<void>
  /** Removes a plan folder; used when an import is cancelled. */
  plansDiscard(folder: string): Promise<void>
  /** Rename a plan's folder to follow its name; returns the folder name now in use. */
  plansRename(folder: string, name: string): Promise<string>
  plansAttachDesign(folder: string, aawText: string): Promise<void>
  /** File picker for an .aaw design; returns its text or null. */
  plansPickDesign(): Promise<string | null>
  plansReadDesign(folder: string): Promise<string | null>
  plansSavePage(folder: string, n: number, png: Uint8Array): Promise<string>
  plansFileUrl(folder: string, rel: string): Promise<string | null>
  plansAddPhoto(folder: string, id: string): Promise<string | null>
  plansPickImport(kind: 'pdf' | 'photos'): Promise<{ name: string; bytes: Uint8Array }[]>
  /** Read the text of a page picture (offline). */
  plansOcr(bytes: Uint8Array, page: number): Promise<TextLine[]>
  /** Open a web page once and save it as a PDF; rejects with 'web' on failure. */
  plansCapture(url: string): Promise<Uint8Array>
}

declare global {
  interface Window {
    aa: AaApi
  }
}
