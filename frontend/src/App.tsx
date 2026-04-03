import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineStyle,
} from "lightweight-charts";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  BarChart3,
  Database,
  Shield,
  Zap,
  RefreshCw,
  Layers,
  Settings2,
  Play,
  PieChart,
  AlertCircle,
  Info,
  Eye,
  X,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  rangeHigh?: number;
  rangeLow?: number;
  breakoutTime?: string;
  entryTime: string;
  exitTime?: string;
  direction: "buy" | "sell";
  entryPrice: number;
  exitPrice?: number;
  profit: number;
  status: "open" | "closed";
  exitReason?: string;
  units?: number;
  sl: number;
}

interface BacktestResponse {
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

interface OptimizationResponse {
  best: {
    resolution: string;
    atrMultiplierSL: number;
    totalProfit: number;
    totalTrades: number;
    winRate: number;
    monthlyProfits: {
      year: number;
      month: number;
      profit: number;
      trades: number;
    }[];
  };
  topResults: any[];
  totalTested: number;
  periodChecked: string;
}

interface ApiResponse {
  s: string;
  data: Candle[];
}

interface Strategy {
  id: string;
  name: string;
  description: string;
}

const API_BASE_URL = "http://localhost:5001/api";

export default function App() {
  const [view, setView] = useState<"live" | "backtest">("live");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pair, setPair] = useState("B-BTC_INR");

  const [selectedStrategyId, setSelectedStrategyId] =
    useState("opening-breakout");

  // Common Backtest State
  const [initialCapital, setInitialCapital] = useState(100);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [interval, setInterval] = useState("15");
  const [liveInterval, setLiveInterval] = useState("60");
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(false);
  const [isLiveTrading, setIsLiveTrading] = useState(false);
  const [tickerPrice, setTickerPrice] = useState<number | null>(null);

  // MA Crossover Specific State
  const [shortPeriod, setShortPeriod] = useState(9);
  const [longPeriod, setLongPeriod] = useState(21);

  const [backtestResult, setBacktestResult] = useState<BacktestResponse | null>(
    null,
  );
  const [optimizationResult, setOptimizationResult] =
    useState<OptimizationResponse | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedTradeForView, setSelectedTradeForView] =
    useState<Trade | null>(null);
  const [configTab, setConfigTab] = useState<"manual" | "optimize">("manual");
  const [startYear, setStartYear] = useState(new Date().getFullYear() - 3);

  const fetchStrategies = async () => {
    try {
      const response = await axios.get<Strategy[]>(
        `${API_BASE_URL}/strategies`,
      );
      setStrategies(response.data);
      if (response.data.length > 0) {
        setSelectedStrategyId(response.data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch strategies:", err);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchMarketData = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get<ApiResponse>(
        `${API_BASE_URL}/market-data`,
        {
          params: {
            pair,
            resolution: liveInterval,
            isTest: isLiveMonitoring,
          },
        },
      );
      if (response.data.s === "ok") {
        setCandles([...response.data.data].sort((a, b) => b.time - a.time));
        setError(null);
      } else {
        setError("Market data stream returned empty or invalid status.");
      }
    } catch (err) {
      setError(
        "Connection to backend failed. Please check if the server is running.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTicker = async () => {
    try {
      const response = await axios.get<{ last_price: string }>(
        `${API_BASE_URL}/ticker`,
        {
          params: { pair: pair.replace("B-", "").replace("_", "") },
        },
      );
      const price = parseFloat(response.data.last_price);
      setTickerPrice(price);

      // Update the last candle in the list to reflect the live price
      setCandles((prev) => {
        if (prev.length === 0) return prev;
        const newCandles = [...prev];
        const last = { ...newCandles[0] };
        last.close = price;
        if (price > last.high) last.high = price;
        if (price < last.low) last.low = price;
        newCandles[0] = last;
        return newCandles;
      });
    } catch (err) {
      console.error("Ticker fetch failed:", err);
    }
  };

  const runBacktest = async () => {
    try {
      setIsBacktesting(true);
      let strategyParams: any = {};
      if (selectedStrategyId === "opening-breakout") {
        strategyParams = {};
      } else if (selectedStrategyId === "ma-crossover") {
        strategyParams = {
          shortPeriod,
          longPeriod,
        };
      }

      const response = await axios.post<BacktestResponse>(
        `${API_BASE_URL}/backtest`,
        {
          pair,
          resolution: interval,
          strategyId: selectedStrategyId,
          month: selectedMonth,
          year: selectedYear,
          capitalPerTrade: initialCapital,
          isLive: isLiveMonitoring,
          ...strategyParams,
        },
      );
      setBacktestResult(response.data);
      setView("backtest");
    } catch (err) {
      console.error(err);
    } finally {
      setIsBacktesting(false);
    }
  };

  const handleOptimize = async () => {
    try {
      setIsOptimizing(true);
      const response = await axios.post<OptimizationResponse>(
        `${API_BASE_URL}/backtest/optimize`,
        {
          pair,
          startYear,
          resolutions: ["5", "15", "30"],
          atrMultipliers: [1, 2, 3, 4, 5],
        },
      );
      setOptimizationResult(response.data);
      // If we found a best config, let's update the current settings to match it
      if (response.data.best) {
        setInterval(response.data.best.resolution);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, [pair, isLiveMonitoring]);

  // Polling for Live Monitoring
  useEffect(() => {
    let candleIntervalId: any;
    let tickerIntervalId: any;

    if (isLiveMonitoring && view === "live") {
      // Initial fetch
      fetchMarketData();
      fetchTicker();

      // Poll candles every 10 seconds (heavy call)
      candleIntervalId = window.setInterval(() => {
        fetchMarketData();

        const runLiveStrategy = async () => {
          try {
            const response = await axios.post<BacktestResponse>(
              `${API_BASE_URL}/backtest`,
              {
                pair,
                resolution: interval,
                strategyId: selectedStrategyId,
                capitalPerTrade: initialCapital,
                isLive: true,
              },
            );
            setBacktestResult(response.data);

            // If live trading is enabled, check for new trades to execute
            if (isLiveTrading && response.data.trades.length > 0) {
              const latestTrade = response.data.trades[0];
              if (latestTrade.status === "open") {
                // Execute trade on exchange
                await axios.post(`${API_BASE_URL}/trade/execute`, {
                  side: latestTrade.direction === "buy" ? "buy" : "sell",
                  pair: pair.replace("B-", "").replace("_", ""),
                  price: latestTrade.entryPrice,
                  capital: initialCapital,
                });
              }
            }
          } catch (err) {
            console.error("Live strategy update failed:", err);
          }
        };
        runLiveStrategy();
      }, 10000);

      // Poll ticker every 1 second (light call)
      tickerIntervalId = window.setInterval(() => {
        fetchTicker();
      }, 1000);
    }

    return () => {
      if (candleIntervalId) clearInterval(candleIntervalId);
      if (tickerIntervalId) clearInterval(tickerIntervalId);
    };
  }, [
    isLiveMonitoring,
    view,
    pair,
    interval,
    selectedStrategyId,
    initialCapital,
    liveInterval,
  ]);

  // Fetch data immediately when liveInterval changes
  useEffect(() => {
    if (view === "live") {
      fetchMarketData();
    }
  }, [liveInterval, view, pair]);

  const tradesByDay = useMemo(() => {
    if (!backtestResult) return {};
    return backtestResult.trades.reduce(
      (acc, trade) => {
        const day = dayjs(trade.entryTime).format("YYYY-MM-DD");
        if (!acc[day])
          acc[day] = { trades: [], profit: 0, success: 0, failure: 0 };
        acc[day].trades.push(trade);
        acc[day].profit += trade.profit;
        if (trade.profit > 0) acc[day].success++;
        else acc[day].failure++;
        return acc;
      },
      {} as Record<
        string,
        { trades: Trade[]; profit: number; success: number; failure: number }
      >,
    );
  }, [backtestResult]);

  const stats = useMemo(() => {
    if (candles.length === 0)
      return { avgPrice: 0, maxHigh: 0, minLow: 0, totalVolume: 0 };
    const totalVolume = candles.reduce((acc, c) => acc + c.volume, 0);
    const maxHigh = Math.max(...candles.map((c) => c.high));
    const minLow = Math.min(...candles.map((c) => c.low));
    const avgPrice =
      candles.reduce((acc, c) => acc + c.close, 0) / candles.length;
    return { avgPrice, maxHigh, minLow, totalVolume };
  }, [candles]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Background decoration */}
      <AnimatePresence>
        {selectedTradeForView && (
          <TradeViewModal
            trade={selectedTradeForView}
            pair={pair}
            resolution={interval}
            isLiveMonitoring={isLiveMonitoring}
            onClose={() => setSelectedTradeForView(null)}
          />
        )}
      </AnimatePresence>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <nav className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-slate-950/70 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight block">
                Resistance<span className="text-blue-400">Terminal</span>
              </span>
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] leading-none">
                Intelligence Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-white/5">
            <ViewToggle
              active={view === "live"}
              onClick={() => setView("live")}
              icon={Activity}
              label="Live Feed"
            />
            <ViewToggle
              active={view === "backtest"}
              onClick={() => setView("backtest")}
              icon={Settings2}
              label="Backtest"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/50 border border-white/5 text-xs font-bold text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              V2 NODE ACTIVE
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {view === "live" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    Real-time Data
                  </span>
                  <div className="h-px w-8 bg-slate-800" />
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">
                    Candlestick Feed
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
                  Market Pulse
                </h1>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-2xl">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLiveMonitoring}
                      onChange={(e) => setIsLiveMonitoring(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className="ml-3 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                      Live Monitoring
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-slate-900/40 p-1.5 rounded-2xl border border-white/5">
                  {[
                    "B-BTC_INR",
                    "B-ETH_INR",
                    "B-DOGE_INR",
                    "B-SHIB_INR",
                  ].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPair(p)}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                        pair === p
                          ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20"
                          : "text-slate-500 hover:text-slate-200 hover:bg-white/5",
                      )}
                    >
                      {p.includes("-")
                        ? p.split("-")[1].replace("_", "/")
                        : p.replace("_", "/")}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <StatCard
                title="Real-time Avg"
                value={`₹${stats.avgPrice.toLocaleString()}`}
                icon={Layers}
                color="text-blue-400"
                gradient="from-blue-600/10 to-transparent"
              />
              <StatCard
                title="Session High"
                value={`₹${stats.maxHigh.toLocaleString()}`}
                icon={TrendingUp}
                color="text-emerald-400"
                gradient="from-emerald-600/10 to-transparent"
              />
              <StatCard
                title="Session Low"
                value={`₹${stats.minLow.toLocaleString()}`}
                icon={TrendingDown}
                color="text-rose-400"
                gradient="from-rose-600/10 to-transparent"
              />
              <StatCard
                title="Volume Aggregate"
                value={stats.totalVolume.toFixed(2)}
                icon={Activity}
                color="text-amber-400"
                gradient="from-amber-600/10 to-transparent"
              />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between px-2 mb-2">
                  <div className="flex items-center gap-6">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" /> Live Market
                      Chart
                    </h2>
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                      {["1", "5", "15", "30", "60", "D"].map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setLiveInterval(tf)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                            liveInterval === tf
                              ? "bg-blue-600 text-white shadow-lg"
                              : "text-slate-500 hover:text-slate-300",
                          )}
                        >
                          {tf === "D" ? "1D" : tf + "M"}
                        </button>
                      ))}
                    </div>
                    {tickerPrice && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-400">
                          ₹{tickerPrice.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-600">
                    <span>
                      RES: {liveInterval === "D" ? "1D" : liveInterval + "M"}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>PAIR: {pair}</span>
                  </div>
                </div>

                <div className="mb-8">
                  <LiveMarketChart
                    candles={candles}
                    trades={backtestResult?.trades || []}
                  />
                </div>

                <div className="flex items-center justify-between px-2 mb-2">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" /> Recent
                    Candles
                  </h2>
                </div>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {loading
                      ? Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-24 w-full bg-white/5 animate-pulse rounded-3xl border border-white/5"
                        />
                      ))
                      : candles
                        .slice(0, 15)
                        .map((candle, idx) => (
                          <CandleRow
                            key={candle.time}
                            candle={candle}
                            index={idx}
                          />
                        ))}
                  </AnimatePresence>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] relative overflow-hidden group shadow-2xl shadow-blue-600/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-[80px] -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10">
                    <Shield className="w-10 h-10 text-white/40 mb-6" />
                    <h3 className="text-2xl font-black text-white mb-3 leading-tight">
                      Secure Edge
                      <br />
                      Technology
                    </h3>
                    <p className="text-blue-100/70 text-sm leading-relaxed mb-8">
                      Proprietary Node.js adapter for high-frequency market data
                      streaming.
                    </p>
                    <button className="w-full py-4 bg-white text-blue-700 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform">
                      System Status
                    </button>
                  </div>
                </div>

                <div className="p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] backdrop-blur-sm">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" /> Platform Insight
                  </h4>
                  <div className="space-y-5">
                    <InsightRow label="Engine Version" value="v4.2.1-Stable" />
                    <InsightRow label="Data Source" value="CoinDCX Pro" />
                    <InsightRow label="API Latency" value="112ms" />
                    <InsightRow label="Encryption" value="AES-256" />
                  </div>
                </div>
              </aside>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-10"
          >
            {/* Control Panel */}
            <div className="space-y-8">
              <div className="p-8 bg-slate-900/60 border border-white/10 rounded-[2.5rem] shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/20">
                    <Settings2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-black tracking-tight">
                    Configuration
                  </h2>
                </div>

                <div className="flex bg-slate-950/50 p-1 rounded-2xl border border-white/5 mb-8">
                  <button
                    onClick={() => setConfigTab("manual")}
                    className={cn(
                      "flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      configTab === "manual"
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-slate-500 hover:text-slate-300",
                    )}
                  >
                    Manual Test
                  </button>
                  <button
                    onClick={() => setConfigTab("optimize")}
                    className={cn(
                      "flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      configTab === "optimize"
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "text-slate-500 hover:text-slate-300",
                    )}
                  >
                    Auto Optimize
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Strategy Selection (Common) */}
                  <div className="flex bg-slate-950/50 p-1 rounded-2xl border border-white/5 mb-4">
                    {strategies.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedStrategyId(s.id);
                          setBacktestResult(null);
                        }}
                        className={cn(
                          "flex-1 py-2.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                          selectedStrategyId === s.id
                            ? "bg-slate-800 text-white shadow-lg"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>

                  {configTab === "manual" ? (
                    <motion.div
                      key="manual-fields"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      {!isLiveMonitoring && (
                        <div className="grid grid-cols-2 gap-4">
                          <InputGroup label="Year" sub="Target year">
                            <select
                              value={selectedYear}
                              onChange={(e) =>
                                setSelectedYear(Number(e.target.value))
                              }
                              className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                            >
                              {[2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ))}
                            </select>
                          </InputGroup>
                          <InputGroup label="Month" sub="Target month">
                            <select
                              value={selectedMonth}
                              onChange={(e) =>
                                setSelectedMonth(Number(e.target.value))
                              }
                              className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                            >
                              {[
                                "Jan",
                                "Feb",
                                "Mar",
                                "Apr",
                                "May",
                                "Jun",
                                "Jul",
                                "Aug",
                                "Sep",
                                "Oct",
                                "Nov",
                                "Dec",
                              ].map((m, i) => (
                                <option key={m} value={i}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </InputGroup>
                        </div>
                      )}

                      <InputGroup label="Interval" sub="Candle timeframe">
                        <select
                          value={interval}
                          onChange={(e) => setInterval(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                        >
                          {["1", "5", "15", "30", "60", "D"].map((i) => (
                            <option key={i} value={i}>
                              {i === "D" ? "1 Day" : i + " Min"}
                            </option>
                          ))}
                        </select>
                      </InputGroup>

                      <InputGroup label="Capital (₹)" sub="Min ₹100 (Exchange limit)">
                        <input
                          type="number"
                          min="100"
                          value={initialCapital}
                          onChange={(e) =>
                            setInitialCapital(Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                        />
                      </InputGroup>

                      {/* Strategy Specific Fields */}
                      {selectedStrategyId === "ma-crossover" && (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <InputGroup label="Short" sub="Fast MA">
                            <input
                              type="number"
                              value={shortPeriod}
                              onChange={(e) =>
                                setShortPeriod(Number(e.target.value))
                              }
                              className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                            />
                          </InputGroup>
                          <InputGroup label="Long" sub="Slow MA">
                            <input
                              type="number"
                              value={longPeriod}
                              onChange={(e) =>
                                setLongPeriod(Number(e.target.value))
                              }
                              className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                            />
                          </InputGroup>
                        </div>
                      )}

                      <div className="h-px w-full bg-white/5 my-4" />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Live Trading Mode
                            </span>
                          </div>
                          <button
                            onClick={() => setIsLiveTrading(!isLiveTrading)}
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              isLiveTrading ? "bg-emerald-600" : "bg-slate-800",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                                isLiveTrading ? "left-7" : "left-1",
                              )}
                            />
                          </button>
                        </div>

                        {isLiveTrading && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-4"
                          >
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-2">
                              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                Live Test Mode Active
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                Trading with 100 INR per position. Ensure your
                                backend .env is configured with API credentials.
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <button
                                onClick={async () => {
                                  if (!tickerPrice) return;
                                  try {
                                    const res = await axios.post(
                                      `${API_BASE_URL}/trade/execute`,
                                      {
                                        side: "buy",
                                        pair: pair
                                          .replace("B-", "")
                                          .replace("_", ""),
                                        price: tickerPrice,
                                        capital: initialCapital,
                                      },
                                    );
                                    alert(
                                      `Manual Buy Order: ${JSON.stringify(res.data)}`,
                                    );
                                  } catch (err: any) {
                                    const msg =
                                      err.response?.data?.message ||
                                      err.message;
                                    alert(`Manual Buy Failed: ${msg}`);
                                  }
                                }}
                                className="py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                              >
                                Manual Buy
                              </button>
                              <button
                                onClick={async () => {
                                  if (!tickerPrice) return;
                                  try {
                                    const res = await axios.post(
                                      `${API_BASE_URL}/trade/execute`,
                                      {
                                        side: "sell",
                                        pair: pair
                                          .replace("B-", "")
                                          .replace("_", ""),
                                        price: tickerPrice,
                                        capital: initialCapital,
                                      },
                                    );
                                    alert(
                                      `Manual Sell/Close Order: ${JSON.stringify(res.data)}`,
                                    );
                                  } catch (err: any) {
                                    const msg =
                                      err.response?.data?.message ||
                                      err.message;
                                    alert(`Manual Sell Failed: ${msg}`);
                                  }
                                }}
                                className="py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-600/20"
                              >
                                Manual Sell
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await axios.post(
                                      `${API_BASE_URL}/user/balances`,
                                    );
                                    const inrBalance = res.data.find(
                                      (b: any) => b.currency === "INR",
                                    );
                                    const dogeBalance = res.data.find(
                                      (b: any) => b.currency === "DOGE",
                                    );
                                    alert(
                                      `Balances:\nINR: ${inrBalance?.balance || 0}\nDOGE: ${dogeBalance?.balance || 0}\n\nFull Response: ${JSON.stringify(res.data)}`,
                                    );
                                  } catch (err: any) {
                                    const msg =
                                      err.response?.data?.message ||
                                      err.message;
                                    alert(`Balance Check Failed: ${msg}`);
                                  }
                                }}
                                className="col-span-2 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border border-white/5"
                              >
                                Check Balance
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      <button
                        onClick={runBacktest}
                        disabled={isBacktesting || isOptimizing}
                        className={cn(
                          "w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:bg-slate-800",
                          isLiveTrading
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                            : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20",
                        )}
                      >
                        {isBacktesting ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Play className="w-5 h-5 fill-current" />
                        )}
                        {isBacktesting
                          ? "Computing..."
                          : isLiveTrading
                            ? "Start Live Trading"
                            : "Run Simulation"}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="optimize-fields"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <InputGroup label="Start Year" sub="Optimization range">
                        <select
                          value={startYear}
                          onChange={(e) => setStartYear(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                        >
                          {[2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </InputGroup>

                      <InputGroup label="Capital ($)" sub="Initial deposit">
                        <input
                          type="number"
                          value={initialCapital}
                          onChange={(e) =>
                            setInitialCapital(Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                        />
                      </InputGroup>

                      <div className="p-6 bg-indigo-600/5 border border-indigo-500/10 rounded-3xl">
                        <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-2">
                          Optimization Scope
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          This will test multiple resolutions and ATR
                          multipliers month-by-month for 3 years starting from{" "}
                          {startYear}.
                        </p>
                      </div>

                      <button
                        onClick={handleOptimize}
                        disabled={isBacktesting || isOptimizing}
                        className="w-full py-5 rounded-[2rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:bg-slate-800"
                      >
                        {isOptimizing ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Zap className="w-5 h-5 fill-current" />
                        )}
                        {isOptimizing ? "Optimizing..." : "Find Best Config"}
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>

              {optimizationResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] space-y-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-black text-sm uppercase tracking-widest text-indigo-200">
                      Best Configuration Found
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1">
                        Resolution
                      </p>
                      <p className="text-xl font-black text-white">
                        {optimizationResult.best.resolution}M
                      </p>
                    </div>
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1">
                        ATR Mult
                      </p>
                      <p className="text-xl font-black text-white">
                        {optimizationResult.best.atrMultiplierSL}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">
                      Total 3Y Profit
                    </p>
                    <p className="text-2xl font-black text-emerald-400">
                      $
                      {optimizationResult.best.totalProfit.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 2 },
                      )}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">
                      WIN RATE: {optimizationResult.best.winRate.toFixed(1)}%
                    </p>
                  </div>
                  <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest">
                    Checked: {optimizationResult.periodChecked}
                  </p>
                </motion.div>
              )}

              <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-200 mb-1">
                    Backtesting Engine
                  </h4>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Simulated using direct historical data from CoinDCX. Results
                    may vary based on live slippage and execution latencies.
                  </p>
                </div>
              </div>
            </div>

            {/* Results Display */}
            <div className="lg:col-span-2 space-y-8">
              {!backtestResult ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] text-slate-600 p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-6">
                    <PieChart className="w-10 h-10 opacity-20" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-400 mb-2">
                    No Results Available
                  </h3>
                  <p className="max-w-xs text-sm">
                    Configure your strategy parameters on the left and run the
                    simulation to see historical performance.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <ResultCard
                      title="Total P/L"
                      value={`$${backtestResult.summary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={TrendingUp}
                      color={
                        backtestResult.summary.totalProfit >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }
                    />
                    <ResultCard
                      title="Success"
                      value={backtestResult.summary.successCount.toString()}
                      icon={Zap}
                      color="text-emerald-400"
                    />
                    <ResultCard
                      title="Failed"
                      value={backtestResult.summary.failedCount.toString()}
                      icon={AlertCircle}
                      color="text-rose-400"
                    />
                    <ResultCard
                      title="Win Rate"
                      value={`${backtestResult.summary.winRate.toFixed(1)}%`}
                      icon={RefreshCw}
                      color="text-blue-400"
                    />
                  </div>

                  <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                        Trade Execution Log
                      </h3>
                      <div className="p-2 rounded-lg bg-slate-800 text-[10px] font-bold text-slate-500">
                        {pair}
                      </div>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-950/40">
                            <th className="px-8 py-5">Time/Type</th>
                            <th className="px-5 py-5">Entry Price</th>
                            <th className="px-5 py-5">Exit Price</th>
                            <th className="px-5 py-5 text-right">Net Profit</th>
                            <th className="px-10 py-5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {Object.entries(tradesByDay)
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .map(([day, data]) => (
                              <React.Fragment key={day}>
                                {/* Daily Summary Header */}
                                <tr className="bg-slate-900/60 border-y border-white/5 group">
                                  <td colSpan={2} className="px-8 py-5">
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                        <Clock className="w-5 h-5" />
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5 leading-none">
                                          Execution Date
                                        </div>
                                        <div className="text-sm font-bold text-slate-100">
                                          {dayjs(day).format("MMM D, YYYY")}
                                        </div>
                                      </div>
                                      <div className="h-8 w-px bg-white/5 ml-4" />
                                      <div className="flex items-center gap-6 ml-4">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                          <span className="text-[9px] font-black uppercase text-slate-500">
                                            {data.success}{" "}
                                            <span className="opacity-60">
                                              Wins
                                            </span>
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                          <span className="text-[9px] font-black uppercase text-slate-500">
                                            {data.failure}{" "}
                                            <span className="opacity-60">
                                              Losses
                                            </span>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td
                                    colSpan={2}
                                    className="px-8 py-5 text-right"
                                  >
                                    <div className="inline-flex flex-col items-end">
                                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5 leading-none">
                                        Daily Performance
                                      </div>
                                      <div
                                        className={cn(
                                          "text-lg font-black tracking-tight",
                                          data.profit >= 0
                                            ? "text-emerald-400"
                                            : "text-rose-400",
                                        )}
                                      >
                                        {data.profit >= 0 ? "+" : ""}
                                        {data.profit.toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                  <td></td>
                                </tr>

                                {/* Daily Trades */}
                                {data.trades
                                  .sort(
                                    (a, b) =>
                                      dayjs(b.entryTime).valueOf() -
                                      dayjs(a.entryTime).valueOf(),
                                  )
                                  .map((trade, idx) => (
                                    <tr
                                      key={`${day}-${idx}`}
                                      className="group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0"
                                    >
                                      <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                          <div
                                            className={cn(
                                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                                              trade.direction === "buy"
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : "bg-rose-500/10 border-rose-500/20 text-rose-400",
                                            )}
                                          >
                                            {trade.direction === "buy" ? (
                                              <TrendingUp className="w-5 h-5" />
                                            ) : (
                                              <TrendingDown className="w-5 h-5" />
                                            )}
                                          </div>
                                          <div>
                                            <div className="text-sm font-bold text-white capitalize">
                                              {trade.direction} Position
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-[9px] font-black uppercase tracking-tighter">
                                              <span className="text-blue-400">
                                                {dayjs(trade.entryTime).format(
                                                  "HH:mm:ss",
                                                )}
                                              </span>
                                              <span className="text-slate-700">
                                                •
                                              </span>
                                              <span className="text-slate-500">
                                                {trade.units?.toFixed(4)} UNITS
                                              </span>
                                              {trade.exitReason && (
                                                <>
                                                  <span className="text-slate-700">
                                                    •
                                                  </span>
                                                  <span
                                                    className={cn(
                                                      "font-black",
                                                      trade.exitReason === "TP"
                                                        ? "text-emerald-500"
                                                        : trade.exitReason ===
                                                          "SL"
                                                          ? "text-rose-500"
                                                          : "text-slate-500",
                                                    )}
                                                  >
                                                    {trade.exitReason}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-5 py-6 font-mono text-xs text-slate-400">
                                        ${trade.entryPrice.toLocaleString()}
                                      </td>
                                      <td className="px-5 py-6 font-mono text-xs text-slate-400">
                                        $
                                        {trade.exitPrice?.toLocaleString() ||
                                          "---"}
                                      </td>
                                      <td
                                        className={cn(
                                          "px-5 py-6 text-right font-black text-sm",
                                          trade.profit > 0
                                            ? "text-emerald-400"
                                            : "text-rose-400",
                                        )}
                                      >
                                        {trade.profit > 0 ? "+" : ""}
                                        {trade.profit.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          },
                                        )}
                                      </td>
                                      <td className="px-10 py-6 text-center">
                                        <button
                                          onClick={() =>
                                            setSelectedTradeForView(trade)
                                          }
                                          className="p-3 rounded-xl bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 border border-white/5 transition-all shadow-lg active:scale-95"
                                          title="View on Chart"
                                        >
                                          <Eye className="w-5 h-5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                              </React.Fragment>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {isLiveTrading &&
                backtestResult &&
                backtestResult.trades.filter((t) => t.status === "open")
                  .length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 bg-emerald-600/10 border border-emerald-500/20 rounded-[2.5rem] space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20">
                          <Activity className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-black tracking-tight">
                          Live Active Trades
                        </h3>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
                        Live Execution Active
                      </div>
                    </div>

                    <div className="space-y-4">
                      {backtestResult.trades
                        .filter((t) => t.status === "open")
                        .map((trade, i) => (
                          <div
                            key={i}
                            className="p-6 bg-slate-950/50 rounded-3xl border border-white/5 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs",
                                  trade.direction === "buy"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-rose-500/20 text-rose-400",
                                )}
                              >
                                {trade.direction === "buy" ? "LONG" : "SHORT"}
                              </div>
                              <div>
                                <p className="text-sm font-black text-white">
                                  {pair.split("-")[1]} @ $
                                  {trade.entryPrice.toLocaleString()}
                                </p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">
                                  SL: ${trade.sl.toLocaleString()} | TRAILING
                                  ACTIVE
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-lg font-black",
                                  trade.profit >= 0
                                    ? "text-emerald-400"
                                    : "text-rose-400",
                                )}
                              >
                                {trade.profit >= 0 ? "+" : ""}$
                                {trade.profit.toFixed(2)}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                LIVE P/L
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
            </div>
          </motion.div>
        )}
      </main>

      <footer className="mt-20 border-t border-white/5 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 h-12 flex flex-col md:flex-row items-center justify-between text-slate-600 text-[10px] font-black uppercase tracking-widest leading-none">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-4 h-4 opacity-30" />
            <span>&copy; 2026 Resistance Intelligence Terminal</span>
          </div>
          <div className="flex items-center gap-10">
            <a href="#" className="hover:text-blue-400 transition-colors">
              Documentation
            </a>
            <a href="#" className="hover:text-blue-400 transition-colors">
              Risk Protocol
            </a>
            <a href="#" className="hover:text-blue-400 transition-colors">
              Network Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LiveMarketChart({
  candles,
  trades,
}: {
  candles: Candle[];
  trades: Trade[];
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.03)" },
        horzLines: { color: "rgba(255, 255, 255, 0.03)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const istOffset = 5.5 * 60 * 60;
    const sortedData = [...candles]
      .sort((a, b) => a.time - b.time)
      .map((c) => ({
        time: (Math.floor(c.time / 1000) + istOffset) as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

    // Use update for the latest candle if it's the same time period
    // This makes the chart move like a real trading app
    if (sortedData.length > 0) {
      candleSeriesRef.current.setData(sortedData);
    }

    // Add markers for trades
    const markers: any[] = [];
    trades.forEach((trade) => {
      const entryTime =
        Math.floor(dayjs(trade.entryTime).valueOf() / 1000) + istOffset;
      markers.push({
        time: entryTime,
        position: trade.direction === "buy" ? "belowBar" : "aboveBar",
        color: trade.direction === "buy" ? "#10b981" : "#ef4444",
        shape: trade.direction === "buy" ? "arrowUp" : "arrowDown",
        text: `${trade.direction.toUpperCase()} @ ${trade.entryPrice.toFixed(2)}`,
      });

      if (trade.exitTime) {
        const exitTime =
          Math.floor(dayjs(trade.exitTime).valueOf() / 1000) + istOffset;
        markers.push({
          time: exitTime,
          position: trade.direction === "buy" ? "aboveBar" : "belowBar",
          color: "#94a3b8",
          shape: trade.direction === "buy" ? "arrowDown" : "arrowUp",
          text: `EXIT @ ${trade.exitPrice?.toFixed(2)}`,
        });
      }
    });

    if (
      candleSeriesRef.current &&
      typeof candleSeriesRef.current.setMarkers === "function"
    ) {
      candleSeriesRef.current.setMarkers(markers);
    }
  }, [candles, trades]);

  return (
    <div className="p-6 bg-slate-900/40 border border-white/5 rounded-[2.5rem] backdrop-blur-sm overflow-hidden">
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}

function TradeViewModal({
  trade,
  pair,
  resolution,
  isLiveMonitoring,
  onClose,
}: {
  trade: Trade;
  pair: string;
  resolution: string;
  isLiveMonitoring: boolean;
  onClose: () => void;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let chart: any;

    const fetchTradeData = async () => {
      try {
        setLoading(true);
        const resInMin = resolution === "D" ? 1440 : parseInt(resolution);
        const paddingBefore = 40 * resInMin * 60;
        const paddingAfter = 20 * resInMin * 60;

        // Use breakoutTime if available, else entryTime. Ensure we don't have NaN.
        const refTimeStr = trade.breakoutTime || trade.entryTime;
        const refTimeUnix = dayjs(refTimeStr).isValid()
          ? Math.floor(dayjs(refTimeStr).valueOf() / 1000)
          : Math.floor(Date.now() / 1000);

        const startUnix = refTimeUnix - paddingBefore;
        const endUnix =
          trade.exitTime && dayjs(trade.exitTime).isValid()
            ? Math.floor(dayjs(trade.exitTime).valueOf() / 1000) + paddingAfter
            : Math.floor(Date.now() / 1000);

        const response = await axios.get<ApiResponse>(
          `${API_BASE_URL}/market-data`,
          {
            params: {
              pair,
              resolution,
              from: startUnix,
              to: endUnix,
              isTest: isLiveMonitoring,
            },
          },
        );
        console.log(
          `[Modal] Received ${response.data.data?.length || 0} candles`,
        );

        if (!isMounted || !chartContainerRef.current) return;

        // Clean up any lingering charts to prevent duplicates
        chartContainerRef.current.innerHTML = "";

        chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#94a3b8",
          },
          grid: {
            vertLines: { color: "rgba(255, 255, 255, 0.03)" },
            horzLines: { color: "rgba(255, 255, 255, 0.03)" },
          },
          width: chartContainerRef.current.clientWidth || 900,
          height: 450,
          timeScale: {
            borderColor: "rgba(255, 255, 255, 0.1)",
            timeVisible: true,
          },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#10b981",
          downColor: "#ef4444",
          borderVisible: false,
          wickUpColor: "#10b981",
          wickDownColor: "#ef4444",
        });

        const entryT = dayjs(trade.entryTime).valueOf();
        const exitT = trade.exitTime ? dayjs(trade.exitTime).valueOf() : null;
        const istOffset = 5.5 * 60 * 60; // 5 hours 30 mins in seconds

        const sortedData = [...response.data.data]
          .sort((a, b) => a.time - b.time)
          .map((c) => {
            const isEntry = Math.abs(c.time - entryT) < 1000;
            const isExit = exitT && Math.abs(c.time - exitT) < 1000;

            return {
              time: (Math.floor(c.time / 1000) + istOffset) as any,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              color: isEntry ? "#a78bfa" : isExit ? "#f472b6" : undefined,
              wickColor: isEntry ? "#a78bfa" : isExit ? "#f472b6" : undefined,
            };
          });

        candleSeries.setData(sortedData);

        // Add Horizontal Lines for Range, Entry, and Exit
        if (trade.rangeHigh) {
          candleSeries.createPriceLine({
            price: trade.rangeHigh,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "Range High",
          });
        }
        if (trade.rangeLow) {
          candleSeries.createPriceLine({
            price: trade.rangeLow,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "Range Low",
          });
        }

        candleSeries.createPriceLine({
          price: trade.entryPrice,
          color: trade.direction === "buy" ? "#10b981" : "#ef4444",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "Entry",
        });

        if (trade.exitPrice) {
          candleSeries.createPriceLine({
            price: trade.exitPrice,
            color: "#94a3b8",
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "Exit",
          });
        }

        const markers: any[] = [];
        markers.push({
          time: Math.floor(dayjs(trade.entryTime).valueOf() / 1000) + istOffset,
          position: trade.direction === "buy" ? "belowBar" : "aboveBar",
          color: "#a78bfa",
          shape: trade.direction === "buy" ? "arrowUp" : "arrowDown",
          text: `ENTER`,
        });

        if (trade.exitTime) {
          markers.push({
            time:
              Math.floor(dayjs(trade.exitTime).valueOf() / 1000) + istOffset,
            position: trade.direction === "buy" ? "aboveBar" : "belowBar",
            color: "#f472b6",
            shape: trade.direction === "buy" ? "arrowDown" : "arrowUp",
            text: `EXIT`,
          });
        }

        candleSeries.setMarkers(markers);
        chart.timeScale().fitContent();
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchTradeData();
    return () => {
      isMounted = false;
      if (chart) chart.remove();
    };
  }, [trade, pair, resolution, isLiveMonitoring]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-950/90 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 30 }}
        className="w-full max-w-6xl bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden relative"
      >
        <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-6">
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center border shadow-2xl",
                trade.direction === "buy"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400",
              )}
            >
              {trade.direction === "buy" ? (
                <TrendingUp className="w-8 h-8" />
              ) : (
                <TrendingDown className="w-8 h-8" />
              )}
            </div>
            <div>
              <h3 className="font-black text-2xl tracking-tighter uppercase">
                {trade.direction === "buy" ? "Long" : "Short"} Execution
                Analysis
              </h3>
              <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mt-1">
                {pair} • {resolution}M Resolution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 transition-all active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <ModalStat
              label="Entry"
              value={`$${trade.entryPrice.toLocaleString()}`}
            />
            <ModalStat
              label="Exit"
              value={
                trade.exitPrice ? `$${trade.exitPrice.toLocaleString()}` : "---"
              }
            />
            <ModalStat
              label="Net Profit"
              value={`$${trade.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              color={trade.profit > 0 ? "text-emerald-400" : "text-rose-400"}
            />
            <ModalStat
              label="Timeline"
              value={`${dayjs(trade.entryTime).format("MMM D, HH:mm")} — ${trade.exitTime ? dayjs(trade.exitTime).format("HH:mm") : "Active"}`}
            />
          </div>

          <div className="relative bg-slate-950/50 rounded-[2.5rem] border border-white/5 overflow-hidden min-h-[450px]">
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md">
                <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Rendering Simulation...
                </span>
              </div>
            )}
            <div ref={chartContainerRef} className="w-full" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalStat({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="p-6 bg-slate-950/40 border border-white/5 rounded-3xl group hover:border-white/10 transition-colors">
      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">
        {label}
      </p>
      <p className={cn("text-xl font-black tracking-tight", color)}>{value}</p>
    </div>
  );
}

function CandleRow({ candle, index }: { candle: Candle; index: number }) {
  const isGreen = candle.close >= candle.open;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="p-6 bg-slate-900/40 border border-white/5 rounded-[2rem] hover:bg-white/[0.03] transition-all group overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
        <Zap
          className={cn(
            "w-16 h-16",
            isGreen ? "text-emerald-400" : "text-rose-400",
          )}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-5">
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border rotate-3 group-hover:rotate-0 transition-transform shadow-lg",
              isGreen
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400",
            )}
          >
            {isGreen ? (
              <TrendingUp className="w-6 h-6" />
            ) : (
              <TrendingDown className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-black text-xl leading-none">
                ${candle.close.toLocaleString()}
              </h3>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tighter uppercase",
                  isGreen
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400",
                )}
              >
                {(
                  (Math.abs(candle.close - candle.open) / candle.open) *
                  100
                ).toFixed(2)}
                %
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />{" "}
                {new Date(candle.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-slate-800">|</span>
              <span>VOL {candle.volume.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 md:border-l border-white/5">
          <OHItem label="O" val={candle.open} />
          <OHItem label="H" val={candle.high} />
          <OHItem label="L" val={candle.low} />
          <OHItem label="C" val={candle.close} />
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  gradient,
}: {
  title: string;
  value: string;
  icon: any;
  color: string;
  gradient: string;
}) {
  return (
    <div className="p-8 bg-slate-900/50 border border-white/5 rounded-[2.5rem] relative overflow-hidden group shadow-sm hover:border-white/10 transition-all">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none",
          gradient,
        )}
      />
      <div className="relative z-10 flex flex-col gap-5">
        <div
          className={cn(
            "p-3 rounded-2xl bg-slate-950/80 w-fit shrink-0 border border-white/5 shadow-inner",
            color,
          )}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">
            {title}
          </p>
          <p className="text-3xl font-black text-white tracking-tighter group-hover:scale-[1.02] origin-left transition-transform">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="p-8 bg-slate-900/40 border border-white/10 rounded-[2.5rem] flex flex-col items-center text-center group">
      <div
        className={cn(
          "p-4 rounded-full bg-slate-950 mb-4 border border-white/5 group-hover:scale-110 transition-transform",
          color,
        )}
      >
        <Icon className="w-8 h-8" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">
        {title}
      </p>
      <p className={cn("text-4xl font-black tracking-tighter", color)}>
        {value}
      </p>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all",
        active
          ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20"
          : "text-slate-500 hover:text-slate-300",
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function InputGroup({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-black text-slate-200 block mb-0.5">
          {label}
        </label>
        <span className="text-[10px] font-bold text-slate-600 lowercase block">
          {sub}
        </span>
      </div>
      {children}
    </div>
  );
}

function OHItem({ label, val }: { label: string; val: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-black text-slate-700 uppercase mb-0.5">
        {label}
      </span>
      <span className="text-xs font-mono font-bold text-slate-300">
        ${val.toLocaleString()}
      </span>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.02] last:border-0">
      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
        {label}
      </span>
      <span className="text-xs font-black text-slate-300">{value}</span>
    </div>
  );
}
