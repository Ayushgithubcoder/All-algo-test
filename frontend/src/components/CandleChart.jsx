import { useEffect, useRef } from 'react'
import { createChart, CrosshairMode, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts'

const CHART_OPTS = {
  layout: {
    background: { color: '#0f1629' },
    textColor: '#8892b0',
    fontSize: 12,
  },
  grid: {
    vertLines: { color: 'rgba(99,130,255,0.07)' },
    horzLines: { color: 'rgba(99,130,255,0.07)' },
  },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: 'rgba(99,130,255,0.15)' },
  timeScale: {
    borderColor: 'rgba(99,130,255,0.15)',
    timeVisible: true,
    secondsVisible: false,
  },
}

export default function CandleChart({ ohlcv = [], overlays = [], markers = [], height = 400 }) {
  const containerRef = useRef()
  const chartRef = useRef()
  const seriesRef = useRef()
  const markersPluginRef = useRef()   // v5: createSeriesMarkers plugin instance
  const overlayRefs = useRef({})

  // Create chart + series once
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      ...CHART_OPTS,
      height,
      width: containerRef.current.clientWidth,
    })
    chartRef.current = chart

    // v5: addSeries(CandlestickSeries, opts)
    const cs = chart.addSeries(CandlestickSeries, {
      upColor: '#10d97a',
      downColor: '#ff4e6a',
      borderUpColor: '#10d97a',
      borderDownColor: '#ff4e6a',
      wickUpColor: '#10d97a',
      wickDownColor: '#ff4e6a',
    })
    seriesRef.current = cs

    // v5: markers via plugin — create empty plugin now, update later
    markersPluginRef.current = createSeriesMarkers(cs, [])

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

  // Update OHLCV data
  useEffect(() => {
    if (!seriesRef.current || !ohlcv.length) return
    seriesRef.current.setData(ohlcv)
    chartRef.current.timeScale().fitContent()
  }, [ohlcv])

  // Update overlay lines (EMA, SMA, etc.)
  useEffect(() => {
    if (!chartRef.current) return
    Object.values(overlayRefs.current).forEach(s => {
      try { chartRef.current.removeSeries(s) } catch (_) {}
    })
    overlayRefs.current = {}
    overlays.forEach(ov => {
      if (!ov.data?.length) return
      const s = chartRef.current.addSeries(LineSeries, {
        color: ov.color || '#6382ff',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: ov.label || '',
      })
      s.setData(ov.data)
      overlayRefs.current[ov.key] = s
    })
  }, [overlays])

  // Update trade markers via v5 plugin API
  useEffect(() => {
    if (!markersPluginRef.current) return
    markersPluginRef.current.setMarkers(markers)
  }, [markers])

  return <div ref={containerRef} style={{ width: '100%', height }} />
}
