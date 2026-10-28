import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

export default function StockSearch({ value, onChange, placeholder = 'Search symbol…' }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query || query.length < 1) { setResults([]); return }
    const t = setTimeout(async () => {
      const data = await api.getSymbols(query)
      setResults(data || [])
      setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const select = (item) => {
    setQuery(item.name)
    setOpen(false)
    onChange(item)
  }

  return (
    <div className="search-wrap" ref={ref}>
      <input
        className="form-input"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => query && setOpen(true)}
        placeholder={placeholder}
        style={{ minWidth: 220 }}
      />
      {open && results.length > 0 && (
        <div className="search-dropdown">
          {results.map(s => (
            <div key={s.symbol} className="search-item" onClick={() => select(s)}>
              <div>
                <div className="search-item-name">{s.name}</div>
                <div className="search-item-sym">{s.symbol}</div>
              </div>
              <span className="tag tag-blue" style={{ fontSize: 10 }}>{s.sector}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
