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
  print(): Promise<void>
  loadUserWoods(): Promise<Wood[]>
  saveUserWoods(woods: Wood[]): Promise<void>
  setDirty(dirty: boolean): void
  setTitle(title: string): void
  onSaveRequest(cb: () => void): void
  closeAfterSave(saved: boolean): void
}

declare global {
  interface Window {
    aa: AaApi
  }
}
