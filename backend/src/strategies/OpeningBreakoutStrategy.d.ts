import type { Candle, Trade } from '../types/index.js';
import type { Strategy } from './index.js';
export declare class OpeningBreakoutStrategy implements Strategy {
    id: string;
    name: string;
    description: string;
    run(candles: Candle[], params: Record<string, any>): Trade[];
}
//# sourceMappingURL=OpeningBreakoutStrategy.d.ts.map