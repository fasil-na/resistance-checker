import type { Candle, Trade } from '../types/index.js';

export interface Strategy {
    id: string;
    name: string;
    description: string;
    run(candles: Candle[], params: Record<string, any>): Trade[];
}

import { OpeningBreakoutStrategy } from './OpeningBreakoutStrategy.js';
import { MACrossoverStrategy } from './MACrossoverStrategy.js';

export const strategies: Record<string, Strategy> = {
    'opening-breakout': new OpeningBreakoutStrategy(),
    'ma-crossover': new MACrossoverStrategy(),
};
