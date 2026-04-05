import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import crypto from 'crypto';

import dummyData from './data/dummy_15m.json' with { type: 'json' };
import { strategies } from './strategies/index.js';
import type { Candle, Trade } from './types/index.js';

dayjs.extend(utc);
dayjs.extend(timezone);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
// CoinDCX API Details
const COINDCX_URL = "https://public.coindcx.com/market_data/candlesticks";

// --- CoinDCX API Auth ---
function createSignature(payload: any, secret: string) {
    const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    return signature;
}

app.post('/api/trade/execute', async (req: Request, res: Response) => {
    try {
        const apiKey = process.env.COINDCX_API_KEY;
        const apiSecret = process.env.COINDCX_API_SECRET;
        const { side, pair, price, capital = 100, orderType = "limit_order" } = req.body;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({ error: 'Backend API Key and Secret are not configured' });
        }

        // Fetch market details to get precision
        const marketDetailsResponse = await axios.get('https://apigw.coindcx.com/exchange/v1/markets_details');
        const marketDetails = marketDetailsResponse.data.find((m: any) => m.coindcx_name === 'DOGEINR');

        console.log(marketDetails, 'marketDetails------')

        if (!marketDetails) {
            return res.status(404).json({ error: 'Market details not found for DOGEINR' });
        }

        const targetPrecision = marketDetails.target_currency_precision;
        const basePrecision = marketDetails.base_currency_precision;

        // Lot sizing: Static values for DOGEINR trade with dynamic precision
        const quantity = (12).toFixed(targetPrecision).toString();
        const newPrice = (8.5).toFixed(basePrecision).toString();
        const timeStamp = Date.now();
        const body = {
            side,
            order_type: "market_order",
            market: 'DOGEINR',
            price_per_unit: newPrice,
            total_quantity: quantity,
            timestamp: timeStamp,
            client_order_id: `T-${timeStamp}`
        };
        console.log(body, 'body-----')

        const bodyString = JSON.stringify(body);
        const signature = crypto
            .createHmac('sha256', apiSecret)
            .update(bodyString)
            .digest('hex');

        console.log('---------------------------');

        const response = await axios.post('https://apigw.coindcx.com/exchange/v1/orders/create', bodyString, {
            headers: {
                'X-AUTH-APIKEY': apiKey,
                'X-AUTH-SIGNATURE': signature,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error: any) {
        if (error.response) {
            console.error('CoinDCX API Error Response:', JSON.stringify(error.response.data, null, 2));
            return res.status(error.response.status).json(error.response.data);
        }
        console.error('Execution Error:', error.message);
        res.status(500).json({ error: 'Trade execution failed: ' + error.message });
    }
});

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok', timestamp: new Date().toISOString()

    });
});

app.post('/api/user/balances', async (req: Request, res: Response) => {
    try {
        const apiKey = process.env.COINDCX_API_KEY;
        const apiSecret = process.env.COINDCX_API_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({ error: 'Backend API Key and Secret are not configured' });
        }

        const timeStamp = Date.now();
        const body = {
            timestamp: timeStamp
        };

        const bodyString = JSON.stringify(body);
        const signature = crypto
            .createHmac('sha256', apiSecret)
            .update(bodyString)
            .digest('hex');

        const response = await axios.post('https://api.coindcx.com/exchange/v1/users/balances', bodyString, {
            headers: {
                'X-AUTH-APIKEY': apiKey,
                'X-AUTH-SIGNATURE': signature,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error: any) {
        if (error.response) {
            console.error('CoinDCX API Error Response:', JSON.stringify(error.response.data, null, 2));
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ error: 'Failed to fetch balances: ' + error.message });
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

        const response = await axios.get(COINDCX_URL, { params });
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

app.get('/api/ticker', async (req: Request, res: Response) => {
    try {
        const { pair = "BTCUSDT" } = req.query;
        // CoinDCX ticker returns an array of all pairs
        const response = await axios.get('https://api.coindcx.com/exchange/ticker');
        const ticker = response.data.find((t: any) => t.market === pair);
        if (ticker) {
            res.json({ last_price: ticker.last_price });
        } else {
            res.status(404).json({ error: 'Pair not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ticker' });
    }
});


app.post('/api/backtest', async (req: Request, res: Response) => {
    try {
        const {
            isLive,
            from,
            to,
            month,
            year,
            startYear,
            startMonth,
            endYear,
            endMonth,
            pair = "B-BTC_USDT",
            capitalPerTrade = 1,
            resolution = "5",
            atrMultiplierSL = 10,
            feeRate = 0.0002
        } = req.body;

        let allTrades: Trade[] = [];
        let periods: { year: number, month: number }[] = [];

        if (isLive) {
            const todayStart = dayjs().tz('Asia/Kolkata').startOf('day');
            periods.push({ year: todayStart.year(), month: todayStart.month() });
        } else if (startYear !== undefined && startMonth !== undefined && endYear !== undefined && endMonth !== undefined) {
            let current = dayjs().year(startYear).month(startMonth).startOf('month');
            const end = dayjs().year(endYear).month(endMonth).endOf('month');
            while (current.isBefore(end)) {
                periods.push({ year: current.year(), month: current.month() });
                current = current.add(1, 'month');
            }
        } else if (year !== undefined && month !== undefined) {
            periods.push({ year, month });
        } else {
            // Fallback to 'from' and 'to' or last 30 days
            const s = from ? dayjs.unix(from) : dayjs().subtract(30, 'days');
            const e = to ? dayjs.unix(to) : dayjs();
            let current = s.startOf('month');
            while (current.isBefore(e)) {
                periods.push({ year: current.year(), month: current.month() });
                current = current.add(1, 'month');
            }
        }

        for (const period of periods) {
            const monthStart = dayjs().year(period.year).month(period.month).startOf('month');
            const monthEnd = dayjs().year(period.year).month(period.month).endOf('month');

            let simulationStartUnix = Math.floor(monthStart.valueOf() / 1000);
            let dataFetchStartUnix = simulationStartUnix - (24 * 60 * 60);
            let endUnix = Math.floor(monthEnd.valueOf() / 1000);

            if (isLive) {
                const todayStart = dayjs().tz('Asia/Kolkata').startOf('day');
                simulationStartUnix = Math.floor(todayStart.valueOf() / 1000);
                dataFetchStartUnix = simulationStartUnix - (24 * 60 * 60);
                endUnix = Math.floor(Date.now() / 1000);
            }

            try {
                const response = await axios.get(COINDCX_URL, {
                    params: { pair, from: dataFetchStartUnix, to: endUnix, resolution, pcode: 'f' }
                });

                if (response.data.s === 'ok' && Array.isArray(response.data.data)) {
                    const candles: Candle[] = response.data.data.sort((a: Candle, b: Candle) => a.time - b.time);

                    const strategyId = req.body.strategyId || 'opening-breakout';
                    const strategy = strategies[strategyId];

                    if (strategy) {
                        const trades = strategy.run(candles, {
                            ...req.body,
                            simulationStartUnix
                        });
                        allTrades.push(...trades);
                    }
                }
            } catch (err) {
                console.error(`Error in period ${period.year}-${period.month}:`, err);
            }
        }

        const summary = {
            totalProfit: allTrades.reduce((a, t) => a + t.profit, 0),
            totalFee: allTrades.reduce((a, t) => a + (t.fee || 0), 0),
            count: allTrades.length,
            successCount: allTrades.filter(t => t.profit > 0).length,
            failedCount: allTrades.filter(t => t.profit <= 0).length,
            winRate: allTrades.length > 0 ? (allTrades.filter(t => t.profit > 0).length / allTrades.length) * 100 : 0
        };

        res.json({ trades: allTrades, summary });

    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Backtest failed' });
    }
});
//find best combination 

app.post('/api/backtest/optimize', async (req: Request, res: Response) => {
    try {
        const {
            pair = "B-BTC_USDT",
            startYear = dayjs().year() - 3,
            resolutions = ["5", "15", "30"],
            atrMultipliers = [1, 2, 3, 4, 5],
            feeRate = 0.0002
        } = req.body;

        const capitalPerTrade = 1;
        const now = dayjs();
        const start = dayjs().year(startYear).startOf('year');

        // Generate list of months to check
        const months: { year: number, month: number }[] = [];
        let current = start;
        while (current.isBefore(now)) {
            months.push({ year: current.year(), month: current.month() });
            current = current.add(1, 'month');
        }

        console.log(`Optimizing for ${pair} over ${months.length} months...`);

        // results[res][atr] = { totalProfit, totalTrades, winRate, monthlyProfits: [] }
        const configResults: Record<string, Record<number, any>> = {};

        for (const resolution of resolutions) {
            configResults[resolution] = {};
            for (const atr of atrMultipliers) {
                configResults[resolution][atr] = {
                    totalProfit: 0,
                    totalTrades: 0,
                    wins: 0,
                    monthlyProfits: []
                };
            }
        }

        // To avoid redundant API calls, we'll loop months then resolutions
        for (const m of months) {
            const monthStart = dayjs().year(m.year).month(m.month).startOf('month');
            const monthEnd = dayjs().year(m.year).month(m.month).endOf('month');
            const simulationStartUnix = Math.floor(monthStart.valueOf() / 1000);
            const dataFetchStartUnix = simulationStartUnix - (24 * 60 * 60);
            const endUnix = Math.floor(monthEnd.valueOf() / 1000);

            for (const resolution of resolutions) {
                try {
                    const response = await axios.get(COINDCX_URL, {
                        params: { pair, from: dataFetchStartUnix, to: endUnix, resolution, pcode: 'f' }
                    });

                    if (response.data.s !== 'ok' || !Array.isArray(response.data.data)) {
                        continue;
                    }

                    const candles: Candle[] = response.data.data.sort((a: Candle, b: Candle) => a.time - b.time);

                    const strategyId = req.body.strategyId || 'opening-breakout';
                    const strategy = strategies[strategyId];

                    if (!strategy) continue;

                    for (const atrMultiplierSL of atrMultipliers) {
                        const trades = strategy.run(candles, {
                            ...req.body,
                            resolution,
                            atrMultiplierSL,
                            simulationStartUnix
                        });

                        const monthProfit = trades.reduce((a, t) => a + t.profit, 0);
                        const monthWins = trades.filter(t => t.profit > 0).length;

                        configResults[resolution][atrMultiplierSL].totalProfit += monthProfit;
                        configResults[resolution][atrMultiplierSL].totalTrades += trades.length;
                        configResults[resolution][atrMultiplierSL].wins += monthWins;
                        configResults[resolution][atrMultiplierSL].monthlyProfits.push({
                            year: m.year,
                            month: m.month,
                            profit: monthProfit,
                            trades: trades.length
                        });
                    }
                } catch (apiErr) {
                    console.error(`Error fetching data for ${m.year}-${m.month} res ${resolution}:`, apiErr);
                }
            }
        }

        // Flatten results for sorting
        const finalResults: any[] = [];
        for (const resolution of resolutions) {
            for (const atr of atrMultipliers) {
                const res = configResults[resolution][atr];
                finalResults.push({
                    resolution,
                    atrMultiplierSL: atr,
                    totalProfit: res.totalProfit,
                    totalTrades: res.totalTrades,
                    winRate: res.totalTrades > 0 ? (res.wins / res.totalTrades) * 100 : 0,
                    monthlyProfits: res.monthlyProfits
                });
            }
        }

        finalResults.sort((a, b) => b.totalProfit - a.totalProfit);

        res.json({
            best: finalResults[0] || null,
            topResults: finalResults.slice(0, 5),
            totalTested: finalResults.length,
            periodChecked: `${start.format('MMM YYYY')} to ${now.format('MMM YYYY')}`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Optimization failed' });
    }
});














app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
