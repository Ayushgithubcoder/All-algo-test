import { useState } from 'react'
import ChartPage from './pages/ChartPage'
import BacktestPage from './pages/BacktestPage'
import LivePage from './pages/LivePage'

const NAV = [
  { id: 'chart',    icon: '📈', label: 'Chart' },
  { id: 'backtest', icon: '🔁', label: 'Backtest' },
  { id: 'live',     icon: '⚡', label: 'Live' },
]

export default function App() {
  const [page, setPage] = useState('chart')

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">AlgoTrader</div>
          <div className="logo-sub">NSE · Strategy Platform</div>
        </div>

        <div className="nav-section-title">Navigation</div>
        {NAV.map(n => (
          <div
            key={n.id}
            className={`nav-item ${page === n.id ? 'active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </div>
        ))}

        {/* strategy info card */}
        <div style={{ padding: '16px 14px', marginTop: 'auto' }}>
          <div style={{
            background: 'rgba(99,130,255,0.07)',
            border: '1px solid rgba(99,130,255,0.18)',
            borderRadius: 10, padding: '12px',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Active Strategy</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>RSI × RSI-MA</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              RSI(14) × SMA(14)<br />
              SL 0.1% · TP 1:3 · 5m
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        {page === 'chart'    && <ChartPage />}
        {page === 'backtest' && <BacktestPage />}
        {page === 'live'     && <LivePage />}
      </main>
    </div>
  )
}
