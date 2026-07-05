import { useEffect, useRef, useState } from 'react'
import type { ShellEvent, TabState } from '../../shared/types'
import { unwrapWayback, wrapWayback } from './wayback'
import { normalizeInput, isWebSearchUrl } from '../../shared/url'

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
  /** Turn Wayback on/off explicitly (used by the floating controls) and
   *  re-navigate the current page through (or out of) the Wayback Machine. */
  setOldWebActive: (on: boolean) => void
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
  const currentUrlRef = useRef('')
  const loadStartRef = useRef(onLoadStart)
  loadStartRef.current = onLoadStart
  activeRef.current = state.activeId
  currentUrlRef.current = state.tabs.find((t) => t.id === state.activeId)?.url ?? ''
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
      if (!oldWebRef.current) {
        // Off: hand the raw input to the engine, which normalizes/searches it.
        window.oldweb.navigate(id, input)
        return
      }
      // "Old Web": normalize first, then route only a REAL destination URL
      // through the Wayback Machine (banner-free `if_` snapshot). Free text like
      // "cats" resolves to a live web search — wrapping it in Wayback would just
      // archive the literal string, so it stays un-wrapped.
      const normalized = normalizeInput(input)
      if (!normalized) return
      const target = isWebSearchUrl(normalized)
        ? normalized
        : wrapWayback(normalized, oldWebDateRef.current)
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
    toggleOldWeb: () => {
      const id = activeRef.current
      setOldWeb((prev) => {
        const next = !prev
        // Reload whatever is open through (or out of) the Wayback Machine, so
        // toggling immediately time-travels the current page.
        if (id != null && currentUrlRef.current) {
          const original = unwrapWayback(currentUrlRef.current)
          const target = next ? wrapWayback(original, oldWebDateRef.current) : original
          window.oldweb.navigate(id, target)
        }
        return next
      })
    },
    setOldWebActive: (on: boolean) => {
      const id = activeRef.current
      setOldWeb(on)
      if (id != null && currentUrlRef.current) {
        const original = unwrapWayback(currentUrlRef.current)
        const target = on ? wrapWayback(original, oldWebDateRef.current) : original
        window.oldweb.navigate(id, target)
      }
    },
    setOldWebDate: (date: string) => {
      // Guard against no-op calls: the App effect re-runs this on every render,
      // so only act when the era date actually changes — otherwise the
      // re-navigation below would loop.
      if (oldWebDateRef.current === date) return
      oldWebDateRef.current = date
      // If Old Web is active, immediately reload the current page at the new
      // snapshot (e.g. switching IE5 → IE6 changes the era), instead of waiting
      // for the next manual navigation / Time-Travel press.
      const id = activeRef.current
      if (oldWebRef.current && id != null && currentUrlRef.current) {
        const original = unwrapWayback(currentUrlRef.current)
        window.oldweb.navigate(id, wrapWayback(original, date))
      }
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
