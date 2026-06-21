import { describe, it, expect } from 'vitest'
import { normalizeInput, isAllowedExternal } from './url'

describe('normalizeInput', () => {
  it('passes http/https through unchanged', () => {
    expect(normalizeInput('https://example.com/x')).toBe('https://example.com/x')
    expect(normalizeInput('http://example.com')).toBe('http://example.com')
  })

  it('returns null for empty input and about:blank', () => {
    expect(normalizeInput('')).toBeNull()
    expect(normalizeInput('   ')).toBeNull()
    expect(normalizeInput('about:blank')).toBeNull()
  })

  it('never navigates to dangerous / non-web schemes (searches instead)', () => {
    for (const s of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>x</script>',
      'about:config',
      'chrome://settings',
      'vbscript:msgbox',
      'smb://server/share'
    ]) {
      const out = normalizeInput(s)
      expect(out).not.toBeNull()
      expect(out!.startsWith('https://duckduckgo.com/?q=')).toBe(true)
    }
  })

  it('treats a bare domain as https', () => {
    expect(normalizeInput('example.com')).toBe('https://example.com')
    expect(normalizeInput('sub.example.co.uk/path')).toBe('https://sub.example.co.uk/path')
  })

  it('treats localhost as http', () => {
    expect(normalizeInput('localhost')).toBe('http://localhost')
    expect(normalizeInput('localhost:3000')).toBe('http://localhost:3000')
  })

  it('searches free text', () => {
    expect(normalizeInput('hello world')).toBe(
      'https://duckduckgo.com/?q=' + encodeURIComponent('hello world')
    )
  })
})

describe('isAllowedExternal', () => {
  it('allows http, https and mailto', () => {
    expect(isAllowedExternal('https://x.com')).toBe(true)
    expect(isAllowedExternal('http://x.com')).toBe(true)
    expect(isAllowedExternal('mailto:a@b.com')).toBe(true)
  })

  it('rejects everything else and malformed input', () => {
    for (const s of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,x',
      'smb://h/s',
      'chrome://x',
      'not a url',
      '',
      'ftp://h/f'
    ]) {
      expect(isAllowedExternal(s)).toBe(false)
    }
  })
})
