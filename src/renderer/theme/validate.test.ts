import { describe, it, expect } from 'vitest'
import { sanitizeVars, sanitizeManifest } from './validate'

describe('sanitizeVars', () => {
  it('keeps well-formed custom properties', () => {
    expect(sanitizeVars({ '--bg': '#c0c0c0', '--font': 'Tahoma, sans-serif' })).toEqual({
      '--bg': '#c0c0c0',
      '--font': 'Tahoma, sans-serif'
    })
  })

  it('drops CSS-breakout payloads and bad keys/values', () => {
    const out = sanitizeVars({
      '--x': 'red} body{display:none', // breakout
      '--u': 'url(http://evil/x.png)', // url()
      '--e': 'expression(alert(1))', // expression()
      '--j': 'javascript:alert(1)',
      '--i': '@import "x"',
      bad: 'value', // key not --…
      '--ok': 'blue',
      '--n': 123 // non-string
    })
    expect(out).toEqual({ '--ok': 'blue' })
  })
})

describe('sanitizeManifest', () => {
  it('enforces id/name and falls back', () => {
    const m = sanitizeManifest({}, 'ie5')
    expect(m.id).toBe('ie5')
    expect(m.name).toBe('ie5')
  })

  it('keeps only known toolbar items and drops the field when none survive', () => {
    const ok = sanitizeManifest({ id: 't', name: 'T', toolbar: ['back', 'evil', '|', 'home'] }, 't')
    expect(ok.toolbar).toEqual(['back', '|', 'home'])

    const bogus = sanitizeManifest({ id: 't', name: 'T', toolbar: ['nope', 42] }, 't')
    expect(bogus.toolbar).toBeUndefined() // → UI falls back to DEFAULT_TOOLBAR

    const notArray = sanitizeManifest({ id: 't', name: 'T', toolbar: 'back' }, 't')
    expect(notArray.toolbar).toBeUndefined()
  })

  it('coerces menus/labels/layout to safe shapes', () => {
    const m = sanitizeManifest(
      {
        id: 't',
        name: 'T',
        menus: ['File', 42, '', 'Help'],
        labels: { back: 'Zurück', bad: 7 },
        layout: ['not', 'an', 'object']
      },
      't'
    )
    expect(m.menus).toEqual(['File', 'Help'])
    expect(m.labels).toEqual({ back: 'Zurück' })
    expect(m.layout).toBeUndefined()
  })

  it('restricts homeUrl to http/https', () => {
    expect(sanitizeManifest({ homeUrl: 'javascript:alert(1)' }, 'x').homeUrl).toBeUndefined()
    expect(sanitizeManifest({ homeUrl: 'https://ok.com' }, 'x').homeUrl).toBe('https://ok.com')
  })
})
