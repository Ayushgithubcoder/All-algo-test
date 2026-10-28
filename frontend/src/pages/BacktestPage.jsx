import { useState } from 'react'
import StockSearch from '../components/StockSearch'
import MetricsGrid from '../components/MetricsGrid'
import TradeLog from '../components/TradeLog'
import EquityCurve from '../components/EquityCurve'
import CandleChart from '../components/CandleChart'
import RsiChart from '../components/RsiChart'
import { api } from '../api'

const TABS = ['Overview', 'Trade Log', 'Chart']

export default function BacktestPage() {
  const [symbol, setSymbol] = useState({ symbol: 'RELIANCE.NS', name: 'Reliance Industries' })
  const [interval, setInterval] = useState('5m')
  const [start, setStart] = useState('2024-01-01')
  const [end, setEnd] = useState(new Date().toISOString().split('T')[0])
  const [capital, setCapital] = useState(100000)
  const [slPct, setSlPct] = useState(0.1)       // shown as 0.1%
  const [rr, setRr] = useState(3)
  const [riskPct, setRiskPct] = useState(0.5)   // shown as 0.5%
  const [skipCandles, setSkipCandles] = useState(15)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [ohlcv, setOhlcv] = useState([])
  const [rsiData, setRsiData] = useState({ rsi: [], rsiMa: [] })
  const [tab, setTab] = useState('Overview')

  const runBacktest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.runBacktest({
        symbol: symbol.symbol,
        interval,
        start,
        end,
        initial_capital: Number(capital),
        sl_pct: slPct / 100,
        rr: Number(rr),
        risk_pct: riskPct / 100,
        skip_candles: Number(skipCandles),
      })
      setResult(res)

      // Also fetch chart + indicator data
      const chartRes = await api.getChartData(symbol.symbol, interval, start, end, null)
      setOhlcv(chartRes.ohlcv || [])
      setRsiData({
        rsi: chartRes.indicators?.rsi || [],
        rsiMa: chartRes.indicators?.rsi_ma || [],
        crossoverMarkers: chartRes.crossover_markers || [],
      })
    } catch (e) {
      setError(e.message || 'Backtest failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  // Build candle markers from signal_markers
  const candleMarkers = (result?.signal_markers || [])
    .filter(m => ['entry_long', 'entry_short'].includes(m.type))
    .map(m => ({
      time: m.time,
      position: m.type === 'entry_long' ? 'belowBar' : 'aboveBar',
      color: m.type === 'entry_long' ? '#10d97a' : '#ff4e6a',
      shape: m.type === 'entry_long' ? 'arrowUp' : 'arrowDown',
      text: m.type === 'entry_long' ? 'BUY' : 'SELL',
      size: 1,
    }))

  const tradeMarkersRsi = (result?.signal_markers || []).filter(m =>
    ['entry_long', 'entry_short', 'cancelled'].includes(m.type)
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">🔁 Backtest</div>
        <div className="page-subtitle">Run the RSI × RSI-MA strategy on historical data</div>
      </div>

      <div className="page-body">
        <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>
          {/* ── Config Panel ── */}
          <div className="card">
            <div className="card-title">Strategy Config</div>

            <div className="form-group">
              <label className="form-label">Symbol</label>
              <StockSearch value={symbol.name} onChange={s => setSymbol(s)} />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Timeframe</label>
                <select className="form-select" value={interval} onChange={e => setInterval(e.target.value)}>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="1d">1 Day</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Capital (₹)</label>
                <input className="form-input" type="number" value={capital} onChange={e => setCapital(e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={start} onChange={e => setStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
              </div>
            </div>

            <div className="card-title mt-3" style={{ marginBottom: 10 }}>Risk Parameters</div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Stop Loss %</label>
                <input className="form-input" type="number" step="0.01" value={slPct} onChange={e => setSlPct(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">R:R Ratio (TP)</label>
                <input className="form-input" type="number" step="0.5" value={rr} onChange={e => setRr(e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Risk per Trade %</label>
                <input className="form-input" type="number" step="0.1" value={riskPct} onChange={e => setRiskPct(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Skip First N Candles</label>
                <input className="form-input" type="number" value={skipCandles} onChange={e => setSkipCandles(e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={runBacktest} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Running…</> : '▶ Run Backtest'}
            </button>

            {error && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,78,106,0.1)', border: '1px solid rgba(255,78,106,0.25)', borderRadius: 8, color: 'var(--accent-red)', fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* ── Quick Stats while no result ── */}
          {!result && !loading && (
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-state-icon">⚙️</div>
              <h3>Configure & Run</h3>
              <p>Set your parameters on the left, then click Run Backtest</p>
            </div>
          )}

          {loading && (
            <div className="loading-center">
              <div className="spinner" />
              Running backtest…
            </div>
          )}

          {/* ── Summary card ── */}
          {result && !loading && result.summary.total_trades > 0 && (
            <div>
              <div className="card mb-4">
                <div className="card-title">Quick Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    ['Total Trades', result.summary.total_trades],
                    ['Win Rate', `${result.summary.win_rate_pct}%`],
                    ['Total Return', `${result.summary.total_return_pct}%`],
                    ['Max Drawdown', `${result.metrics.max_drawdown_pct}%`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-title">Equity Curve</div>
                <EquityCurve data={result.equity_curve} initialCapital={Number(capital)} />
              </div>
            </div>
          )}

          {result && result.summary.total_trades === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No Trades Generated</h3>
              <p>{result.summary.message}</p>
            </div>
          )}
        </div>

        {/* ── Full Results (below the grid) ── */}
        {result && result.summary.total_trades > 0 && !loading && (
          <div className="mt-4">
            <div className="tabs">
              {TABS.map(t => (
                <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>
              ))}
            </div>

            {tab === 'Overview' && (
              <div>
                <MetricsGrid summary={result.summary} metrics={result.metrics} />
              </div>
            )}

            {tab === 'Trade Log' && (
              <div className="card">
                <div className="card-title mb-4">All Trades ({result.trades.length})</div>
                <TradeLog trades={result.trades} />
              </div>
            )}

            {tab === 'Chart' && ohlcv.length > 0 && (
              <div className="chart-container">
                <CandleChart ohlcv={ohlcv} markers={candleMarkers} height={400} />
                <div style={{ height: 1, background: 'var(--border)' }} />
                <RsiChart
                  rsi={rsiData.rsi}
                  rsiMa={rsiData.rsiMa}
                  crossoverMarkers={rsiData.crossoverMarkers || []}
                  tradeMarkers={tradeMarkersRsi}
                  height={180}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
