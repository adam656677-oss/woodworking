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
  /** Smart Helpers: whether a key is stored (never the key itself), and the model. */
  smartStatus(): Promise<{ hasKey: boolean; model: string; canStore: boolean }>
  smartSetKey(key: string | null): Promise<void>
  smartSetModel(model: string): Promise<void>
  /** One online helper request (only when the user presses its button); the helper's JSON answer, unchecked. */
  smartAsk(task: { task: 'photoPlan'; image: string; known: string } | { task: 'woodId'; image: string } | { task: 'describe'; text: string; templates: string }): Promise<unknown>
  /** Backs up everything (app data and the projects folder) to a file the user picks. */
  backup(): Promise<{ path: string; files: number; skipped: string[] } | null>
  /** Restores from a backup file the user picks; replaced files are kept aside in a _before-restore folder. */
  restore(pin: string): Promise<{ files: number; keptUser: string | null; keptDocs: string | null } | null>
  /** Opens a folder a restore set replaced files aside in. */
  showFolder?(path: string): Promise<void>
  savePackage(name: string, pkg: import('../family/package').ProjectPackage): Promise<string | null>
  openPackage(): Promise<import('../family/package').ProjectPackage | null>
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
  /** Saves progress to the child it belongs to (the one working now when not given). */
  kidsSave(p: Progress, profile?: string): Promise<void>
  kidsPinIsSet(): Promise<boolean>
  /** Rejects with 'PIN must be 4 digits' for anything else. */
  kidsSetPin(pin: string): Promise<void>
  kidsCheckPin(pin: string): Promise<boolean>
  kidsPinPath(): Promise<string>
  /** The children in the Kids' Workshop and who's working now. */
  kidsProfiles(): Promise<{ active: string; profiles: { id: string; name: string }[] }>
  kidsSwitch(id: string): Promise<void>
  /** Adds a child (parent PIN); their id, or null if the PIN was wrong. */
  kidsAddProfile(name: string, pin: string): Promise<string | null>
  kidsRemoveProfile(id: string, pin: string): Promise<boolean>
  /** Every child's progress (parent PIN), or null if the PIN was wrong. */
  kidsFamily(pin: string): Promise<{ id: string; name: string; progress: import('../kids/progress').Progress }[] | null>
  /** Opens a file picker; returns the saved photo's file name, or null if cancelled. */
  kidsAddPhoto(projectId: string, profile?: string): Promise<string | null>
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
