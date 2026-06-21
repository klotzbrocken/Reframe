import { describe, it, expect } from 'vitest'
import {
  isWayback,
  unwrapWayback,
  wrapWayback,
  waybackDisplay,
  stripWaybackDisplay
} from './wayback'

const SNAP = 'https://web.archive.org/web/20030603203611if_/http://www.amazon.com/'

describe('wayback helpers', () => {
  it('detects wayback URLs', () => {
    expect(isWayback(SNAP)).toBe(true)
    expect(isWayback('https://www.amazon.com')).toBe(false)
  })

  it('unwraps to the original target (and is idempotent)', () => {
    expect(unwrapWayback(SNAP)).toBe('http://www.amazon.com/')
    expect(unwrapWayback('https://plain.example')).toBe('https://plain.example')
    expect(unwrapWayback(unwrapWayback(SNAP))).toBe('http://www.amazon.com/')
  })

  it('wraps any URL at a timestamp, re-wrapping cleanly', () => {
    expect(wrapWayback('http://x.com', '20010924')).toBe(
      'https://web.archive.org/web/20010924if_/http://x.com'
    )
    // wrapping an already-wrapped URL must not double-wrap
    expect(wrapWayback(SNAP, '19990101')).toBe(
      'https://web.archive.org/web/19990101if_/http://www.amazon.com/'
    )
  })

  it('round-trips the friendly display form', () => {
    const disp = waybackDisplay(SNAP, '2003')
    expect(disp).toBe('2003://http://www.amazon.com/')
    expect(stripWaybackDisplay(disp)).toBe('http://www.amazon.com/')
    expect(waybackDisplay('https://plain.example', '2003')).toBe('https://plain.example')
    expect(stripWaybackDisplay('https://plain.example')).toBe('https://plain.example')
  })
})
