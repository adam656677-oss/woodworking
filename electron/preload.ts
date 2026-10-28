import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('aa', {})
