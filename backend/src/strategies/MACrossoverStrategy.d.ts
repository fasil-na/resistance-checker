import type { Candle, Trade } from '../types/index.js';
import type { Strategy } from './index.js';
export declare class MACrossoverStrategy implements Strategy {
    id: string;
    name: string;
    description: string;
    run(candles: Candle[], params: Record<string, any>): Trade[];
    private calculateMA;
}
//# sourceMappingURL=MACrossoverStrategy.d.ts.map