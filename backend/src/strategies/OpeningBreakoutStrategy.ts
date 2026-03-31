import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import type { Candle, Trade } from '../types/index.js';
import type { Strategy } from './index.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export class OpeningBreakoutStrategy implements Strategy {
    id = 'opening-breakout';
    name = 'Opening Breakout';
    description = 'Trades based on the high/low of an opening time window.';

    run(candles: Candle[], params: Record<string, any>): Trade[] {
        if (candles.length < 3) return [];

        const {
            rangeHour = 4,
            rangeMinute = 0,
            cutoffHour = 2,
            cutoffMinute = 15,
            buffer = 2,
            riskReward = 1.2,
            useTrailingSL = false,
            resolution = '15'
        } = params;

        let trades: Trade[] = [];
        let currentTrade: Trade | null = null;
        let today: string | null = null;
        let rangeHigh: number | null = null;
        let rangeLow: number | null = null;
        let breakCandleHigh: number | null = null;
        let breakCandleLow: number | null = null;
        let waitingForWickBreak = false;
        let breakoutDirection: 'buy' | 'sell' | null = null;
        let breakoutTimeStr: string | null = null;
        let priceReturnedToRange = false;

        for (let i = 2; i < candles.length; i++) {
            const candle = candles[i]!;
            const prevCandle = candles[i - 1]!;
            const prevPrevCandle = candles[i - 2]!;

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
                    currentTrade.exitReason = 'DayReset';
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
                breakoutTimeStr = null;
            }

            // --- CUTOFF ---
            if (time.hour() === cutoffHour && time.minute() === cutoffMinute) {
                if (currentTrade) {
                    currentTrade.exitPrice = candle.open;
                    currentTrade.exitTime = time.toISOString();
                    currentTrade.profit = currentTrade.direction === 'buy' ? currentTrade.exitPrice! - currentTrade.entryPrice : currentTrade.entryPrice - currentTrade.exitPrice!;
                    currentTrade.status = 'closed';
                    currentTrade.exitReason = 'Cutoff';
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
                        currentTrade.exitReason = 'SL';
                    } else if (candle.high >= currentTrade.tp! && !useTrailingSL) {
                        currentTrade.exitPrice = currentTrade.tp;
                        currentTrade.status = 'closed';
                        currentTrade.exitReason = 'TP';
                    }
                } else {
                    if (candle.high >= currentTrade.sl!) {
                        currentTrade.exitPrice = currentTrade.sl;
                        currentTrade.status = 'closed';
                        currentTrade.exitReason = 'SL';
                    } else if (candle.low <= currentTrade.tp! && !useTrailingSL) {
                        currentTrade.exitPrice = currentTrade.tp;
                        currentTrade.status = 'closed';
                        currentTrade.exitReason = 'TP';
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

                const brkBody = Math.abs(candle.close - candle.open);
                const brkRange = candle.high - candle.low;
                if (brkRange === 0 || (brkBody / brkRange) < 0.5) continue;

                if (candle.close > rangeHigh + buffer) {
                    breakoutDirection = 'buy';
                    breakCandleHigh = candle.high;
                    breakCandleLow = candle.low;
                    waitingForWickBreak = true;
                    priceReturnedToRange = false;
                    breakoutTimeStr = dayjs(candle.time).tz('Asia/Kolkata').toISOString();
                } else if (candle.close < rangeLow - buffer) {
                    breakoutDirection = 'sell';
                    breakCandleHigh = candle.high;
                    breakCandleLow = candle.low;
                    waitingForWickBreak = true;
                    priceReturnedToRange = false;
                    breakoutTimeStr = dayjs(candle.time).tz('Asia/Kolkata').toISOString();
                }
            }
            // --- STEP 2: NEXT CANDLE ENTRY ---
            else if (waitingForWickBreak) {
                const resInMs = parseInt(resolution) * 60 * 1000;
                if (candle.time > dayjs(breakoutTimeStr).valueOf() + resInMs) {
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
                        breakoutTime: breakoutTimeStr!,
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
                        breakoutTime: breakoutTimeStr!,
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

        // Close any remaining open trade
        if (currentTrade) {
            const lastCandle = candles[candles.length - 1]!;
            currentTrade.exitPrice = lastCandle.close;
            currentTrade.exitTime = dayjs(lastCandle.time).tz('Asia/Kolkata').toISOString();
            currentTrade.profit = currentTrade.direction === 'buy' ? currentTrade.exitPrice! - currentTrade.entryPrice : currentTrade.entryPrice - currentTrade.exitPrice!;
            currentTrade.status = 'closed';
            currentTrade.exitReason = 'DayReset';
            trades.push(currentTrade);
            currentTrade = null;
        }

        return trades;
    }
}
