import { contextBridge, ipcRenderer } from 'electron'
import type { ContentInsets, OldwebAPI, ShellEvent } from '../shared/types'

const api: OldwebAPI = {
  createTab: (url) => ipcRenderer.invoke('shell:createTab', url),
  closeTab: (id) => ipcRenderer.invoke('shell:closeTab', id),
  activateTab: (id) => ipcRenderer.invoke('shell:activateTab', id),
  navigate: (id, input) => ipcRenderer.invoke('shell:navigate', id, input),
  goBack: (id) => ipcRenderer.invoke('shell:goBack', id),
  goForward: (id) => ipcRenderer.invoke('shell:goForward', id),
  reload: (id) => ipcRenderer.invoke('shell:reload', id),
  stop: (id) => ipcRenderer.invoke('shell:stop', id),
  setContentInsets: (insets: ContentInsets) =>
    ipcRenderer.invoke('shell:setContentInsets', insets),
  setRetroContent: (id, enabled) =>
    ipcRenderer.invoke('shell:setRetroContent', id, enabled),
  setNetworkSpeed: (profile) => ipcRenderer.invoke('shell:setNetworkSpeed', profile),
  print: (id) => ipcRenderer.invoke('shell:print', id),
  savePage: (id) => ipcRenderer.invoke('shell:savePage', id),
  setImagesEnabled: (id, enabled) => ipcRenderer.invoke('shell:setImagesEnabled', id, enabled),
  setChromeOnTop: (onTop) => ipcRenderer.invoke('shell:setChromeOnTop', onTop),
  setAppIcon: (themeId) => ipcRenderer.invoke('app:setIcon', themeId),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  openLocalFile: () => ipcRenderer.invoke('app:openFile'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  splashDone: () => ipcRenderer.send('splash:done'),
  showThemeSplash: (themeId) => ipcRenderer.send('splash:theme', themeId),
  onMenuCommand: (handler) => {
    const listener = (_e: unknown, cmd: import('../shared/types').MenuCommand): void => handler(cmd)
    ipcRenderer.on('menu-command', listener)
    return () => ipcRenderer.removeListener('menu-command', listener)
  },
  getTabs: () => ipcRenderer.invoke('shell:getTabs'),
  minimizeWindow: () => ipcRenderer.invoke('shell:minimizeWindow'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('shell:toggleMaximizeWindow'),
  closeWindow: () => ipcRenderer.invoke('shell:closeWindow'),
  isWindowMaximized: () => ipcRenderer.invoke('shell:isWindowMaximized'),
  onEvent: (handler: (event: ShellEvent) => void) => {
    const listener = (_e: unknown, event: ShellEvent): void => handler(event)
    ipcRenderer.on('shell-event', listener)
    return () => ipcRenderer.removeListener('shell-event', listener)
  }
}

contextBridge.exposeInMainWorld('oldweb', api)
