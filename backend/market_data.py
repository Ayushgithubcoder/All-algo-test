"""
Market data fetching service using yfinance.
Provides OHLCV data for NSE/BSE stocks and indices.
"""
import logging
from typing import Optional
import yfinance as yf
import pandas as pd

logger = logging.getLogger(__name__)

# Popular NSE stocks for quick search
NSE_POPULAR = [
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Energy"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "sector": "IT"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Banking"},
    {"symbol": "INFY.NS", "name": "Infosys", "sector": "IT"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "sector": "Banking"},
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever", "sector": "FMCG"},
    {"symbol": "ITC.NS", "name": "ITC Limited", "sector": "FMCG"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "sector": "Banking"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "sector": "Telecom"},
    {"symbol": "BAJFINANCE.NS", "name": "Bajaj Finance", "sector": "Finance"},
    {"symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank", "sector": "Banking"},
    {"symbol": "LT.NS", "name": "Larsen & Toubro", "sector": "Infrastructure"},
    {"symbol": "WIPRO.NS", "name": "Wipro", "sector": "IT"},
    {"symbol": "HCLTECH.NS", "name": "HCL Technologies", "sector": "IT"},
    {"symbol": "ASIANPAINT.NS", "name": "Asian Paints", "sector": "Consumer"},
    {"symbol": "MARUTI.NS", "name": "Maruti Suzuki", "sector": "Auto"},
    {"symbol": "TITAN.NS", "name": "Titan Company", "sector": "Consumer"},
    {"symbol": "SUNPHARMA.NS", "name": "Sun Pharmaceutical", "sector": "Pharma"},
    {"symbol": "NESTLEIND.NS", "name": "Nestle India", "sector": "FMCG"},
    {"symbol": "TECHM.NS", "name": "Tech Mahindra", "sector": "IT"},
    {"symbol": "ADANIENT.NS", "name": "Adani Enterprises", "sector": "Diversified"},
    {"symbol": "ADANIPORTS.NS", "name": "Adani Ports", "sector": "Infrastructure"},
    {"symbol": "TATAMOTORS.NS", "name": "Tata Motors", "sector": "Auto"},
    {"symbol": "TATASTEEL.NS", "name": "Tata Steel", "sector": "Metals"},
    {"symbol": "AXISBANK.NS", "name": "Axis Bank", "sector": "Banking"},
    {"symbol": "INDUSINDBK.NS", "name": "IndusInd Bank", "sector": "Banking"},
    {"symbol": "POWERGRID.NS", "name": "Power Grid Corp", "sector": "Utilities"},
    {"symbol": "NTPC.NS", "name": "NTPC", "sector": "Utilities"},
    {"symbol": "ONGC.NS", "name": "ONGC", "sector": "Energy"},
    {"symbol": "COALINDIA.NS", "name": "Coal India", "sector": "Energy"},
    {"symbol": "JSWSTEEL.NS", "name": "JSW Steel", "sector": "Metals"},
    {"symbol": "BPCL.NS", "name": "BPCL", "sector": "Energy"},
    {"symbol": "DRREDDY.NS", "name": "Dr. Reddy's", "sector": "Pharma"},
    {"symbol": "CIPLA.NS", "name": "Cipla", "sector": "Pharma"},
    {"symbol": "DIVISLAB.NS", "name": "Divi's Laboratories", "sector": "Pharma"},
    {"symbol": "EICHERMOT.NS", "name": "Eicher Motors", "sector": "Auto"},
    {"symbol": "HEROMOTOCO.NS", "name": "Hero MotoCorp", "sector": "Auto"},
    {"symbol": "BAJAJ-AUTO.NS", "name": "Bajaj Auto", "sector": "Auto"},
    {"symbol": "M&M.NS", "name": "Mahindra & Mahindra", "sector": "Auto"},
    {"symbol": "UPL.NS", "name": "UPL Limited", "sector": "Chemicals"},
    # Indices
    {"symbol": "^NSEI", "name": "NIFTY 50 Index", "sector": "Index"},
    {"symbol": "^BSESN", "name": "BSE SENSEX Index", "sector": "Index"},
    {"symbol": "^NSEBANK", "name": "NIFTY Bank Index", "sector": "Index"},
]

# Map timeframe labels to yfinance params
TIMEFRAME_MAP = {
    "1m": {"interval": "1m", "period": "7d"},
    "5m": {"interval": "5m", "period": "60d"},
    "15m": {"interval": "15m", "period": "60d"},
    "30m": {"interval": "30m", "period": "60d"},
    "1h": {"interval": "1h", "period": "730d"},
    "1d": {"interval": "1d", "period": "max"},
    "1wk": {"interval": "1wk", "period": "max"},
    "1mo": {"interval": "1mo", "period": "max"},
}


def search_symbols(query: str) -> list:
    """Search stocks from pre-loaded list."""
    q = query.lower()
    results = [
        s for s in NSE_POPULAR
        if q in s["symbol"].lower() or q in s["name"].lower() or q in s["sector"].lower()
    ]
    return results[:20]


def get_all_symbols() -> list:
    return NSE_POPULAR


def fetch_ohlcv(
    symbol: str,
    interval: str = "1d",
    start: Optional[str] = None,
    end: Optional[str] = None,
    period: Optional[str] = None,
) -> pd.DataFrame:
    """
    Fetch OHLCV data from Yahoo Finance.
    Returns DataFrame with columns: datetime, open, high, low, close, volume
    """
    try:
        ticker = yf.Ticker(symbol)
        
        if start and end:
            df = ticker.history(start=start, end=end, interval=interval, auto_adjust=True)
        elif period:
            df = ticker.history(period=period, interval=interval, auto_adjust=True)
        else:
            # Default: use timeframe map
            tf = TIMEFRAME_MAP.get(interval, {"interval": "1d", "period": "1y"})
            df = ticker.history(period=tf["period"], interval=tf["interval"], auto_adjust=True)
        
        if df.empty:
            logger.warning(f"No data returned for {symbol}")
            return pd.DataFrame()
        
        # Normalize columns
        df = df.rename(columns={
            "Open": "open", "High": "high",
            "Low": "low", "Close": "close", "Volume": "volume"
        })
        df.index.name = "datetime"
        df = df[["open", "high", "low", "close", "volume"]].dropna()
        df.index = df.index.tz_localize(None) if df.index.tz else df.index
        
        logger.info(f"Fetched {len(df)} candles for {symbol} [{interval}]")
        return df

    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {e}")
        return pd.DataFrame()


def df_to_json(df: pd.DataFrame) -> list:
    """Convert OHLCV DataFrame to list of dicts for JSON response."""
    if df.empty:
        return []
    records = []
    for dt, row in df.iterrows():
        records.append({
            "time": int(pd.Timestamp(dt).timestamp()),
            "open": round(float(row["open"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "close": round(float(row["close"]), 2),
            "volume": int(row["volume"]),
        })
    return records
