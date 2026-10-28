"""
Main FastAPI application entry point for the Trading Strategy Platform.
Handles backtest, live simulation, indicators, and stock data APIs.
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from routes import data_router, backtest_router, indicators_router, live_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Trading Platform Backend started")
    yield
    logger.info("🛑 Trading Platform Backend shutting down")


app = FastAPI(
    title="Trading Strategy Platform API",
    description="Backtest and live trading strategy platform for Indian Markets (NSE/BSE)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev only; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router, prefix="/api/data", tags=["Market Data"])
app.include_router(indicators_router, prefix="/api/indicators", tags=["Indicators"])
app.include_router(backtest_router, prefix="/api/backtest", tags=["Backtesting"])
app.include_router(live_router, prefix="/api/live", tags=["Live Feed"])


@app.get("/health")
async def health():
    return {"status": "ok", "message": "Trading Platform API is running"}
