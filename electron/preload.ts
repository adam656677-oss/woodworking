import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('aa', {
  openProject: () => ipcRenderer.invoke('aa:openProject'),
  saveProject: (path: string, text: string) => ipcRenderer.invoke('aa:saveProject', path, text),
  saveAs: (text: string, suggestedName: string) => ipcRenderer.invoke('aa:saveAs', text, suggestedName),
  writeAutosave: (path: string | null, text: string) => ipcRenderer.invoke('aa:writeAutosave', path, text),
  readUntitledAutosave: () => ipcRenderer.invoke('aa:readUntitledAutosave'),
  deleteAutosave: (path: string | null) => ipcRenderer.invoke('aa:deleteAutosave', path),
  exportCsv: (text: string, suggestedName: string) => ipcRenderer.invoke('aa:exportCsv', text, suggestedName),
  print: (opts?: { landscape?: boolean }) => ipcRenderer.invoke('aa:print', opts),
  loadUserWoods: () => ipcRenderer.invoke('aa:loadUserWoods'),
  saveUserWoods: (woods: unknown) => ipcRenderer.invoke('aa:saveUserWoods', woods),
  setDirty: (dirty: boolean) => ipcRenderer.send('aa:setDirty', dirty),
  setTitle: (title: string) => ipcRenderer.send('aa:setTitle', title),
  onSaveRequest: (cb: () => void) => {
    ipcRenderer.removeAllListeners('aa:save-request')
    ipcRenderer.on('aa:save-request', () => cb())
  },
  closeAfterSave: (saved: boolean) => ipcRenderer.send('aa:closeAfterSave', saved),
  kidsLoad: () => ipcRenderer.invoke('kids:load'),
  kidsSave: (p: unknown) => ipcRenderer.invoke('kids:save', p),
  kidsPinIsSet: () => ipcRenderer.invoke('kids:pinIsSet'),
  kidsSetPin: (pin: string) => ipcRenderer.invoke('kids:setPin', pin),
  kidsCheckPin: (pin: string) => ipcRenderer.invoke('kids:checkPin', pin),
  kidsPinPath: () => ipcRenderer.invoke('kids:pinPath'),
  kidsAddPhoto: (projectId: string) => ipcRenderer.invoke('kids:addPhoto', projectId),
  kidsPhotoUrl: (name: string) => ipcRenderer.invoke('kids:photoUrl', name),
  plansList: () => ipcRenderer.invoke('plans:list'),
  plansLoad: (folder: string) => ipcRenderer.invoke('plans:load', folder),
  plansCreate: (plan: unknown) => ipcRenderer.invoke('plans:create', plan),
  plansSave: (folder: string, plan: unknown) => ipcRenderer.invoke('plans:save', folder, plan),
  plansDiscard: (folder: string) => ipcRenderer.invoke('plans:discard', folder),
  plansAttachDesign: (folder: string, text: string) => ipcRenderer.invoke('plans:attachDesign', folder, text),
  plansPickDesign: () => ipcRenderer.invoke('plans:pickDesign'),
  plansReadDesign: (folder: string) => ipcRenderer.invoke('plans:readDesign', folder),
  plansSavePage: (folder: string, n: number, png: Uint8Array) => ipcRenderer.invoke('plans:savePage', folder, n, png),
  plansFileUrl: (folder: string, rel: string) => ipcRenderer.invoke('plans:fileUrl', folder, rel),
  plansAddPhoto: (folder: string, id: string) => ipcRenderer.invoke('plans:addPhoto', folder, id),
  plansPickImport: (kind: 'pdf' | 'photos') => ipcRenderer.invoke('plans:pickImport', kind)
})
