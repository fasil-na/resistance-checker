import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import type { Candle, Trade } from '../types/index.js';
import type { Strategy } from './index.js';
import { calculateUnits, calculateTradeProfit } from './StrategyUtils.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export class OpeningBreakoutStrategy implements Strategy {
    id = 'opening-breakout';
    name = 'Opening Breakout';
    description = 'Trades based on the high/low of an opening time window with EMA and ATR filters.';

    run(candles: Candle[], params: Record<string, any>): Trade[] {
        if (candles.length < 50) return [];

        const {
            capital = 1000,
            riskPerTrade = 1, // 1%
            maxPositionSize = 100, // 100%
            atrMultiplierSL = 0.4,
            feeRate = 0.0002,
            simulationStartUnix = 0
        } = params;

        const closes = candles.map(c => c.close);
        let allTrades: Trade[] = [];
        let currentTrade: Trade | null = null;
        let rangeHigh: number | null = null;
        let rangeLow: number | null = null;
        let waiting = false;
        let direction: 'buy' | 'sell' | null = null;
        let lastBreakoutTime: string | null = null;

        for (let i = 50; i < candles.length; i++) {
            const c = candles[i];
            if (!c || (simulationStartUnix && c.time < simulationStartUnix * 1000)) continue;
            const time = dayjs(c.time).tz('Asia/Kolkata');

            if (!rangeHigh && !rangeLow) {
                const prev1 = candles[i - 1];
                const prev2 = candles[i - 2];
                if (prev1 && prev2) {
                    rangeHigh = Math.max(prev1.high, prev2.high);
                    rangeLow = Math.min(prev1.low, prev2.low);
                }
            }
            if (rangeHigh === null || rangeLow === null) continue;

            const ema20 = this.calculateEMA(closes, 20, i);
            const ema50 = this.calculateEMA(closes, 50, i);
            if (Math.abs(ema20 - ema50) < 15) continue;

            const body = Math.abs(c.close - c.open);
            const range = c.high - c.low;
            if (range <= 0 || body / range <= 0.6) continue;
            if (c.volume <= this.avgVolume(candles, i) * 1.3) continue;
            if (Math.abs(c.close - ema20) < 10) continue;

            if (currentTrade) {
                const { trailingSL = true } = params;
                if (currentTrade.direction === 'buy') {
                    if (trailingSL) {
                        const lastHigh = currentTrade.lastHigh ?? currentTrade.entryPrice;
                        if (c.high > lastHigh) {
                            const move = c.high - lastHigh;
                            currentTrade.sl! += move;
                            currentTrade.lastHigh = c.high;
                        }
                    }
                    if (c.close <= currentTrade.sl!) {
                        currentTrade.exitPrice = currentTrade.sl!;
                        currentTrade.exitReason = 'SL';
                        currentTrade.status = 'closed';
                    }
                } else {
                    if (trailingSL) {
                        const lastLow = currentTrade.lastLow ?? currentTrade.entryPrice;
                        if (c.low < lastLow) {
                            const move = lastLow - c.low;
                            currentTrade.sl! -= move;
                            currentTrade.lastLow = c.low;
                        }
                    }
                    if (c.close >= currentTrade.sl!) {
                        currentTrade.exitPrice = currentTrade.sl!;
                        currentTrade.exitReason = 'SL';
                        currentTrade.status = 'closed';
                    }
                }

                if (currentTrade.status === 'closed') {
                    currentTrade.exitTime = time.toISOString();
                    const { profit, fee } = calculateTradeProfit(currentTrade, currentTrade.exitPrice!, feeRate);
                    currentTrade.fee = fee;
                    currentTrade.profit = profit;
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
                } else if (c.low < rangeLow && ema20 < ema50) {
                    direction = 'sell';
                    waiting = true;
                    lastBreakoutTime = time.toISOString();
                }
            } else {
                const entry = c.close;
                const atr = this.calculateATR(candles, 14, i);
                const sl = direction === 'buy' ? entry - atr * atrMultiplierSL : entry + atr * atrMultiplierSL;

                const units = calculateUnits(entry, sl, {
                    capital,
                    riskPerTrade,
                    maxPositionSize,
                    feeRate
                });

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

        return allTrades;
    }

    private calculateEMA(data: number[], period: number, index: number): number {
        const k = 2 / (period + 1);
        const startIdx = Math.max(0, index - period);
        let ema = data[startIdx] || 0;
        for (let i = startIdx + 1; i <= index; i++) {
            const val = data[i] || 0;
            ema = val * k + ema * (1 - k);
        }
        return ema;
    }

    private avgVolume(candles: Candle[], i: number, period = 20): number {
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

    private calculateATR(candles: Candle[], period = 14, index: number): number {
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
}

