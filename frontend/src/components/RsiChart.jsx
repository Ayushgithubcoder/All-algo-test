import { useEffect, useRef } from 'react'
import { createChart, CrosshairMode, LineSeries, createSeriesMarkers } from 'lightweight-charts'

export default function RsiChart({ rsi = [], rsiMa = [], crossoverMarkers = [], tradeMarkers = [], height = 180 }) {
  const containerRef = useRef()
  const chartRef = useRef()
  const rsiSeriesRef = useRef()
  const maSeriesRef = useRef()
  const markersPluginRef = useRef()  // v5: createSeriesMarkers plugin

  useEffect(() => {
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0f1629' },
        textColor: '#8892b0',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(99,130,255,0.07)' },
        horzLines: { color: 'rgba(99,130,255,0.07)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(99,130,255,0.15)',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: 'rgba(99,130,255,0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
      height,
      width: containerRef.current.clientWidth,
    })
    chartRef.current = chart

    // RSI line
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#6382ff',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'RSI 14',
    })
    rsiSeriesRef.current = rsiSeries

    // RSI-MA line
    const maSeries = chart.addSeries(LineSeries, {
      color: '#f7c948',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'SMA 14',
    })
    maSeriesRef.current = maSeries

    // Horizontal levels on RSI series
    ;[
      { price: 70, color: 'rgba(255,78,106,0.5)', label: '70' },
      { price: 50, color: 'rgba(99,130,255,0.6)', label: '50' },
      { price: 30, color: 'rgba(16,217,122,0.5)', label: '30' },
    ].forEach(({ price, color, label }) => {
      rsiSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: label })
    })

    // v5 markers plugin on RSI series
    markersPluginRef.current = createSeriesMarkers(rsiSeries, [])

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      markersPluginRef.current?.detach()
      chart.remove()
    }
  }, [height])

  // Update RSI data
  useEffect(() => {
    if (!rsiSeriesRef.current || !rsi.length) return
    rsiSeriesRef.current.setData(rsi)
  }, [rsi])

  // Update RSI-MA data
  useEffect(() => {
    if (!maSeriesRef.current || !rsiMa.length) return
    maSeriesRef.current.setData(rsiMa)
  }, [rsiMa])

  // Update markers via v5 plugin API
  useEffect(() => {
    if (!markersPluginRef.current) return

    const mkrs = []

    crossoverMarkers.forEach(m => {
      mkrs.push({
        time: m.time,
        position: m.type === 'crossover_long' ? 'belowBar' : 'aboveBar',
        color: m.type === 'crossover_long' ? '#10d97a' : '#ff4e6a',
        shape: m.type === 'crossover_long' ? 'arrowUp' : 'arrowDown',
        text: m.type === 'crossover_long' ? '▲ Setup' : '▼ Setup',
        size: 1,
      })
    })

    tradeMarkers.forEach(m => {
      if (m.type === 'entry_long') {
        mkrs.push({ time: m.time, position: 'belowBar', color: '#10d97a', shape: 'circle', text: 'BUY', size: 1 })
      } else if (m.type === 'entry_short') {
        mkrs.push({ time: m.time, position: 'aboveBar', color: '#ff4e6a', shape: 'circle', text: 'SELL', size: 1 })
      } else if (m.type === 'cancelled') {
        mkrs.push({ time: m.time, position: 'inBar', color: '#4a5568', shape: 'square', text: '✕', size: 0.5 })
      }
    })

    // Must be sorted by time ascending
    mkrs.sort((a, b) => a.time - b.time)
    markersPluginRef.current.setMarkers(mkrs)

    if (mkrs.length) chartRef.current?.timeScale().fitContent()
  }, [crossoverMarkers, tradeMarkers])

  return (
    <div>
      <div style={{
        display: 'flex', gap: 16, padding: '6px 12px',
        background: '#0f1629', borderBottom: '1px solid rgba(99,130,255,0.07)', fontSize: 11,
      }}>
        <span style={{ color: '#6382ff' }}>● RSI(14)</span>
        <span style={{ color: '#f7c948' }}>● RSI-MA SMA(14)</span>
        <span style={{ color: '#10d97a' }}>▲ Long Setup</span>
        <span style={{ color: '#ff4e6a' }}>▼ Short Setup</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height }} />
    </div>
  )
}
