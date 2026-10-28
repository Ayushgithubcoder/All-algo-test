"""
Indicator calculation engine using 'ta' library (works on all Python versions).
Computes: RSI, RSI-MA (SMA/EMA), EMA, SMA, MACD, Bollinger Bands, VWAP, ATR.
"""
import logging
import pandas as pd
import numpy as np

try:
    import ta
    TA_LIB = True
except ImportError:
    TA_LIB = False
    logging.warning("'ta' library not found, using manual calculations")

logger = logging.getLogger(__name__)


# ── Core manual implementations (fallback + RSI-MA) ──────────────────────────

def compute_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    close = df["close"]
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def compute_rsi_ma(rsi_series: pd.Series, period: int = 14, ma_type: str = "sma") -> pd.Series:
    """Moving Average of RSI — SMA or EMA."""
    if ma_type == "ema":
        return rsi_series.ewm(span=period, adjust=False).mean()
    return rsi_series.rolling(window=period).mean()


def compute_ema(df: pd.DataFrame, period: int) -> pd.Series:
    return df["close"].ewm(span=period, adjust=False).mean()


def compute_sma(df: pd.DataFrame, period: int) -> pd.Series:
    return df["close"].rolling(window=period).mean()


def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low - close.shift()).abs()
    ], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()


def compute_vwap(df: pd.DataFrame) -> pd.Series:
    tp = (df["high"] + df["low"] + df["close"]) / 3
    return (tp * df["volume"]).cumsum() / df["volume"].cumsum()


def compute_macd(df: pd.DataFrame, fast=12, slow=26, signal=9) -> dict:
    ema_fast = df["close"].ewm(span=fast, adjust=False).mean()
    ema_slow = df["close"].ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


def compute_bollinger(df: pd.DataFrame, period: int = 20, std: float = 2.0) -> dict:
    mid = df["close"].rolling(window=period).mean()
    stddev = df["close"].rolling(window=period).std()
    return {"upper": mid + std * stddev, "mid": mid, "lower": mid - std * stddev}


# ── Serializer ────────────────────────────────────────────────────────────────
def series_to_list(s: pd.Series, timestamps: list) -> list:
    out = []
    s_vals = s.values
    for i, val in enumerate(s_vals):
        if i < len(timestamps) and pd.notna(val):
            out.append({"time": timestamps[i], "value": round(float(val), 4)})
    return out


# ── Main dispatcher ───────────────────────────────────────────────────────────
def compute_all_indicators(df: pd.DataFrame, config: dict) -> dict:
    """Compute all requested indicators and return as {key: [{time, value}]}."""
    result = {}
    timestamps = [int(pd.Timestamp(idx).timestamp()) for idx in df.index]

    # RSI
    rsi_cfg = config.get("rsi", {})
    rsi_series = None
    if rsi_cfg.get("enabled", False):
        rsi_series = compute_rsi(df, rsi_cfg.get("period", 14))
        result["rsi"] = series_to_list(rsi_series, timestamps)

    # RSI-MA
    rsi_ma_cfg = config.get("rsi_ma", {})
    if rsi_ma_cfg.get("enabled", False):
        if rsi_series is None:
            rsi_series = compute_rsi(df, 14)
        rsi_ma = compute_rsi_ma(rsi_series, rsi_ma_cfg.get("period", 14), rsi_ma_cfg.get("type", "sma"))
        result["rsi_ma"] = series_to_list(rsi_ma, timestamps)

    # EMAs
    for ema_cfg in config.get("ema", []):
        if ema_cfg.get("enabled", False):
            p = ema_cfg.get("period", 20)
            result[f"ema_{p}"] = series_to_list(compute_ema(df, p), timestamps)

    # SMAs
    for sma_cfg in config.get("sma", []):
        if sma_cfg.get("enabled", False):
            p = sma_cfg.get("period", 50)
            result[f"sma_{p}"] = series_to_list(compute_sma(df, p), timestamps)

    # MACD
    if config.get("macd", {}).get("enabled", False):
        m = compute_macd(df)
        result["macd_line"] = series_to_list(m["macd"], timestamps)
        result["macd_signal"] = series_to_list(m["signal"], timestamps)
        result["macd_hist"] = series_to_list(m["histogram"], timestamps)

    # Bollinger
    if config.get("bollinger", {}).get("enabled", False):
        bb_cfg = config["bollinger"]
        bb = compute_bollinger(df, bb_cfg.get("period", 20), bb_cfg.get("std", 2.0))
        result["bb_upper"] = series_to_list(bb["upper"], timestamps)
        result["bb_mid"] = series_to_list(bb["mid"], timestamps)
        result["bb_lower"] = series_to_list(bb["lower"], timestamps)

    # VWAP
    if config.get("vwap", {}).get("enabled", False):
        result["vwap"] = series_to_list(compute_vwap(df), timestamps)

    # ATR
    if config.get("atr", {}).get("enabled", False):
        result["atr"] = series_to_list(compute_atr(df, config["atr"].get("period", 14)), timestamps)

    return result
