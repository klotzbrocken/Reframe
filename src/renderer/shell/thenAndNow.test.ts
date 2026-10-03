import { describe, it, expect } from 'vitest'
import { normalizeThenAndNow } from './thenAndNow'

const PNG_A = 'data:image/png;base64,AAAA'
const PNG_B = 'data:image/png;base64,BBBB'

describe('normalizeThenAndNow', () => {
  it('reports the snapshot’s own year, not the one that was asked for', () => {
    const r = normalizeThenAndNow({ today: PNG_A, year: PNG_B, snapYear: '2002' }, 2001)
    expect(r).toEqual({ kind: 'ok', today: PNG_A, then: PNG_B, year: '2002' })
  })

  it('falls back to the asked year when the engine reports no snapshot year', () => {
    const r = normalizeThenAndNow({ today: PNG_A, year: PNG_B }, 2001)
    expect(r).toEqual({ kind: 'ok', today: PNG_A, then: PNG_B, year: '2001' })
  })

  it('hands a far-off snapshot back to be confirmed instead of applying it', () => {
    expect(normalizeThenAndNow({ suggestYear: '2015' }, 1999)).toEqual({
      kind: 'suggest',
      year: 2015
    })
  })

  it('passes the engine’s own error through', () => {
    expect(normalizeThenAndNow({ error: 'No archive snapshot found for this page.' }, 2001)).toEqual(
      { kind: 'error', message: 'No archive snapshot found for this page.' }
    )
  })

  it('treats a half-captured pair as an error rather than rendering one side', () => {
    expect(normalizeThenAndNow({ today: PNG_A }, 2001).kind).toBe('error')
    expect(normalizeThenAndNow({ year: PNG_B }, 2001).kind).toBe('error')
    expect(normalizeThenAndNow({}, 2001).kind).toBe('error')
  })

  it('does not mistake an unparseable suggestion for a year', () => {
    expect(normalizeThenAndNow({ suggestYear: 'soon' }, 2001).kind).toBe('error')
  })
})
