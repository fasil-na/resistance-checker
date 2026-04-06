import type { Candle, Trade } from '../types/index.js';

export interface LotSizingParams {
    capital: number;
    riskPerTrade: number; // Percentage of capital to risk per trade (e.g. 1 for 1%)
    maxPositionSize?: number; // Max percentage of capital to use for a single position (e.g. 100 for 100%)
    feeRate: number;
}

export function calculateUnits(
    entryPrice: number,
    stopLoss: number,
    params: LotSizingParams
): number {
    const riskAmount = params.capital * (params.riskPerTrade / 100);
    const riskPerUnit = Math.abs(entryPrice - stopLoss);

    if (riskPerUnit === 0) return 0;

    // Units based on risk
    let units = riskAmount / riskPerUnit;

    // Units based on max position size (capital constraint)
    const maxCapitalForTrade = params.capital * ((params.maxPositionSize || 100) / 100);
    const maxUnitsByCapital = maxCapitalForTrade / entryPrice;

    return Math.min(units, maxUnitsByCapital);
}

export function calculateTradeProfit(
    trade: Trade,
    exitPrice: number,
    feeRate: number
): { profit: number; fee: number } {
    const units = trade.units || 0;
    const entryVal = trade.entryPrice * units;
    const exitVal = exitPrice * units;

    const grossProfit = trade.direction === 'buy'
        ? (exitPrice - trade.entryPrice) * units
        : (trade.entryPrice - exitPrice) * units;

    const fee = (entryVal + exitVal) * feeRate;
    return {
        profit: grossProfit - fee,
        fee
    };
}


// export function calculatePositionSize({
//     capital,
//     riskPercent = 1,   // 1% risk
//     entryPrice,
//     stopLossPrice,
//     feePercent = 0.001 // 0.1%
// }) {
//     const riskAmount = (capital * riskPercent) / 100;

//     const stopDistance = Math.abs(entryPrice - stopLossPrice);

//     if (stopDistance === 0) return 0;

//     // Raw quantity
//     let qty = riskAmount / stopDistance;

//     // Adjust for fees (entry + exit)
//     const feeBuffer = 1 + feePercent * 2;
//     qty = qty / feeBuffer;

//     return qty;
// }