import type { Candle, Trade } from '../types/index.js';
import type { Strategy } from './index.js';

export class MACrossoverStrategy implements Strategy {
    id = 'ma-crossover';
    name = 'MA Crossover';
    description = 'Simple Moving Average crossover strategy.';

    run(candles: Candle[], params: Record<string, any>): Trade[] {
        if (candles.length < 50) return [];

        const {
            shortPeriod = 9,
            longPeriod = 21,
            initialCapital = 1000
        } = params;

        let trades: Trade[] = [];
        let currentTrade: Trade | null = null;

        for (let i = longPeriod; i < candles.length; i++) {
            const shortMA = this.calculateMA(candles.slice(i - shortPeriod, i), shortPeriod);
            const longMA = this.calculateMA(candles.slice(i - longPeriod, i), longPeriod);

            const prevShortMA = this.calculateMA(candles.slice(i - shortPeriod - 1, i - 1), shortPeriod);
            const prevLongMA = this.calculateMA(candles.slice(i - longPeriod - 1, i - 1), longPeriod);

            const candle = candles[i]!;

            if (currentTrade) {
                // Exit long if short MA crosses below long MA
                if (currentTrade.direction === 'buy' && shortMA < longMA && prevShortMA >= prevLongMA) {
                    currentTrade.exitPrice = candle.close;
                    currentTrade.exitTime = new Date(candle.time).toISOString();
                    currentTrade.profit = currentTrade.exitPrice - currentTrade.entryPrice;
                    currentTrade.status = 'closed';
                    currentTrade.exitReason = 'Manual';
                    trades.push(currentTrade);
                    currentTrade = null;
                }
                // Exit short if short MA crosses above long MA
                else if (currentTrade.direction === 'sell' && shortMA > longMA && prevShortMA <= prevLongMA) {
                    currentTrade.exitPrice = candle.close;
                    currentTrade.exitTime = new Date(candle.time).toISOString();
                    currentTrade.profit = currentTrade.entryPrice - currentTrade.exitPrice;
                    currentTrade.status = 'closed';
                    currentTrade.exitReason = 'Manual';
                    trades.push(currentTrade);
                    currentTrade = null;
                }
            } else {
                // Enter long if short MA crosses above long MA
                if (shortMA > longMA && prevShortMA <= prevLongMA) {
                    currentTrade = {
                        breakoutTime: new Date(candle.time).toISOString(),
                        entryTime: new Date(candle.time).toISOString(),
                        direction: 'buy',
                        entryPrice: candle.close,
                        profit: 0,
                        status: 'open'
                    };
                }
                // Enter short if short MA crosses below long MA
                else if (shortMA < longMA && prevShortMA >= prevLongMA) {
                    currentTrade = {
                        breakoutTime: new Date(candle.time).toISOString(),
                        entryTime: new Date(candle.time).toISOString(),
                        direction: 'sell',
                        entryPrice: candle.close,
                        profit: 0,
                        status: 'open'
                    };
                }
            }
        }

        if (currentTrade) {
            const lastCandle = candles[candles.length - 1]!;
            currentTrade.exitPrice = lastCandle.close;
            currentTrade.exitTime = new Date(lastCandle.time).toISOString();
            currentTrade.profit = currentTrade.direction === 'buy' ? currentTrade.exitPrice - currentTrade.entryPrice : currentTrade.entryPrice - currentTrade.exitPrice;
            currentTrade.status = 'closed';
            trades.push(currentTrade);
        }

        return trades;
    }

    private calculateMA(candles: Candle[], period: number): number {
        const sum = candles.reduce((acc, c) => acc + c.close, 0);
        return sum / period;
    }
}
