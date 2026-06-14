import type { OldwebAPI } from '../../shared/types'

declare global {
  interface Window {
    oldweb: OldwebAPI
  }
}

export {}
