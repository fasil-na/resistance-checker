import express, {} from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import crypto from 'crypto';
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
// --- CoinDCX API Auth ---
function createSignature(payload, secret) {
    const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    return signature;
}
app.post('/api/trade/execute', async (req, res) => {
    try {
        const apiKey = process.env.COINDCX_API_KEY;
        const apiSecret = process.env.COINDCX_API_SECRET;
        const { side, pair, price, orderType = "limit_order" } = req.body;
        if (!apiKey || !apiSecret) {
            return res.status(400).json({ error: 'Backend API Key and Secret are not configured' });
        }
        // For testing: 5 INR per trade
        const testTradeAmountINR = 5;
        const quantity = testTradeAmountINR / price;
        const timeStamp = Math.floor(Date.now());
        const body = {
            side,
            order_type: orderType,
            market: pair,
            price_per_unit: price,
            total_quantity: quantity,
            timestamp: timeStamp
        };
        const payload = Buffer.from(JSON.stringify(body)).toString('base64');
        const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
        // Note: In a real app, we would send this to https://api.coindcx.com/exchange/v1/orders/create
        console.log('Executing live trade (5 INR):', { side, pair, quantity, price });
        res.json({
            status: 'success',
            order_id: 'SIM-' + Math.random().toString(36).substr(2, 9),
            message: `Order placed successfully for 5 INR (${quantity.toFixed(8)} units)`
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Trade execution failed' });
    }
});
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/strategies', (_req, res) => {
    const strategies = [
        { id: 'opening-breakout', name: 'Opening Breakout' },
        { id: 'ma-crossover', name: 'MA Crossover' }
    ];
    res.json(strategies);
});
app.get('/api/market-data', async (req, res) => {
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
    }
    catch (error) {
        if (error.response) {
            console.error('Exchange error response:', error.response.status, error.response.data);
        }
        else {
            console.error('Error fetching market data:', error.message);
        }
        res.status(500).json({ error: 'Failed to fetch market data from exchange' });
    }
});
app.get('/api/ticker', async (req, res) => {
    try {
        const { pair = "BTCUSDT" } = req.query;
        // CoinDCX ticker returns an array of all pairs
        const response = await axios.get('https://api.coindcx.com/exchange/ticker');
        const ticker = response.data.find((t) => t.market === pair);
        if (ticker) {
            res.json({ last_price: ticker.last_price });
        }
        else {
            res.status(404).json({ error: 'Pair not found' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch ticker' });
    }
});
// --- EMA ---
function calculateEMA(data, period, index) {
    const k = 2 / (period + 1);
    const startIdx = Math.max(0, index - period);
    let ema = data[startIdx] || 0;
    for (let i = startIdx + 1; i <= index; i++) {
        const val = data[i] || 0;
        ema = val * k + ema * (1 - k);
    }
    return ema;
}
function avgVolume(candles, i, period = 20) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - period); j < i; j++) {
        const c = candles[j];
        if (c) {
            sum += c.volume;
            count++;
        }
    }
    return count > 0 ? sum / count : 0;
}
// --- ATR Calculation ---
function calculateATR(candles, period = 14, index) {
    let trs = [];
    for (let i = index - period + 1; i <= index; i++) {
        const c = candles[i];
        const prev = candles[i - 1];
        if (!c || !prev)
            continue;
        const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
        trs.push(tr);
    }
    return trs.reduce((a, b) => a + b, 0) / (trs.length || 1);
}
app.post('/api/backtest', async (req, res) => {
    try {
        const { isLive, from, to, month, year, startYear, startMonth, endYear, endMonth, pair = "B-BTC_USDT", capitalPerTrade = 1, resolution = "5", atrMultiplierSL = 1, feeRate = 0.0002 } = req.body;
        let allTrades = [];
        let periods = [];
        if (isLive) {
            const todayStart = dayjs().tz('Asia/Kolkata').startOf('day');
            periods.push({ year: todayStart.year(), month: todayStart.month() });
        }
        else if (startYear !== undefined && startMonth !== undefined && endYear !== undefined && endMonth !== undefined) {
            let current = dayjs().year(startYear).month(startMonth).startOf('month');
            const end = dayjs().year(endYear).month(endMonth).endOf('month');
            while (current.isBefore(end)) {
                periods.push({ year: current.year(), month: current.month() });
                current = current.add(1, 'month');
            }
        }
        else if (year !== undefined && month !== undefined) {
            periods.push({ year, month });
        }
        else {
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
                    const candles = response.data.data.sort((a, b) => a.time - b.time);
                    const closes = candles.map(c => c.close);
                    let currentTrade = null;
                    let rangeHigh = null;
                    let rangeLow = null;
                    let waiting = false;
                    let direction = null;
                    let lastBreakoutTime = null;
                    for (let i = 50; i < candles.length; i++) {
                        const c = candles[i];
                        if (!c || c.time < simulationStartUnix * 1000)
                            continue;
                        const time = dayjs(c.time).tz('Asia/Kolkata');
                        if (!rangeHigh && !rangeLow) {
                            const prev1 = candles[i - 1];
                            const prev2 = candles[i - 2];
                            if (prev1 && prev2) {
                                rangeHigh = Math.max(prev1.high, prev2.high);
                                rangeLow = Math.min(prev1.low, prev2.low);
                            }
                        }
                        if (rangeHigh === null || rangeLow === null)
                            continue;
                        const ema20 = calculateEMA(closes, 20, i);
                        const ema50 = calculateEMA(closes, 50, i);
                        if (Math.abs(ema20 - ema50) < 15)
                            continue;
                        const body = Math.abs(c.close - c.open);
                        const range = c.high - c.low;
                        if (range <= 0 || body / range <= 0.6)
                            continue;
                        if (c.volume <= avgVolume(candles, i) * 1.3)
                            continue;
                        if (Math.abs(c.close - ema20) < 10)
                            continue;
                        if (currentTrade) {
                            if (currentTrade.direction === 'buy') {
                                const lastHigh = currentTrade.lastHigh ?? currentTrade.entryPrice;
                                if (c.high > lastHigh) {
                                    const move = c.high - lastHigh;
                                    currentTrade.sl += move;
                                    currentTrade.lastHigh = c.high;
                                }
                                if (c.close <= currentTrade.sl) {
                                    currentTrade.exitPrice = currentTrade.sl;
                                    currentTrade.exitReason = 'SL';
                                    currentTrade.status = 'closed';
                                }
                            }
                            else {
                                const lastLow = currentTrade.lastLow ?? currentTrade.entryPrice;
                                if (c.low < lastLow) {
                                    const move = lastLow - c.low;
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
                                const units = currentTrade.units || 0;
                                const grossProfit = currentTrade.direction === 'buy'
                                    ? (currentTrade.exitPrice - currentTrade.entryPrice) * units
                                    : (currentTrade.entryPrice - currentTrade.exitPrice) * units;
                                const entryVal = currentTrade.entryPrice * units;
                                const exitVal = (currentTrade.exitPrice || 0) * units;
                                const fee = (entryVal + exitVal) * feeRate;
                                currentTrade.fee = fee;
                                currentTrade.profit = grossProfit - fee;
                                allTrades.push(currentTrade);
                                currentTrade = null;
                            }
                            continue;
                        }
                        if (!waiting) {
                            if (c.high > rangeHigh && ema20 > ema50) {
                                direction = 'buy';
                                waiting = true;
                                lastBreakoutTime = time.toISOString();
                            }
                            else if (c.low < rangeLow && ema20 < ema50) {
                                direction = 'sell';
                                waiting = true;
                                lastBreakoutTime = time.toISOString();
                            }
                        }
                        else {
                            const entry = c.close;
                            const atr = calculateATR(candles, 14, i);
                            const sl = direction === 'buy' ? entry - atr * atrMultiplierSL : entry + atr * atrMultiplierSL;
                            const riskPerUnit = Math.abs(entry - sl);
                            const units = riskPerUnit > 0 ? capitalPerTrade / riskPerUnit : 0;
                            currentTrade = {
                                rangeHigh,
                                rangeLow,
                                breakoutTime: lastBreakoutTime || time.toISOString(),
                                entryTime: time.toISOString(),
                                direction: direction,
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
                }
            }
            catch (err) {
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Backtest failed' });
    }
});
//find best combination 
app.post('/api/backtest/optimize', async (req, res) => {
    try {
        const { pair = "B-BTC_USDT", startYear = dayjs().year() - 3, resolutions = ["5", "15", "30"], atrMultipliers = [1, 2, 3, 4, 5], feeRate = 0.0002 } = req.body;
        const capitalPerTrade = 1;
        const now = dayjs();
        const start = dayjs().year(startYear).startOf('year');
        // Generate list of months to check
        const months = [];
        let current = start;
        while (current.isBefore(now)) {
            months.push({ year: current.year(), month: current.month() });
            current = current.add(1, 'month');
        }
        console.log(`Optimizing for ${pair} over ${months.length} months...`);
        // results[res][atr] = { totalProfit, totalTrades, winRate, monthlyProfits: [] }
        const configResults = {};
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
                    const candles = response.data.data.sort((a, b) => a.time - b.time);
                    const closes = candles.map(c => c.close);
                    for (const atrMultiplierSL of atrMultipliers) {
                        let trades = [];
                        let currentTrade = null;
                        let rangeHigh = null;
                        let rangeLow = null;
                        let waiting = false;
                        let direction = null;
                        for (let i = 50; i < candles.length; i++) {
                            const c = candles[i];
                            if (!c || c.time < simulationStartUnix * 1000)
                                continue;
                            if (!rangeHigh && !rangeLow) {
                                const p1 = candles[i - 1];
                                const p2 = candles[i - 2];
                                if (p1 && p2) {
                                    rangeHigh = Math.max(p1.high, p2.high);
                                    rangeLow = Math.min(p1.low, p2.low);
                                }
                            }
                            if (rangeHigh === null || rangeLow === null)
                                continue;
                            const ema20 = calculateEMA(closes, 20, i);
                            const ema50 = calculateEMA(closes, 50, i);
                            if (Math.abs(ema20 - ema50) < 15)
                                continue;
                            const body = Math.abs(c.close - c.open);
                            const range = c.high - c.low;
                            if (range <= 0 || body / range <= 0.6)
                                continue;
                            if (c.volume <= avgVolume(candles, i) * 1.3)
                                continue;
                            if (Math.abs(c.close - ema20) < 10)
                                continue;
                            if (currentTrade) {
                                if (currentTrade.direction === 'buy') {
                                    const lastHigh = currentTrade.lastHigh ?? currentTrade.entryPrice;
                                    if (c.high > lastHigh) {
                                        const move = c.high - lastHigh;
                                        currentTrade.sl += move;
                                        currentTrade.lastHigh = c.high;
                                    }
                                    if (c.close <= currentTrade.sl) {
                                        currentTrade.exitPrice = currentTrade.sl;
                                        currentTrade.status = 'closed';
                                    }
                                }
                                else {
                                    const lastLow = currentTrade.lastLow ?? currentTrade.entryPrice;
                                    if (c.low < lastLow) {
                                        const move = lastLow - c.low;
                                        currentTrade.sl -= move;
                                        currentTrade.lastLow = c.low;
                                    }
                                    if (c.close >= currentTrade.sl) {
                                        currentTrade.exitPrice = currentTrade.sl;
                                        currentTrade.status = 'closed';
                                    }
                                }
                                if (currentTrade.status === 'closed') {
                                    const units = currentTrade.units || 0;
                                    const gross = currentTrade.direction === 'buy'
                                        ? (currentTrade.exitPrice - currentTrade.entryPrice) * units
                                        : (currentTrade.entryPrice - currentTrade.exitPrice) * units;
                                    const entryVal = currentTrade.entryPrice * units;
                                    const exitVal = (currentTrade.exitPrice || 0) * units;
                                    const fee = (entryVal + exitVal) * feeRate;
                                    currentTrade.profit = gross - fee;
                                    trades.push(currentTrade);
                                    currentTrade = null;
                                }
                                continue;
                            }
                            if (!waiting) {
                                if (c.high > rangeHigh && ema20 > ema50) {
                                    direction = 'buy';
                                    waiting = true;
                                }
                                else if (c.low < rangeLow && ema20 < ema50) {
                                    direction = 'sell';
                                    waiting = true;
                                }
                            }
                            else {
                                const entry = c.close;
                                const atr = calculateATR(candles, 14, i);
                                const sl = direction === 'buy' ? entry - atr * atrMultiplierSL : entry + atr * atrMultiplierSL;
                                const riskPerUnit = Math.abs(entry - sl);
                                const units = riskPerUnit > 0 ? capitalPerTrade / riskPerUnit : 0;
                                currentTrade = {
                                    entryTime: dayjs(c.time).toISOString(),
                                    direction: direction,
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
                }
                catch (apiErr) {
                    console.error(`Error fetching data for ${m.year}-${m.month} res ${resolution}:`, apiErr);
                }
            }
        }
        // Flatten results for sorting
        const finalResults = [];
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Optimization failed' });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map