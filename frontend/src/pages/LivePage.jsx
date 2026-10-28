import { useState, useEffect, useRef } from 'react'
import StockSearch from '../components/StockSearch'
import { api, WS_BASE } from '../api'

const fmtINR = v => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function LivePage() {
  const [symbol, setSymbol] = useState({ symbol: 'RELIANCE.NS', name: 'Reliance Industries' })
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const intervalRef = useRef()

  const fetchSnapshot = async (sym) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getLiveSnapshot(sym.symbol)
      setSnapshot(data)
      setLastUpdate(new Date())
    } catch {
      setError('Could not fetch live data. Markets may be closed or backend is down.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSnapshot(symbol)
    intervalRef.current = setInterval(() => fetchSnapshot(symbol), 10000)
    return () => clearInterval(intervalRef.current)
  }, [symbol])

  const handleSymbol = (s) => { setSymbol(s) }

  const isPos = snapshot?.change >= 0
  const pending = snapshot?.pending_signal

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">⚡ Live</div>
            <div className="page-subtitle">Real-time price & strategy signal monitor</div>
          </div>
          {lastUpdate && (
            <div className="live-pulse">
              <div className="pulse-dot" />
              Updated {lastUpdate.toLocaleTimeString('en-IN')}
            </div>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Controls */}
        <div className="flex items-center gap-3 mb-4">
          <StockSearch value={symbol.name} onChange={handleSymbol} />
          <button className="btn btn-ghost btn-sm" onClick={() => fetchSnapshot(symbol)} disabled={loading}>
            {loading ? '⏳' : '↺ Refresh'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-refreshes every 10s</span>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,78,106,0.1)', border: '1px solid rgba(255,78,106,0.3)', borderRadius: 8, padding: '12px 16px', color: 'var(--accent-red)', marginBottom: 16, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {loading && !snapshot && (
          <div className="loading-center"><div className="spinner" />Fetching live data…</div>
        )}

        {snapshot && (
          <div>
            {/* ── Price Card ── */}
            <div className="card mb-4" style={{ borderColor: isPos ? 'rgba(16,217,122,0.3)' : 'rgba(255,78,106,0.3)' }}>
              <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{symbol.symbol} · {symbol.name}</div>
                  <div style={{ fontSize: 42, fontWeight: 800, color: isPos ? 'var(--accent-green)' : 'var(--accent-red)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtINR(snapshot.price)}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className={`badge ${isPos ? 'badge-green' : 'badge-red'}`}>
                      {isPos ? '▲' : '▼'} {fmtINR(Math.abs(snapshot.change))} ({snapshot.change_pct?.toFixed(2)}%)
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Today</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 13 }}>
                  {[
                    ['Open', fmtINR(snapshot.open)],
                    ['High', fmtINR(snapshot.high)],
                    ['Low', fmtINR(snapshot.low)],
                    ['Volume', Number(snapshot.volume).toLocaleString('en-IN')],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{k}</div>
                      <div style={{ fontWeight: 700 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RSI Card ── */}
            <div className="grid-2 mb-4">
              <div className="card">
                <div className="card-title">RSI (14)</div>
                <div style={{
                  fontSize: 36, fontWeight: 800,
                  color: snapshot.rsi > 70 ? 'var(--accent-red)' : snapshot.rsi < 30 ? 'var(--accent-green)' : 'var(--accent)',
                }}>
                  {snapshot.rsi?.toFixed(2) ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {snapshot.rsi > 70 ? '⚠️ Overbought' : snapshot.rsi < 30 ? '✅ Oversold' : 'Neutral zone'}
                </div>
              </div>
              <div className="card">
                <div className="card-title">RSI-MA SMA(14)</div>
                <div style={{
                  fontSize: 36, fontWeight: 800,
                  color: snapshot.rsi_ma > 50 ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {snapshot.rsi_ma?.toFixed(2) ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {snapshot.rsi_ma > 50 ? '📈 Bullish bias (MA > 50)' : '📉 Bearish bias (MA < 50)'}
                </div>
              </div>
            </div>

            {/* ── Signal Alert ── */}
            {pending ? (
              <div style={{
                background: pending.direction === 'LONG' ? 'rgba(16,217,122,0.08)' : 'rgba(255,78,106,0.08)',
                border: `1px solid ${pending.direction === 'LONG' ? 'rgba(16,217,122,0.4)' : 'rgba(255,78,106,0.4)'}`,
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>{pending.direction === 'LONG' ? '🟢' : '🔴'}</span>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: pending.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {pending.direction} SETUP DETECTED
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Crossover just happened on current candle
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    ['Trigger Price', fmtINR(pending.trigger)],
                    ['Stop Loss', fmtINR(+(pending.trigger * (pending.direction === 'LONG' ? 0.999 : 1.001)).toFixed(2))],
                    ['Target (1:3)', fmtINR(+(pending.direction === 'LONG'
                      ? pending.trigger + 3 * pending.trigger * 0.001
                      : pending.trigger - 3 * pending.trigger * 0.001).toFixed(2))],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                  ⚡ Place a {pending.direction === 'LONG' ? 'buy-stop' : 'sell-stop'} order at trigger price. Valid on the NEXT candle only.
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(99,130,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                No active setup right now. Monitoring for RSI crossover…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
