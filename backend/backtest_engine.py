"""
Backtest engine — exact client strategy implementation:
- RSI(14) × SMA(14 of RSI) crossover
- Buy-stop at HIGH of crossover candle (valid NEXT candle only)
- Sell-stop at LOW of crossover candle (valid NEXT candle only)
- SL: 0.1% from trigger | TP: 1:3 R:R
- Position size: risk 0.5% of capital per trade
- Skip first 15 candles of each trading day
"""
import logging
import numpy as np
import pandas as pd
from typing import Optional

logger = logging.getLogger(__name__)


def _compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _compute_rsi_ma_sma(rsi: pd.Series, period: int = 14) -> pd.Series:
    """SMA of RSI — as per client spec."""
    return rsi.rolling(window=period).mean()


class ClientStrategyBacktest:
    """
    Exact client strategy:
      LONG  → RSI-MA(SMA14) > 50 AND RSI crosses above RSI-MA
              → buy-stop at HIGH of crossover candle, valid NEXT candle only
      SHORT → RSI-MA(SMA14) < 50 AND RSI crosses below RSI-MA
              → sell-stop at LOW of crossover candle, valid NEXT candle only
    """

    def __init__(self, df: pd.DataFrame, initial_capital: float = 100_000.0,
                 sl_pct: float = 0.001, rr: float = 3.0,
                 risk_pct: float = 0.005, skip_candles: int = 15,
                 leverage: float = 1.0):
        self.df = df.copy().reset_index()
        # Normalize datetime column
        if "datetime" not in self.df.columns and "index" in self.df.columns:
            self.df.rename(columns={"index": "datetime"}, inplace=True)
        self.df["datetime"] = pd.to_datetime(self.df["datetime"])

        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.sl_pct = sl_pct
        self.rr = rr
        self.risk_pct = risk_pct
        self.skip_candles = skip_candles
        self.leverage = max(1.0, leverage)  # minimum 1x

        self.position: Optional[dict] = None
        self.pending: Optional[dict] = None
        self.trades = []
        self.equity_curve = []
        self.signal_markers = []

    # ── helpers ────────────────────────────────────────────────────────────
    def _ts(self, i: int) -> int:
        return int(pd.Timestamp(self.df["datetime"].iloc[i]).timestamp())

    def _shares(self, trigger: float) -> int:
        """Position size based on 0.5% risk of capital, scaled by leverage."""
        risk_amount = self.capital * self.risk_pct
        sl_distance = trigger * self.sl_pct
        if sl_distance <= 0:
            return 0
        by_risk = int((risk_amount * self.leverage) / sl_distance)
        # Cap: total position value ≤ capital × leverage
        by_capital = int((self.capital * self.leverage) / trigger)
        shares = min(by_risk, by_capital)
        return max(1, shares)

    def _enter(self, i: int, direction: str, trigger: float, sl: float, tp: float):
        shares = self._shares(trigger)
        cost = shares * trigger
        if cost > self.capital:
            return
        self.capital -= cost
        self.position = {
            "direction": direction,
            "entry_price": trigger,
            "shares": shares,
            "sl": sl,
            "tp": tp,
            "entry_idx": i,
            "entry_time": self._ts(i),
        }
        self.signal_markers.append({
            "time": self._ts(i),
            "type": f"entry_{direction}",
            "price": round(trigger, 2),
        })
        logger.debug(f"ENTER {direction.upper()} @ {trigger} | SL={sl:.2f} TP={tp:.2f} shares={shares}")

    def _exit(self, i: int, exit_price: float, reason: str):
        pos = self.position
        if pos["direction"] == "long":
            proceeds = pos["shares"] * exit_price
            cost_basis = pos["shares"] * pos["entry_price"]
        else:  # short
            cost_basis = pos["shares"] * pos["entry_price"]
            proceeds = cost_basis + (pos["entry_price"] - exit_price) * pos["shares"]

        pnl = proceeds - cost_basis
        pnl_pct = (pnl / cost_basis) * 100
        self.capital += (pos["shares"] * exit_price) if pos["direction"] == "long" else (
            cost_basis + pnl  # return margin + profit
        )

        self.trades.append({
            "entry_time": pos["entry_time"],
            "exit_time": self._ts(i),
            "direction": pos["direction"].upper(),
            "entry_price": round(pos["entry_price"], 2),
            "exit_price": round(exit_price, 2),
            "shares": pos["shares"],
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "exit_reason": reason,
        })
        self.signal_markers.append({
            "time": self._ts(i),
            "type": f"exit_{reason}",
            "direction": pos["direction"],
            "price": round(exit_price, 2),
        })
        self.position = None
        logger.debug(f"EXIT @ {exit_price} | reason={reason} | PnL={pnl:.2f}")

    # ── main loop ───────────────────────────────────────────────────────────
    def run(self) -> dict:
        df = self.df
        n = len(df)

        rsi = _compute_rsi(df["close"], 14)
        rsi_ma = _compute_rsi_ma_sma(rsi, 14)

        # Intraday bar number (0-indexed) per day
        df["_date"] = df["datetime"].dt.date
        df["_bar_num"] = df.groupby("_date").cumcount()

        for i in range(1, n):
            bar = df.iloc[i]
            ts = self._ts(i)
            high = float(bar["high"])
            low = float(bar["low"])
            close = float(bar["close"])
            bar_num = int(bar["_bar_num"])

            # ── equity tracking ──────────────────────────────────────────
            if self.position:
                if self.position["direction"] == "long":
                    eq = self.capital + self.position["shares"] * close
                else:
                    unrealized = (self.position["entry_price"] - close) * self.position["shares"]
                    eq = self.capital + self.position["shares"] * self.position["entry_price"] + unrealized
            else:
                eq = self.capital
            self.equity_curve.append({"time": ts, "equity": round(eq, 2)})

            # ── end-of-day square-off ────────────────────────────────────
            is_last_of_day = (
                i + 1 >= n or df.iloc[i + 1]["_date"] != bar["_date"]
            )
            if self.position and is_last_of_day:
                self._exit(i, close, "eod_squareoff")
                self.pending = None
                continue

            # ── skip first N candles of each day ─────────────────────────
            if bar_num < self.skip_candles:
                self.pending = None  # cancel any stale pending from yesterday
                continue

            # ── manage open position ─────────────────────────────────────
            if self.position:
                pos = self.position
                if pos["direction"] == "long":
                    if low <= pos["sl"]:
                        self._exit(i, pos["sl"], "stop_loss")
                        continue
                    if high >= pos["tp"]:
                        self._exit(i, pos["tp"], "take_profit")
                        continue
                else:  # short
                    if high >= pos["sl"]:
                        self._exit(i, pos["sl"], "stop_loss")
                        continue
                    if low <= pos["tp"]:
                        self._exit(i, pos["tp"], "take_profit")
                        continue
                continue  # still in position, don't look for new signals

            # ── check pending order (valid for 1 candle only) ─────────────
            if self.pending:
                if i == self.pending["crossover_idx"] + 1:
                    p = self.pending
                    if p["direction"] == "long" and high >= p["trigger"]:
                        self._enter(i, "long", p["trigger"], p["sl"], p["tp"])
                    elif p["direction"] == "short" and low <= p["trigger"]:
                        self._enter(i, "short", p["trigger"], p["sl"], p["tp"])
                    else:
                        self.signal_markers.append({
                            "time": ts,
                            "type": "cancelled",
                            "direction": p["direction"],
                        })
                self.pending = None  # expire after 1 candle no matter what

            # ── look for new crossover signal ─────────────────────────────
            rsi_curr = rsi.iloc[i]
            rsi_prev = rsi.iloc[i - 1]
            rsi_ma_curr = rsi_ma.iloc[i]
            rsi_ma_prev = rsi_ma.iloc[i - 1]

            if any(pd.isna(v) for v in [rsi_curr, rsi_prev, rsi_ma_curr, rsi_ma_prev]):
                continue

            # LONG crossover: RSI crosses above RSI-MA AND RSI-MA > 50
            if rsi_prev <= rsi_ma_prev and rsi_curr > rsi_ma_curr and rsi_ma_curr > 50:
                trigger = high
                sl = round(trigger * (1 - self.sl_pct), 2)
                risk = trigger - sl
                tp = round(trigger + self.rr * risk, 2)
                self.pending = {
                    "direction": "long",
                    "trigger": trigger,
                    "sl": sl,
                    "tp": tp,
                    "crossover_idx": i,
                }
                self.signal_markers.append({
                    "time": ts,
                    "type": "crossover_long",
                    "price": round(trigger, 2),
                    "sl": sl,
                    "tp": tp,
                })

            # SHORT crossover: RSI crosses below RSI-MA AND RSI-MA < 50
            elif rsi_prev >= rsi_ma_prev and rsi_curr < rsi_ma_curr and rsi_ma_curr < 50:
                trigger = low
                sl = round(trigger * (1 + self.sl_pct), 2)
                risk = sl - trigger
                tp = round(trigger - self.rr * risk, 2)
                self.pending = {
                    "direction": "short",
                    "trigger": trigger,
                    "sl": sl,
                    "tp": tp,
                    "crossover_idx": i,
                }
                self.signal_markers.append({
                    "time": ts,
                    "type": "crossover_short",
                    "price": round(trigger, 2),
                    "sl": sl,
                    "tp": tp,
                })

        return self._metrics()

    # ── metrics ─────────────────────────────────────────────────────────────
    def _metrics(self) -> dict:
        trades = self.trades
        if not trades:
            return {
                "summary": {"total_trades": 0, "message": "No trades generated. Try a longer date range or different timeframe."},
                "metrics": {},
                "trades": [],
                "equity_curve": self.equity_curve,
                "signal_markers": self.signal_markers,
            }

        pnls = [t["pnl"] for t in trades]
        pnl_pcts = [t["pnl_pct"] for t in trades]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p <= 0]

        final_capital = self.equity_curve[-1]["equity"] if self.equity_curve else self.capital
        total_return = ((final_capital - self.initial_capital) / self.initial_capital) * 100
        win_rate = (len(wins) / len(trades)) * 100
        profit_factor = abs(sum(wins) / sum(losses)) if sum(losses) != 0 else 999.0

        # Max drawdown
        equity_vals = [e["equity"] for e in self.equity_curve]
        max_dd, peak = 0.0, equity_vals[0]
        for v in equity_vals:
            peak = max(peak, v)
            max_dd = max(max_dd, (peak - v) / peak * 100)

        # Sharpe (annualized, 252 trading days)
        ret_series = pd.Series(pnl_pcts) / 100
        sharpe = 0.0
        if len(ret_series) > 1 and ret_series.std() > 0:
            sharpe = round((ret_series.mean() / ret_series.std()) * np.sqrt(252), 2)

        # CAGR
        days = len(self.df)
        years = days / 252
        cagr = round(((final_capital / self.initial_capital) ** (1 / max(years, 0.01)) - 1) * 100, 2) if years > 0 else 0

        long_trades = [t for t in trades if t["direction"] == "LONG"]
        short_trades = [t for t in trades if t["direction"] == "SHORT"]

        return {
            "summary": {
                "initial_capital": self.initial_capital,
                "final_capital": round(final_capital, 2),
                "total_return_pct": round(total_return, 2),
                "total_trades": len(trades),
                "winning_trades": len(wins),
                "losing_trades": len(losses),
                "win_rate_pct": round(win_rate, 2),
                "long_trades": len(long_trades),
                "short_trades": len(short_trades),
            },
            "metrics": {
                "sharpe_ratio": sharpe,
                "max_drawdown_pct": round(max_dd, 2),
                "profit_factor": round(profit_factor, 2),
                "cagr_pct": cagr,
                "avg_win_inr": round(np.mean(wins), 2) if wins else 0,
                "avg_loss_inr": round(np.mean(losses), 2) if losses else 0,
                "best_trade_pct": round(max(pnl_pcts), 2),
                "worst_trade_pct": round(min(pnl_pcts), 2),
                "total_pnl_inr": round(sum(pnls), 2),
                "avg_trade_pnl_pct": round(np.mean(pnl_pcts), 2),
            },
            "trades": trades,
            "equity_curve": self.equity_curve,
            "signal_markers": self.signal_markers,
        }
