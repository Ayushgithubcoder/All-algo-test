import { useState, useCallback } from 'react'
import StockSearch from '../components/StockSearch'
import CandleChart from '../components/CandleChart'
import RsiChart from '../components/RsiChart'
import { api } from '../api'

const TIMEFRAMES = [
  { label: '5m',  value: '5m',  period: '60d' },
  { label: '15m', value: '15m', period: '60d' },
  { label: '1h',  value: '1h',  period: '1y'  },
  { label: '1d',  value: '1d',  period: '2y'  },
]

export default function ChartPage() {
  const [symbol, setSymbol] = useState({ symbol: 'RELIANCE.NS', name: 'Reliance Industries' })
  const [tf, setTf] = useState(TIMEFRAMES[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chartData, setChartData] = useState(null)

  const load = useCallback(async (sym, timeframe) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getChartData(sym.symbol, timeframe.value, null, null, timeframe.period)
      setChartData(data)
    } catch (e) {
      setError('Failed to load chart data. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSymbol = (s) => { setSymbol(s); load(s, tf) }
  const handleTf = (t) => { setTf(t); load(symbol, t) }

  // Build trade markers for candle chart from crossover markers
  const candleMarkers = (chartData?.crossover_markers || []).map(m => ({
    time: m.time,
    position: m.type === 'crossover_long' ? 'belowBar' : 'aboveBar',
    color: m.type === 'crossover_long' ? '#10d97a' : '#ff4e6a',
    shape: m.type === 'crossover_long' ? 'arrowUp' : 'arrowDown',
    text: m.type === 'crossover_long' ? '▲' : '▼',
    size: 1,
  }))

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">📈 Chart</div>
            <div className="page-subtitle">RSI(14) × SMA-MA(14) — live signal overlay</div>
          </div>
          {chartData && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {chartData.candle_count ?? 0} candles loaded
            </div>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Controls */}
        <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
          <StockSearch value={symbol.name} onChange={handleSymbol} />

          {/* Timeframe tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            {TIMEFRAMES.map(t => (
              <button
                key={t.value}
                className={`btn btn-sm ${tf.value === t.value ? 'btn-primary' : 'btn-ghost'}`}
                style={{ border: 'none' }}
                onClick={() => handleTf(t)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => load(symbol, tf)} disabled={loading}>
            {loading ? '⏳ Loading…' : '↺ Refresh'}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,78,106,0.1)', border: '1px solid rgba(255,78,106,0.3)', borderRadius: 8, padding: '12px 16px', color: 'var(--accent-red)', marginBottom: 16, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Empty state — prompt to load */}
        {!chartData && !loading && !error && (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>Select a stock to view chart</h3>
            <p>Search for any NSE/BSE stock above and click Refresh</p>
            <button className="btn btn-primary mt-3" onClick={() => load(symbol, tf)}>
              Load RELIANCE.NS
            </button>
          </div>
        )}

        {loading && (
          <div className="loading-center">
            <div className="spinner" />
            Fetching chart data…
          </div>
        )}

        {/* Charts */}
        {chartData && !loading && (
          <div className="chart-container">
            {/* Symbol bar */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{symbol.symbol}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{symbol.name}</span>
              <span className="tag tag-blue" style={{ marginLeft: 'auto', fontSize: 11 }}>{tf.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Signals: {chartData.crossover_markers?.length ?? 0} crossovers
              </span>
            </div>

            {/* Candlestick chart */}
            <CandleChart
              ohlcv={chartData.ohlcv || []}
              markers={candleMarkers}
              height={420}
            />

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* RSI sub-chart */}
            <RsiChart
              rsi={chartData.indicators?.rsi || []}
              rsiMa={chartData.indicators?.rsi_ma || []}
              crossoverMarkers={chartData.crossover_markers || []}
              height={180}
            />
          </div>
        )}

        {/* Legend */}
        {chartData && (
          <div className="card mt-4" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
              <span><span style={{ color: '#10d97a' }}>▲</span> Long Setup — RSI-MA &gt; 50, RSI crosses above RSI-MA. Buy-stop at candle HIGH (next candle only)</span>
              <span>|</span>
              <span><span style={{ color: '#ff4e6a' }}>▼</span> Short Setup — RSI-MA &lt; 50, RSI crosses below RSI-MA. Sell-stop at candle LOW (next candle only)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
