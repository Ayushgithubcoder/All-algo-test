"""
FastAPI routes — updated with client strategy preset and signal_markers support.
"""
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import pandas as pd

from market_data import fetch_ohlcv, search_symbols, get_all_symbols, df_to_json
from indicators import compute_all_indicators
from backtest_engine import ClientStrategyBacktest

logger = logging.getLogger(__name__)

data_router = APIRouter()
indicators_router = APIRouter()
backtest_router = APIRouter()
live_router = APIRouter()


# ── Request Models ────────────────────────────────────────────────────────────
class IndicatorRequest(BaseModel):
    symbol: str
    interval: str = "5m"
    start: Optional[str] = None
    end: Optional[str] = None
    period: Optional[str] = None
    indicators: dict = {}


class BacktestRequest(BaseModel):
    symbol: str
    interval: str = "5m"
    start: Optional[str] = None
    end: Optional[str] = None
    period: Optional[str] = None
    initial_capital: float = 100_000.0
    sl_pct: float = 0.001       # 0.1%
    rr: float = 3.0             # 1:3
    risk_pct: float = 0.005     # 0.5% of capital at risk
    skip_candles: int = 15      # skip first 15 candles of each day
    rsi_period: int = 14
    rsi_ma_period: int = 14


# ── Data Routes ───────────────────────────────────────────────────────────────
@data_router.get("/symbols")
async def get_symbols(q: Optional[str] = Query(None)):
    if q:
        return search_symbols(q)
    return get_all_symbols()


@data_router.get("/ohlcv")
async def get_ohlcv(
    symbol: str = Query(...),
    interval: str = Query("5m"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
):
    df = fetch_ohlcv(symbol, interval, start, end, period)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return {"symbol": symbol, "interval": interval, "count": len(df), "data": df_to_json(df)}


@data_router.get("/info")
async def get_stock_info(symbol: str = Query(...)):
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return {
            "symbol": symbol,
            "name": info.get("longName", symbol),
            "sector": info.get("sector", "N/A"),
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "52w_high": info.get("fiftyTwoWeekHigh"),
            "52w_low": info.get("fiftyTwoWeekLow"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "currency": "INR",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Indicator Routes ──────────────────────────────────────────────────────────
@indicators_router.post("/compute")
async def compute_indicators(req: IndicatorRequest):
    df = fetch_ohlcv(req.symbol, req.interval, req.start, req.end, req.period)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {req.symbol}")
    result = compute_all_indicators(df, req.indicators)
    return {
        "symbol": req.symbol,
        "interval": req.interval,
        "candle_count": len(df),
        "indicators": result,
    }


@indicators_router.get("/chart-data")
async def get_chart_data(
    symbol: str = Query(...),
    interval: str = Query("5m"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
):
    """
    Single endpoint to get OHLCV + RSI(14) + RSI-MA SMA(14) for chart display.
    Also returns crossover signal markers.
    """
    df = fetch_ohlcv(symbol, interval, start, end, period)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")

    indicator_cfg = {
        "rsi": {"enabled": True, "period": 14},
        "rsi_ma": {"enabled": True, "period": 14, "type": "sma"},
        "ema": [],
        "sma": [],
    }
    indicators = compute_all_indicators(df, indicator_cfg)
    ohlcv = df_to_json(df)

    # Compute crossover markers for chart
    rsi_vals = {d["time"]: d["value"] for d in indicators.get("rsi", [])}
    rsi_ma_vals = {d["time"]: d["value"] for d in indicators.get("rsi_ma", [])}

    markers = []
    times = sorted(rsi_vals.keys())
    for idx, t in enumerate(times):
        if idx == 0:
            continue
        prev_t = times[idx - 1]
        rsi_c = rsi_vals.get(t)
        rsi_p = rsi_vals.get(prev_t)
        ma_c = rsi_ma_vals.get(t)
        ma_p = rsi_ma_vals.get(prev_t)
        if None in (rsi_c, rsi_p, ma_c, ma_p):
            continue
        if rsi_p <= ma_p and rsi_c > ma_c and ma_c > 50:
            markers.append({"time": t, "type": "crossover_long"})
        elif rsi_p >= ma_p and rsi_c < ma_c and ma_c < 50:
            markers.append({"time": t, "type": "crossover_short"})

    return {
        "symbol": symbol,
        "interval": interval,
        "ohlcv": ohlcv,
        "indicators": indicators,
        "crossover_markers": markers,
    }


# ── Backtest Routes ───────────────────────────────────────────────────────────
@backtest_router.post("/run")
async def run_backtest(req: BacktestRequest):
    df = fetch_ohlcv(req.symbol, req.interval, req.start, req.end, req.period)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {req.symbol}")
    if len(df) < 30:
        raise HTTPException(status_code=400, detail="Need at least 30 candles")

    engine = ClientStrategyBacktest(
        df=df,
        initial_capital=req.initial_capital,
        sl_pct=req.sl_pct,
        rr=req.rr,
        risk_pct=req.risk_pct,
        skip_candles=req.skip_candles,
    )
    results = engine.run()
    results["symbol"] = req.symbol
    results["interval"] = req.interval
    results["candles_used"] = len(df)
    return results


@backtest_router.get("/default-config")
async def get_default_config():
    """Return the default strategy configuration matching client spec."""
    return {
        "name": "RSI × RSI-MA(SMA14) Crossover — Client Strategy",
        "description": "Buy-stop at crossover candle HIGH when RSI-MA>50. Sell-stop at LOW when RSI-MA<50. Valid next candle only.",
        "defaults": {
            "interval": "5m",
            "initial_capital": 100000,
            "sl_pct": 0.001,
            "rr": 3.0,
            "risk_pct": 0.005,
            "skip_candles": 15,
            "rsi_period": 14,
            "rsi_ma_period": 14,
        },
    }


# ── Live Routes ───────────────────────────────────────────────────────────────
@live_router.get("/snapshot")
async def get_live_snapshot(symbol: str = Query(...)):
    df = fetch_ohlcv(symbol, interval="5m", period="1d")
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No live data for {symbol}")

    # compute RSI + RSI-MA on today's data
    from indicators import compute_rsi, compute_rsi_ma
    rsi_s = compute_rsi(df, 14)
    rsi_ma_s = compute_rsi_ma(rsi_s, 14, "sma")

    last = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else last
    change = float(last["close"]) - float(prev["close"])
    change_pct = (change / float(prev["close"])) * 100

    rsi_curr = float(rsi_s.iloc[-1]) if not pd.isna(rsi_s.iloc[-1]) else None
    rsi_prev = float(rsi_s.iloc[-2]) if len(rsi_s) > 1 and not pd.isna(rsi_s.iloc[-2]) else None
    ma_curr = float(rsi_ma_s.iloc[-1]) if not pd.isna(rsi_ma_s.iloc[-1]) else None
    ma_prev = float(rsi_ma_s.iloc[-2]) if len(rsi_ma_s) > 1 and not pd.isna(rsi_ma_s.iloc[-2]) else None

    # detect pending signal on latest candle
    pending_signal = None
    if all(v is not None for v in [rsi_curr, rsi_prev, ma_curr, ma_prev]):
        if rsi_prev <= ma_prev and rsi_curr > ma_curr and ma_curr > 50:
            pending_signal = {"direction": "LONG", "trigger": round(float(last["high"]), 2)}
        elif rsi_prev >= ma_prev and rsi_curr < ma_curr and ma_curr < 50:
            pending_signal = {"direction": "SHORT", "trigger": round(float(last["low"]), 2)}

    return {
        "symbol": symbol,
        "price": round(float(last["close"]), 2),
        "open": round(float(last["open"]), 2),
        "high": round(float(last["high"]), 2),
        "low": round(float(last["low"]), 2),
        "volume": int(last["volume"]),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "rsi": round(rsi_curr, 2) if rsi_curr else None,
        "rsi_ma": round(ma_curr, 2) if ma_curr else None,
        "pending_signal": pending_signal,
        "timestamp": int(pd.Timestamp(df.index[-1]).timestamp()),
    }


@live_router.websocket("/ws/{symbol}")
async def live_ws(websocket: WebSocket, symbol: str):
    await websocket.accept()
    logger.info(f"WS connected: {symbol}")
    try:
        while True:
            df = fetch_ohlcv(symbol, interval="5m", period="1d")
            if not df.empty:
                last = df.iloc[-1]
                prev = df.iloc[-2] if len(df) > 1 else last
                change = float(last["close"]) - float(prev["close"])
                change_pct = (change / float(prev["close"])) * 100
                await websocket.send_json({
                    "symbol": symbol,
                    "price": round(float(last["close"]), 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "high": round(float(last["high"]), 2),
                    "low": round(float(last["low"]), 2),
                    "volume": int(last["volume"]),
                    "timestamp": int(pd.Timestamp(df.index[-1]).timestamp()),
                })
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        logger.info(f"WS disconnected: {symbol}")
    except Exception as e:
        logger.error(f"WS error {symbol}: {e}")
