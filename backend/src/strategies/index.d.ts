import type { Candle, Trade } from '../types/index.js';
export interface Strategy {
    id: string;
    name: string;
    description: string;
    run(candles: Candle[], params: Record<string, any>): Trade[];
}
export declare const strategies: Record<string, Strategy>;
//# sourceMappingURL=index.d.ts.map