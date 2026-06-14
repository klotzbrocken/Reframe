import { useEffect, useRef, useState } from 'react'
import type { ShellEvent, TabState } from '../../shared/types'

export interface ShellState {
  tabs: TabState[]
  activeId: number | null
  statusText: string
  maximized: boolean
}

export interface ShellActions {
  newTab: () => void
  closeTab: (id: number) => void
  activate: (id: number) => void
  navigate: (input: string) => void
  back: () => void
  forward: () => void
  reload: () => void
  stop: () => void
  print: () => void
  toggleRetro: () => void
  toggleOldWeb: () => void
  setOldWebDate: (date: string) => void
}

const empty: ShellState = { tabs: [], activeId: null, statusText: '', maximized: false }

/** Subscribes to engine events and exposes a React-friendly state + actions. */
export function useShell(onLoadStart?: () => void): {
  state: ShellState
  actions: ShellActions
  retro: boolean
  oldWeb: boolean
} {
  const [state, setState] = useState<ShellState>(empty)
  const [retro, setRetro] = useState(false)
  const [oldWeb, setOldWeb] = useState(false)
  const oldWebRef = useRef(false)
  const oldWebDateRef = useRef('2002')
  const activeRef = useRef<number | null>(null)
  const loadStartRef = useRef(onLoadStart)
  loadStartRef.current = onLoadStart
  activeRef.current = state.activeId
  oldWebRef.current = oldWeb

  useEffect(() => {
    let active = true
    window.oldweb.getTabs().then((snap) => {
      if (active) setState((s) => ({ ...s, tabs: snap.tabs, activeId: snap.activeId }))
    })
    window.oldweb.isWindowMaximized().then((m) => {
      if (active) setState((s) => ({ ...s, maximized: m }))
    })

    const off = window.oldweb.onEvent((e: ShellEvent) => {
      setState((s) => reduce(s, e))
      if (e.type === 'load-start') loadStartRef.current?.()
    })
    return () => {
      active = false
      off()
    }
  }, [])

  const actions: ShellActions = {
    newTab: () => window.oldweb.createTab(),
    closeTab: (id) => window.oldweb.closeTab(id),
    activate: (id) => window.oldweb.activateTab(id),
    navigate: (input) => {
      const id = activeRef.current
      if (id == null) return
      // "Old Web": route every address through the Wayback Machine at the
      // theme's era date. The `if_` modifier returns the archived page WITHOUT
      // the Wayback navigation banner (same trick used for embeds).
      const target = oldWebRef.current
        ? `https://web.archive.org/web/${oldWebDateRef.current}if_/${input}`
        : input
      window.oldweb.navigate(id, target)
    },
    back: () => activeRef.current != null && window.oldweb.goBack(activeRef.current),
    forward: () => activeRef.current != null && window.oldweb.goForward(activeRef.current),
    reload: () => activeRef.current != null && window.oldweb.reload(activeRef.current),
    stop: () => activeRef.current != null && window.oldweb.stop(activeRef.current),
    print: () => activeRef.current != null && window.oldweb.print(activeRef.current),
    toggleRetro: () => {
      const id = activeRef.current
      if (id == null) return
      setRetro((prev) => {
        const next = !prev
        window.oldweb.setRetroContent(id, next)
        return next
      })
    },
    toggleOldWeb: () => setOldWeb((p) => !p),
    setOldWebDate: (date: string) => {
      oldWebDateRef.current = date
    }
  }

  return { state, actions, retro, oldWeb }
}

function reduce(s: ShellState, e: ShellEvent): ShellState {
  switch (e.type) {
    case 'tab-created':
      return s.tabs.some((t) => t.id === e.tab.id)
        ? s
        : { ...s, tabs: [...s.tabs, e.tab] }
    case 'tab-updated':
      return { ...s, tabs: s.tabs.map((t) => (t.id === e.tab.id ? e.tab : t)) }
    case 'tab-closed':
      return { ...s, tabs: s.tabs.filter((t) => t.id !== e.id) }
    case 'tab-activated':
      return { ...s, activeId: e.id }
    case 'load-start':
      return mark(s, e.id, true)
    case 'load-stop':
      return mark(s, e.id, false)
    case 'status-text':
      return { ...s, statusText: e.text }
    case 'window-maximize':
      return { ...s, maximized: e.maximized }
    default:
      return s
  }
}

function mark(s: ShellState, id: number, loading: boolean): ShellState {
  return { ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, isLoading: loading } : t)) }
}
