import { contextBridge, ipcRenderer } from 'electron'
import type { ContentInsets, OldwebAPI, ShellEvent } from '../shared/types'

const api: OldwebAPI = {
  createTab: (url) => ipcRenderer.invoke('shell:createTab', url),
  closeTab: (id) => ipcRenderer.invoke('shell:closeTab', id),
  activateTab: (id) => ipcRenderer.invoke('shell:activateTab', id),
  navigate: (id, input) => ipcRenderer.invoke('shell:navigate', id, input),
  goBack: (id) => ipcRenderer.invoke('shell:goBack', id),
  goForward: (id) => ipcRenderer.invoke('shell:goForward', id),
  openAbout: (id, themeId) => ipcRenderer.invoke('shell:openAbout', id, themeId),
  openThemePage: (id, themeId, page) =>
    ipcRenderer.invoke('shell:openThemePage', id, themeId, page),
  reload: (id) => ipcRenderer.invoke('shell:reload', id),
  stop: (id) => ipcRenderer.invoke('shell:stop', id),
  editCommand: (id, cmd) => ipcRenderer.invoke('shell:editCommand', id, cmd),
  zoomStep: (id, dir) => ipcRenderer.invoke('shell:zoomStep', id, dir),
  shareSources: (id, opts) => ipcRenderer.invoke('share:sources', id, opts),
  shareSave: (dataUrl, name) => ipcRenderer.invoke('share:save', dataUrl, name),
  shareCopy: (dataUrl) => ipcRenderer.invoke('share:copy', dataUrl),
  setContentInsets: (insets: ContentInsets) =>
    ipcRenderer.invoke('shell:setContentInsets', insets),
  setNetworkSpeed: (profile) => ipcRenderer.invoke('shell:setNetworkSpeed', profile),
  setAdblock: (enabled) => ipcRenderer.invoke('shell:setAdblock', enabled),
  setPageDisplay: (depth, dither, typo) =>
    ipcRenderer.invoke('shell:setPageDisplay', depth, dither, typo),
  setDisplayBySite: (bySite) => ipcRenderer.invoke('shell:setDisplayBySite', bySite),
  setScrollbar: (style) => ipcRenderer.invoke('shell:setScrollbar', style),
  setCrt: (on) => ipcRenderer.invoke('shell:setCrt', on),
  waybackMonths: (url, year) => ipcRenderer.invoke('wayback:months', url, year),
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
  setNativeMenu: (model) => ipcRenderer.invoke('menu:setNative', model),
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
