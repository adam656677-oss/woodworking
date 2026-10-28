import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('aa', {
  openProject: () => ipcRenderer.invoke('aa:openProject'),
  saveProject: (path: string, text: string) => ipcRenderer.invoke('aa:saveProject', path, text),
  saveAs: (text: string, suggestedName: string) => ipcRenderer.invoke('aa:saveAs', text, suggestedName),
  writeAutosave: (path: string | null, text: string) => ipcRenderer.invoke('aa:writeAutosave', path, text),
  readUntitledAutosave: () => ipcRenderer.invoke('aa:readUntitledAutosave'),
  exportCsv: (text: string, suggestedName: string) => ipcRenderer.invoke('aa:exportCsv', text, suggestedName),
  print: () => ipcRenderer.invoke('aa:print'),
  loadUserWoods: () => ipcRenderer.invoke('aa:loadUserWoods'),
  saveUserWoods: (woods: unknown) => ipcRenderer.invoke('aa:saveUserWoods', woods),
  setDirty: (dirty: boolean) => ipcRenderer.send('aa:setDirty', dirty),
  setTitle: (title: string) => ipcRenderer.send('aa:setTitle', title),
  onSaveRequest: (cb: () => void) => {
    ipcRenderer.removeAllListeners('aa:save-request')
    ipcRenderer.on('aa:save-request', () => cb())
  },
  closeAfterSave: (saved: boolean) => ipcRenderer.send('aa:closeAfterSave', saved)
})
