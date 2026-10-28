const fmt = (v, prefix = '', suffix = '') =>
  v === undefined || v === null ? '—' : `${prefix}${v}${suffix}`

const fmtINR = (v) =>
  v === undefined || v === null ? '—' :
  `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function MetricsGrid({ summary = {}, metrics = {} }) {
  const returnPct = summary.total_return_pct
  const isPos = returnPct >= 0

  const cards = [
    { label: 'Total Return', value: fmt(returnPct, '', '%'), cls: returnPct >= 0 ? 'positive' : 'negative' },
    { label: 'Final Capital', value: fmtINR(summary.final_capital), cls: 'neutral' },
    { label: 'Total P&L', value: fmtINR(metrics.total_pnl_inr), cls: metrics.total_pnl_inr >= 0 ? 'positive' : 'negative' },
    { label: 'CAGR', value: fmt(metrics.cagr_pct, '', '%'), cls: metrics.cagr_pct >= 0 ? 'positive' : 'negative' },
    { label: 'Win Rate', value: fmt(summary.win_rate_pct, '', '%'), cls: summary.win_rate_pct >= 50 ? 'positive' : 'negative' },
    { label: 'Total Trades', value: summary.total_trades, cls: '' },
    { label: 'Profit Factor', value: metrics.profit_factor, cls: metrics.profit_factor >= 1.5 ? 'positive' : metrics.profit_factor >= 1 ? 'neutral' : 'negative' },
    { label: 'Max Drawdown', value: fmt(metrics.max_drawdown_pct, '-', '%'), cls: 'negative' },
    { label: 'Sharpe Ratio', value: metrics.sharpe_ratio, cls: metrics.sharpe_ratio >= 1 ? 'positive' : 'neutral' },
    { label: 'Avg Win', value: fmtINR(metrics.avg_win_inr), cls: 'positive' },
    { label: 'Avg Loss', value: fmtINR(metrics.avg_loss_inr), cls: 'negative' },
    { label: 'Long / Short', value: `${summary.long_trades ?? 0} / ${summary.short_trades ?? 0}`, cls: 'neutral' },
  ]

  return (
    <div className="metrics-grid">
      {cards.map(c => (
        <div className="metric-card" key={c.label}>
          <div className="metric-label">{c.label}</div>
          <div className={`metric-value ${c.cls}`}>{c.value ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}
