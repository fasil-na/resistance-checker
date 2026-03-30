import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

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
        const now = Math.floor(Date.now() / 1000);
        const yesterday = now - (24 * 60 * 60);

        const params = {
            pair,
            from: from || yesterday,
            to: to || now,
            resolution,
            pcode: 'f'
        };

        const response = await axios.get(COINDCX_URL, { params });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching market data:', error);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
});

interface Trade {
    entryTime: string
    exitTime?: string
    direction: 'buy' | 'sell'
    entryPrice: number
    exitPrice?: number | undefined
    profit: number
    status: 'open' | 'closed'
    sl?: number | undefined
    tp?: number | undefined
    lastHigh?: number | undefined
    lastLow?: number | undefined
    initialRisk?: number | undefined
}

app.post('/api/backtest', async (req: Request, res: Response) => {
    try {
        const {
            pair = 'B-BTC_USDT',
            resolution = '15',
            from,
            to,
            month,
            year,
            initialCapital = 1000,
            rangeHour = 4,
            rangeMinute = 0,
            cutoffHour = 2,
            cutoffMinute = 15,
            buffer = 2,
            riskReward = 1.2,
            useTrailingSL = false
        } = req.body;

        let startUnix: number;
        let endUnix: number;

        if (year !== undefined && month !== undefined) {
            const startOfMonth = dayjs().year(year).month(month).startOf('month');
            const endOfMonth = dayjs().year(year).month(month).endOf('month');
            startUnix = Math.floor(startOfMonth.valueOf() / 1000);
            endUnix = Math.floor(endOfMonth.valueOf() / 1000);
        } else {
            startUnix = from || Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
            endUnix = to || Math.floor(Date.now() / 1000);
        }

        const params = {
            pair,
            from: startUnix,
            to: endUnix,
            resolution,
            pcode: 'f'
        };

        const response = await axios.get(COINDCX_URL, { params });
        if (response.data.s !== 'ok') {
            return res.status(400).json({ error: 'Invalid market data' });
        }

        const candles = response.data.data.sort((a: any, b: any) => a.time - b.time);

        let trades: Trade[] = [];
        let currentTrade: Trade | null = null;
        let today: string | null = null;
        let rangeHigh: number | null = null;
        let rangeLow: number | null = null;
        let breakCandleHigh: number | null = null;
        let breakCandleLow: number | null = null;
        let waitingForWickBreak = false;
        let breakoutDirection: 'buy' | 'sell' | null = null;
        let breakoutTime: number | null = null;
        let priceReturnedToRange = false;

        for (let i = 2; i < candles.length; i++) {
            const candle = candles[i];
            const prevCandle = candles[i - 1];
            const prevPrevCandle = candles[i - 2];

            const time = dayjs(candle.time).tz('Asia/Kolkata');
            const dateStr = time.format('YYYY-MM-DD');

            // --- RESET AT START OF EACH DAY ---
            if (dateStr !== today) {
                today = dateStr;
                if (currentTrade) {
                    currentTrade.exitPrice = candle.open;
                    currentTrade.exitTime = time.toISOString();
                    currentTrade.profit = currentTrade.direction === 'buy' ? currentTrade.exitPrice! - currentTrade.entryPrice : currentTrade.entryPrice - currentTrade.exitPrice!;
                    currentTrade.status = 'closed';
                    trades.push(currentTrade);
                    currentTrade = null;
                }
                rangeHigh = null;
                rangeLow = null;
                breakCandleHigh = null;
                breakCandleLow = null;
                waitingForWickBreak = false;
                breakoutDirection = null;
                priceReturnedToRange = false;
                breakoutTime = null;
            }

            // --- CUTOFF ---
            if (time.hour() === cutoffHour && time.minute() === cutoffMinute) {
                if (currentTrade) {
                    currentTrade.exitPrice = candle.open;
                    currentTrade.exitTime = time.toISOString();
                    currentTrade.profit = currentTrade.direction === 'buy' ? currentTrade.exitPrice! - currentTrade.entryPrice : currentTrade.entryPrice - currentTrade.exitPrice!;
                    currentTrade.status = 'closed';
                    trades.push(currentTrade);
                    currentTrade = null;
                }
                continue;
            }

            // --- DEFINE RANGE ---
            if (time.hour() === rangeHour && time.minute() === rangeMinute && !rangeHigh) {
                rangeHigh = Math.max(prevPrevCandle.high, prevCandle.high);
                rangeLow = Math.min(prevPrevCandle.low, prevCandle.low);
                priceReturnedToRange = true;
            }

            if (!rangeHigh || !rangeLow) continue;

            if (currentTrade) {
                // Check SL/TP
                if (currentTrade.direction === 'buy') {
                    if (candle.low <= currentTrade.sl!) {
                        currentTrade.exitPrice = currentTrade.sl;
                        currentTrade.status = 'closed';
                    } else if (candle.high >= currentTrade.tp! && !useTrailingSL) {
                        currentTrade.exitPrice = currentTrade.tp;
                        currentTrade.status = 'closed';
                    }
                } else {
                    if (candle.high >= currentTrade.sl!) {
                        currentTrade.exitPrice = currentTrade.sl;
                        currentTrade.status = 'closed';
                    } else if (candle.low <= currentTrade.tp! && !useTrailingSL) {
                        currentTrade.exitPrice = currentTrade.tp;
                        currentTrade.status = 'closed';
                    }
                }

                // --- DYNAMIC TRAILING SL ---
                if (currentTrade.status === 'open' && useTrailingSL) {
                    if (currentTrade.direction === 'buy') {
                        // If price makes a new high, move SL up by the same amount
                        if (candle.high > currentTrade.lastHigh!) {
                            const move = candle.high - currentTrade.lastHigh!;
                            currentTrade.sl! += move;
                            currentTrade.lastHigh = candle.high;
                        }
                    } else {
                        // If price makes a new low, move SL down by the same amount
                        if (candle.low < currentTrade.lastLow!) {
                            const move = currentTrade.lastLow! - candle.low;
                            currentTrade.sl! -= move;
                            currentTrade.lastLow = candle.low;
                        }
                    }
                }

                if (currentTrade.status === 'closed') {
                    currentTrade.exitTime = time.toISOString();
                    currentTrade.profit = currentTrade.direction === 'buy' ? currentTrade.exitPrice! - currentTrade.entryPrice : currentTrade.entryPrice - currentTrade.exitPrice!;
                    trades.push(currentTrade);
                    currentTrade = null;
                }
                continue;
            }

            // --- TRACK IF PRICE RETURNED TO RANGE ---
            if (candle.close >= rangeLow && candle.close <= rangeHigh) {
                priceReturnedToRange = true;
            }

            // --- STEP 1: DETECT BREAKOUT ---
            if (!waitingForWickBreak) {
                if (!priceReturnedToRange) continue;

                if (candle.close > rangeHigh + buffer) {
                    breakoutDirection = 'buy';
                    breakCandleHigh = candle.high;
                    breakCandleLow = candle.low;
                    waitingForWickBreak = true;
                    priceReturnedToRange = false;
                    breakoutTime = candle.time;
                } else if (candle.close < rangeLow - buffer) {
                    breakoutDirection = 'sell';
                    breakCandleHigh = candle.high;
                    breakCandleLow = candle.low;
                    waitingForWickBreak = true;
                    priceReturnedToRange = false;
                    breakoutTime = candle.time;
                }
            }
            // --- STEP 2: NEXT CANDLE ENTRY ---
            else if (waitingForWickBreak) {
                const resInMs = parseInt(resolution) * 60 * 1000;
                if (candle.time > breakoutTime! + resInMs) {
                    waitingForWickBreak = false;
                    continue;
                }

                const riskVal = breakCandleHigh! - breakCandleLow!;
                if (riskVal <= 0) {
                    waitingForWickBreak = false;
                    continue;
                }

                const body = Math.abs(candle.close - candle.open);
                const range = candle.high - candle.low;
                if (range === 0 || (body / range) < 0.4) continue;

                if (breakoutDirection === 'buy' && candle.high >= breakCandleHigh!) {
                    const sl = breakCandleLow! - buffer;
                    const risk = breakCandleHigh! - sl;
                    currentTrade = {
                        entryTime: time.toISOString(),
                        direction: 'buy',
                        entryPrice: breakCandleHigh!,
                        profit: 0,
                        status: 'open',
                        sl: sl,
                        tp: breakCandleHigh! + (risk * riskReward),
                        lastHigh: candle.high,
                        lastLow: candle.low,
                        initialRisk: risk
                    };
                    waitingForWickBreak = false;
                } else if (breakoutDirection === 'sell' && candle.low <= breakCandleLow!) {
                    const sl = breakCandleHigh! + buffer;
                    const risk = sl - breakCandleLow!;
                    currentTrade = {
                        entryTime: time.toISOString(),
                        direction: 'sell',
                        entryPrice: breakCandleLow!,
                        profit: 0,
                        status: 'open',
                        sl: sl,
                        tp: breakCandleLow! - (risk * riskReward),
                        lastHigh: candle.high,
                        lastLow: candle.low,
                        initialRisk: risk
                    };
                    waitingForWickBreak = false;
                }
            }
        }

        const stats = {
            totalProfit: trades.reduce((acc, t) => acc + t.profit, 0),
            count: trades.length,
            successCount: trades.filter(t => t.profit > 0).length,
            failedCount: trades.filter(t => t.profit <= 0).length,
            winRate: trades.length > 0 ? (trades.filter(t => t.profit > 0).length / trades.length) * 100 : 0,
            initialCapital
        };
        res.json({ trades, summary: stats });

    } catch (error) {
        console.error('Backtest error:', error);
        res.status(500).json({ error: 'Backtest failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
