const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = {
  getSymbols: (q) =>
    fetch(`${API_BASE}/api/data/symbols${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r => r.json()),

  getOHLCV: (symbol, interval, start, end, period) => {
    const p = new URLSearchParams({ symbol, interval })
    if (start) p.set('start', start)
    if (end) p.set('end', end)
    if (period) p.set('period', period)
    return fetch(`${API_BASE}/api/data/ohlcv?${p}`).then(r => r.json())
  },

  getChartData: (symbol, interval, start, end, period) => {
    const p = new URLSearchParams({ symbol, interval })
    if (start) p.set('start', start)
    if (end) p.set('end', end)
    if (period) p.set('period', period)
    return fetch(`${API_BASE}/api/indicators/chart-data?${p}`).then(r => r.json())
  },

  runBacktest: (payload) =>
    fetch(`${API_BASE}/api/backtest/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json()),

  getLiveSnapshot: (symbol) =>
    fetch(`${API_BASE}/api/live/snapshot?symbol=${encodeURIComponent(symbol)}`).then(r => r.json()),
}

export const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
