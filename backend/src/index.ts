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
        const { pair = 'B-BTC_USDT', resolution = '60', from, to, isTest } = req.query;

        if (isTest === 'true') {
            return res.json(dummyData);
        }

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

import { strategies } from './strategies/index.js';
import type { Trade, Candle } from './types/index.js';

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
            strategyId = 'opening-breakout',
            isTest = false,
            ...strategyParams
        } = req.body;

        let candles: Candle[];

        if (isTest) {
            candles = [...dummyData.data].sort((a: any, b: any) => a.time - b.time);
        } else {
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
            candles = response.data.data.sort((a: any, b: any) => a.time - b.time);
        }

        const strategy = strategies[strategyId];
        if (!strategy) {
            return res.status(400).json({ error: 'Invalid strategy ID' });
        }

        const trades = strategy.run(candles, { ...strategyParams, resolution });

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

app.get('/api/strategies', (_req: Request, res: Response) => {
    const strategyList = Object.values(strategies).map(s => ({
        id: s.id,
        name: s.name,
        description: s.description
    }));
    res.json(strategyList);
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
