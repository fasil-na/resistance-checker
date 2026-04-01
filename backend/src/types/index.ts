export interface Trade {
    breakoutTime: string
    entryTime: string
    exitTime?: string
    direction: 'buy' | 'sell'
    entryPrice: number
    exitPrice?: number | undefined
    profit: number
    status: 'open' | 'closed'
    sl?: number | undefined
    tp?: number | undefined
    lastHigh?: number | undefined
    lastLow?: number | undefined
    initialRisk?: number | undefined
    exitReason?: 'TP' | 'SL' | 'Cutoff' | 'DayReset' | 'Manual'
}

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface BacktestParams {
    initialCapital: number;
    resolution: string;
}

export interface BacktestResult {
    trades: Trade[];
    summary: {
        totalProfit: number;
        count: number;
        successCount: number;
        failedCount: number;
        winRate: number;
        initialCapital: number;
    };
}
