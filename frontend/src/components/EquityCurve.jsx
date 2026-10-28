import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const fmtINR = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
const fmtDate = (ts) => {
  const d = new Date(ts * 1000)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const isPos = d.equity >= d.initial
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-secondary)' }}>{new Date(d.time * 1000).toLocaleDateString('en-IN')}</div>
      <div style={{ color: isPos ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700, fontSize: 15, marginTop: 4 }}>
        {fmtINR(d.equity)}
      </div>
    </div>
  )
}

export default function EquityCurve({ data = [], initialCapital = 100000 }) {
  if (!data.length) return null

  const chartData = data.map(d => ({ ...d, initial: initialCapital }))
  const minVal = Math.min(...data.map(d => d.equity)) * 0.998
  const maxVal = Math.max(...data.map(d => d.equity)) * 1.002
  const lastVal = data[data.length - 1]?.equity || initialCapital
  const isPos = lastVal >= initialCapital

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isPos ? '#10d97a' : '#ff4e6a'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isPos ? '#10d97a' : '#ff4e6a'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,255,0.07)" />
          <XAxis
            dataKey="time"
            tickFormatter={fmtDate}
            tick={{ fill: '#8892b0', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(99,130,255,0.15)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minVal, maxVal]}
            tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#8892b0', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(99,130,255,0.15)' }}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={isPos ? '#10d97a' : '#ff4e6a'}
            strokeWidth={2}
            fill="url(#equityGrad)"
            dot={false}
            activeDot={{ r: 4, fill: isPos ? '#10d97a' : '#ff4e6a' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
