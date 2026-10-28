const fmtDate = (ts) => {
  const d = new Date(ts * 1000)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}
const fmtINR = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`

export default function TradeLog({ trades = [] }) {
  if (!trades.length) return (
    <div className="empty-state" style={{ padding: 40 }}>
      <div className="empty-state-icon">📋</div>
      <p>No trades to display</p>
    </div>
  )

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Dir</th>
            <th>Entry Time</th>
            <th>Exit Time</th>
            <th>Entry ₹</th>
            <th>Exit ₹</th>
            <th>Shares</th>
            <th>P&L</th>
            <th>P&L %</th>
            <th>Exit</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const pos = t.pnl >= 0
            return (
              <tr key={i}>
                <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                <td>
                  <span className={`tag ${t.direction === 'LONG' ? 'tag-green' : 'tag-red'}`}>
                    {t.direction === 'LONG' ? '▲' : '▼'} {t.direction}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmtDate(t.entry_time)}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmtDate(t.exit_time)}</td>
                <td style={{ fontWeight: 600 }}>{fmtINR(t.entry_price)}</td>
                <td style={{ fontWeight: 600 }}>{fmtINR(t.exit_price)}</td>
                <td>{t.shares}</td>
                <td className={pos ? 'text-green' : 'text-red'} style={{ fontWeight: 700 }}>
                  {pos ? '+' : ''}{fmtINR(t.pnl)}
                </td>
                <td className={pos ? 'text-green' : 'text-red'} style={{ fontWeight: 700 }}>
                  {pos ? '+' : ''}{t.pnl_pct}%
                </td>
                <td>
                  <span className={`tag ${t.exit_reason === 'take_profit' ? 'tag-green' : t.exit_reason === 'stop_loss' ? 'tag-red' : 'tag-yellow'}`} style={{ fontSize: 10 }}>
                    {t.exit_reason === 'take_profit' ? 'TP' : t.exit_reason === 'stop_loss' ? 'SL' : t.exit_reason === 'eod_squareoff' ? 'EOD' : t.exit_reason}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
