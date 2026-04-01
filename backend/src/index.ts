import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

import dummyData from './data/dummy_15m.json' with { type: 'json' };

dayjs.extend(utc);
dayjs.extend(timezone);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// CoinDCX API Details
const COINDCX_URL = "https://public.coindcx.com/market_data/candlesticks";

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/market-data', async (req: Request, res: Response) => {
    try {
        const { pair = 'B-BTC_USDT', resolution = '60', from, to } = req.query;

        // Ensure we always use live data unless explicitly requested otherwise for dev
        const useDummy = req.query.useDummy === 'true';
        if (useDummy) {
            return res.json(dummyData);
        }

        const now = Math.floor(Date.now() / 1000);
        const yesterday = now - (24 * 60 * 60);

        const params = {
            pair,
            from: Number(from || yesterday),
            to: Number(to || now),
            resolution: String(resolution),
            pcode: 'f'
        };

        console.log('Fetching market data with params:', params);
        const response = await axios.get(COINDCX_URL, { params });
        console.log('Exchange returned candles:', response.data.data?.length || 0);
        res.json(response.data);
    } catch (error: any) {
        if (error.response) {
            console.error('Exchange error response:', error.response.status, error.response.data);
        } else {
            console.error('Error fetching market data:', error.message);
        }
        res.status(500).json({ error: 'Failed to fetch market data from exchange' });
    }
});

interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface Trade {
    rangeHigh?: number;
    rangeLow?: number;
    breakoutTime?: string;
    entryTime: string;
    exitTime?: string;
    direction: 'buy' | 'sell';
    entryPrice: number;
    exitPrice?: number;
    sl: number;
    tp?: number;
    status: 'open' | 'closed';
    profit: number;
    exitReason?: string;
    lastHigh?: number;
    lastLow?: number;
    units?: number; // position size based on capital
    fee?: number;   // total fees for this trade
}

// --- EMA ---
function calculateEMA(data: number[], period: number, index: number): number {
    const k = 2 / (period + 1);
    const startIdx = Math.max(0, index - period);
    let ema = data[startIdx] || 0;
    for (let i = startIdx + 1; i <= index; i++) {
        const val = data[i] || 0;
        ema = val * k + ema * (1 - k);
    }
    return ema;
}

// --- AVG VOLUME ---
function avgVolume(candles: Candle[], i: number, period = 20): number {
    let sum = 0;
    const start = Math.max(0, i - period);
    const count = i - start;
    for (let j = start; j < i; j++) {
        const c = candles[j];
        if (c) sum += c.volume;
    }
    return count > 0 ? sum / count : 0;
}

// --- ATR Calculation ---
function calculateATR(candles: Candle[], period = 14, index: number): number {
    let trs: number[] = [];
    for (let i = index - period + 1; i <= index; i++) {
        const c = candles[i];
        const prev = candles[i - 1];
        if (!c || !prev) continue;
        const tr = Math.max(
            c.high - c.low,
            Math.abs(c.high - prev.close),
            Math.abs(c.low - prev.close)
        );
        trs.push(tr);
    }
    return trs.reduce((a, b) => a + b, 0) / (trs.length || 1);
}

app.post('/api/backtest', async (req: Request, res: Response) => {
    try {
        const {
            isLive,
            from,
            to,
            month,
            year,
            pair = "B-BTC_USDT",
            capitalPerTrade = 1,
            resolution = "5",
            atrMultiplierSL = 1,
            feeRate = 0.0002
        } = req.body;

        let simulationStartUnix: number; // The target period start (usually 12:00 AM)
        let dataFetchStartUnix: number; // The buffer start (usually 24h before)
        let endUnix: number;

        if (isLive) {
            // Live monitoring: Always start the strategy FROM 12:00 AM today
            const todayStart = dayjs().tz('Asia/Kolkata').startOf('day');
            simulationStartUnix = Math.floor(todayStart.valueOf() / 1000);
            dataFetchStartUnix = simulationStartUnix - (24 * 60 * 60); // 24-hour buffer for EMAs
            endUnix = Math.floor(Date.now() / 1000);
        } else if (year !== undefined && month !== undefined) {
            // Historical: Start searching from 12:00 AM on the first of the month
            const monthStart = dayjs().year(year).month(month).startOf('month');
            const monthEnd = dayjs().year(year).month(month).endOf('month');
            simulationStartUnix = Math.floor(monthStart.valueOf() / 1000);
            dataFetchStartUnix = simulationStartUnix - (24 * 60 * 60); // 24-hour buffer for EMAs
            endUnix = Math.floor(monthEnd.valueOf() / 1000);
        } else {
            simulationStartUnix = from || Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
            dataFetchStartUnix = simulationStartUnix;
            endUnix = to || Math.floor(Date.now() / 1000);
        }

        const response = await axios.get(COINDCX_URL, {
            params: { pair, from: dataFetchStartUnix, to: endUnix, resolution, pcode: 'f' }
        });

        if (response.data.s !== 'ok' || !Array.isArray(response.data.data)) {
            return res.status(400).json({ error: 'Invalid market data' });
        }

        const candles: Candle[] = response.data.data.sort((a: Candle, b: Candle) => a.time - b.time);
        const closes = candles.map(c => c.close);

        let trades: Trade[] = [];
        let currentTrade: Trade | null = null;

        let rangeHigh: number | null = null;
        let rangeLow: number | null = null;

        let waiting = false;
        let direction: 'buy' | 'sell' | null = null;
        let lastBreakoutTime: string | null = null;

        for (let i = 50; i < candles.length; i++) {
            const c = candles[i];
            if (!c) continue;
            const time = dayjs(c.time).tz('Asia/Kolkata');

            // Synchronize with 12:00 AM: Only start searching for trades after the buffer period
            if (c.time < simulationStartUnix * 1000) {
                continue;
            }

            if (!rangeHigh && !rangeLow) {
                const prev1 = candles[i - 1];
                const prev2 = candles[i - 2];
                if (prev1 && prev2) {
                    rangeHigh = Math.max(prev1.high, prev2.high);
                    rangeLow = Math.min(prev1.low, prev2.low);
                }
            }
            if (rangeHigh === null || rangeLow === null) continue;

            const ema20 = calculateEMA(closes, 20, i);
            const ema50 = calculateEMA(closes, 50, i);
            if (Math.abs(ema20 - ema50) < 15) continue;

            const body = Math.abs(c.close - c.open);
            const range = c.high - c.low;
            if (range <= 0 || body / range <= 0.6) continue;
            if (c.volume <= avgVolume(candles, i) * 1.3) continental: continue;
            if (Math.abs(c.close - ema20) < 10) continue;

            // --- TRADE MANAGEMENT ---
            if (currentTrade) {
                if (currentTrade.direction === 'buy') {
                    if (c.high > (currentTrade.lastHigh || currentTrade.entryPrice)) {
                        const move = c.high - (currentTrade.lastHigh || currentTrade.entryPrice);
                        currentTrade.sl += move;
                        currentTrade.lastHigh = c.high;
                    }
                    if (c.close <= currentTrade.sl) {
                        currentTrade.exitPrice = currentTrade.sl;
                        currentTrade.exitReason = 'SL';
                        currentTrade.status = 'closed';
                    }
                } else {
                    if (c.low < (currentTrade.lastLow || currentTrade.entryPrice)) {
                        const move = (currentTrade.lastLow || currentTrade.entryPrice) - c.low;
                        currentTrade.sl -= move;
                        currentTrade.lastLow = c.low;
                    }
                    if (c.close >= currentTrade.sl) {
                        currentTrade.exitPrice = currentTrade.sl;
                        currentTrade.exitReason = 'SL';
                        currentTrade.status = 'closed';
                    }
                }

                if (currentTrade.status === 'closed') {
                    currentTrade.exitTime = time.toISOString();
                    const grossProfit =
                        currentTrade.direction === 'buy'
                            ? (currentTrade.exitPrice! - currentTrade.entryPrice) * (currentTrade.units || 0)
                            : (currentTrade.entryPrice - currentTrade.exitPrice!) * (currentTrade.units || 0);

                    const entryVal = currentTrade.entryPrice * (currentTrade.units || 0);
                    const exitVal = (currentTrade.exitPrice || 0) * (currentTrade.units || 0);
                    const fee = (entryVal + exitVal) * feeRate;

                    currentTrade.fee = fee;
                    currentTrade.profit = grossProfit - fee;
                    trades.push(currentTrade);
                    currentTrade = null;
                }

                continue;
            }

            // --- BREAKOUT ---
            if (!waiting) {
                if (c.high > rangeHigh && ema20 > ema50) {
                    direction = 'buy';
                    waiting = true;
                    lastBreakoutTime = time.toISOString();
                } else if (c.low < rangeLow && ema20 < ema50) {
                    direction = 'sell';
                    waiting = true;
                    lastBreakoutTime = time.toISOString();
                }
            }

            // --- ENTRY ---
            else {
                const entry = c.close;
                const atr = calculateATR(candles, 14, i);
                const sl = direction === 'buy'
                    ? entry - atr * atrMultiplierSL
                    : entry + atr * atrMultiplierSL;

                const riskPerUnit = Math.abs(entry - sl);
                const units = riskPerUnit > 0 ? capitalPerTrade / riskPerUnit : 0;

                currentTrade = {
                    rangeHigh,
                    rangeLow,
                    breakoutTime: lastBreakoutTime || time.toISOString(),
                    entryTime: time.toISOString(),
                    direction: direction!,
                    entryPrice: entry,
                    sl,
                    status: 'open',
                    profit: 0,
                    lastHigh: entry,
                    lastLow: entry,
                    units
                };

                waiting = false;
                rangeHigh = null;
                rangeLow = null;
            }
        }

        const summary = {
            totalProfit: trades.reduce((a, t) => a + t.profit, 0),
            totalFee: trades.reduce((a, t) => a + (t.fee || 0), 0),
            count: trades.length,
            successCount: trades.filter(t => t.profit > 0).length,
            failedCount: trades.filter(t => t.profit <= 0).length,
            winRate:
                trades.length > 0
                    ? (trades.filter(t => t.profit > 0).length / trades.length) * 100
                    : 0
        };

        res.json({ trades, summary });

    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Backtest failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
