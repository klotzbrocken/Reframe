// Search engines offered by the toolbar search box. The monograms are plain
// styled letters (no third-party logos), matching the period look.

export interface SearchEngine {
  id: string
  name: string
  letter: string
  color: string
  search: (query: string) => string
}

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    letter: 'G',
    color: '#4a76d6',
    search: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
  },
  {
    id: 'bing',
    name: 'Bing',
    letter: 'b',
    color: '#0c8484',
    search: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    letter: 'D',
    color: '#de5833',
    search: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
  },
  {
    id: 'ebay',
    name: 'eBay',
    letter: 'e',
    color: '#3f9e46',
    search: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`
  },
  {
    id: 'amazon',
    name: 'Amazon',
    letter: 'a',
    color: '#d98123',
    search: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`
  }
]

export const DEFAULT_ENGINE_ID = 'google'

export function engineById(id: string | undefined): SearchEngine {
  return SEARCH_ENGINES.find((e) => e.id === id) ?? SEARCH_ENGINES[0]
}
