/*
 * Runtime validation for values crossing the IPC boundary. The renderer is
 * sandboxed but still untrusted from the main process's point of view, so every
 * channel coerces/bounds its arguments here before handing them to the engine.
 */
import type { ContentInsets } from '../shared/types'

/** A usable tab id (the shell additionally checks existence via tabs.get). */
export function validId(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}

export function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function asBool(v: unknown): boolean {
  return v === true
}

const INSET_MAX = 10000

function finiteClamped(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return Math.min(INSET_MAX, Math.max(0, n))
}

/** Coerce arbitrary renderer input into safe, finite, bounded content insets. */
export function sanitizeInsets(raw: unknown): ContentInsets {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    top: finiteClamped(o.top),
    right: finiteClamped(o.right),
    bottom: finiteClamped(o.bottom),
    left: finiteClamped(o.left)
  }
}
