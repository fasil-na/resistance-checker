import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import axios from "axios";
import dayjs from "dayjs";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  AreaSeries,
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
  Settings2,
  Play,
  PieChart,
  AlertCircle,
  Eye,
  X,
  Volume2,
  VolumeX,
  FlaskConical,
  Filter,
  Trophy,
  ChevronUp,
  ChevronDown,
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
  tp?: number;
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
    finalBalance: number;
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
const SOCKET_URL = "http://localhost:5001";
const socket = io(SOCKET_URL, { autoConnect: false });

function PaperTradeHistoryView() {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE_URL}/paper-trades`);
      setTrades(data);
    } catch (err) {
      console.error("Failed to fetch paper trades", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white">Paper Trade History</h2>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
            Simulated Executions Log
          </p>
        </div>
        <button onClick={fetchTrades} className="px-5 py-3 rounded-xl bg-slate-900 border border-white/5 hover:bg-slate-800 transition active:scale-95 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Reload
        </button>
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] overflow-hidden">
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
            Recorded Trades List ({trades.length})
          </h3>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {trades.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
              No Paper Trades Recorded Yet
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-950/40">
                  <th className="px-8 py-5">Date / Time</th>
                  <th className="px-5 py-5">Pair</th>
                  <th className="px-5 py-5">Type / Price</th>
                  <th className="px-5 py-5 text-right">Profit</th>
                  <th className="px-10 py-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...trades].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()).map(t => (
                  <tr key={t.id || t.recordedAt} className="bg-slate-900/20 hover:bg-slate-800/40 transition-colors">
                    <td className="px-8 py-4">
                      <div className="text-sm font-bold text-white">{dayjs(t.recordedAt).format("MMM D, YYYY")}</div>
                      <div className="text-[10px] text-slate-500">{dayjs(t.recordedAt).format("HH:mm:ss")}</div>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-300">{t.pair}</td>
                    <td className="px-5 py-4">
                      <div className={cn("text-xs font-black uppercase", t.direction === 'buy' ? 'text-emerald-400' : 'text-rose-400')}>{t.direction}</div>
                      <div className="text-[10px] text-slate-400">${t.entryPrice?.toFixed(2)}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={cn("text-sm font-black", t.profit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {t.profit >= 0 ? '+' : ''}{t.profit?.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-10 py-4 text-center">
                      <span className={cn("px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest", t.status === 'open' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-800 text-slate-400 border border-white/5')}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [view, setView] = useState<"backtest" | "trade" | "strategy-builder" | "paper-history">(
    "trade",
  );
  const [candles, setCandles] = useState<Candle[]>([]);
  const [pair, setPair] = useState(
    () => localStorage.getItem("trade_pair") || "B-BTC_USDT",
  );
  const [selectedStrategyId, setSelectedStrategyId] = useState(
    () => localStorage.getItem("trade_strategy") || "opening-breakout",
  );
  const [initialCapital, setInitialCapital] = useState(
    () => Number(localStorage.getItem("trade_capital")) || 5,
  );
  const [liveInterval, setLiveInterval] = useState(
    () => localStorage.getItem("trade_interval") || "60",
  );
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(
    () => localStorage.getItem("trade_live_monitor") === "true"
  );
  const [isLiveTrading, setIsLiveTrading] = useState(
    () => localStorage.getItem("trade_live_trading") === "true"
  );
  const [isPaperTrading, setIsPaperTrading] = useState(
    () => localStorage.getItem("trade_paper_trading") === "true"
  );
  const [tickerPrice, setTickerPrice] = useState<number | null>(null);

  // Common Backtest State (Restored)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [interval, setInterval] = useState("15");
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [isBankruptcy, setIsBankruptcy] = useState(false);
  const [dynamicMaxLeverage, setDynamicMaxLeverage] = useState<number | null>(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem("trade_pair", pair);
  }, [pair]);
  useEffect(() => {
    localStorage.setItem("trade_strategy", selectedStrategyId);
  }, [selectedStrategyId]);
  useEffect(() => {
    localStorage.setItem("trade_capital", initialCapital.toString());
  }, [initialCapital]);
  useEffect(() => {
    localStorage.setItem("trade_interval", liveInterval);
  }, [liveInterval]);
  useEffect(() => {
    localStorage.setItem("trade_live_monitor", isLiveMonitoring.toString());
  }, [isLiveMonitoring]);
  useEffect(() => {
    localStorage.setItem("trade_live_trading", isLiveTrading.toString());
  }, [isLiveTrading]);
  useEffect(() => {
    localStorage.setItem("trade_paper_trading", isPaperTrading.toString());
  }, [isPaperTrading]);

  // Lot Sizing State
  const [maxPositionSize, setMaxPositionSize] = useState(100);
  const [leverage, setLeverage] = useState(0);
  const [trailingSL, setTrailingSL] = useState(true);

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
  const [selectedTradeForChart, setSelectedTradeForChart] =
    useState<Trade | null>(null);
  const [configTab, setConfigTab] = useState<"manual" | "optimize">("manual");
  const [startYear, setStartYear] = useState(new Date().getFullYear() - 3);
  const [isSilent, setIsSilent] = useState(false);

  // ── Strategy Builder State ──
  const [sbMonth, setSbMonth] = useState(new Date().getMonth());
  const [sbYear, setSbYear] = useState(new Date().getFullYear());
  const [sbInterval, setSbInterval] = useState("15");
  const [sbPerTradeAmount, setSbPerTradeAmount] = useState(100);
  const [sbLeverage, setSbLeverage] = useState(0);
  const [sbUseTrailingSL, setSbUseTrailingSL] = useState(true);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbResult, setSbResult] = useState<any | null>(null);
  const [sbError, setSbError] = useState<string | null>(null);
  const [sbSortKey, setSbSortKey] = useState<string>("totalPL");
  const [sbSortDir, setSbSortDir] = useState<"asc" | "desc">("desc");

  const runStrategyBuilder = async () => {
    try {
      setSbLoading(true);
      setSbError(null);
      setSbResult(null);
      const response = await axios.post(`${API_BASE_URL}/strategy-builder`, {
        pair,
        month: sbMonth,
        year: sbYear,
        resolution: sbInterval,
        perTradeAmount: sbPerTradeAmount,
        leverage: sbLeverage,
        useTrailingSL: sbUseTrailingSL,
      });
      setSbResult(response.data);
    } catch (err: any) {
      setSbError(err.response?.data?.error || err.message || "Failed");
    } finally {
      setSbLoading(false);
    }
  };

  const sbSorted = useMemo(() => {
    if (!sbResult?.results) return [];
    return [...sbResult.results].sort((a: any, b: any) => {
      const va = a[sbSortKey] ?? a.config?.[sbSortKey] ?? 0;
      const vb = b[sbSortKey] ?? b.config?.[sbSortKey] ?? 0;
      return sbSortDir === "desc" ? vb - va : va - vb;
    });
  }, [sbResult, sbSortKey, sbSortDir]);

  const handleSbSort = (key: string) => {
    if (sbSortKey === key) setSbSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSbSortKey(key);
      setSbSortDir("desc");
    }
  };

  // Audio Alert
  const playAlert = useCallback(() => {
    if (isSilent) return;
    const audio = new Audio("/cash_register.mp3");
    audio.play().catch((err) => console.error("Audio playback failed:", err));
  }, [isSilent]);

  const lastAlertedTradeRef = useRef<string | null>(null);

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
      }
    } catch (err) {
      console.error("fetchMarketData failed:", err);
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

  const fetchDynamicLeverage = async () => {
    try {
      const response = await axios.get<{ leverage: number }>(
        `${API_BASE_URL}/leverage/${pair}`,
      );
      setDynamicMaxLeverage(response.data.leverage);
    } catch (err) {
      console.error("Leverage fetch failed:", err);
      setDynamicMaxLeverage(null);
    }
  };

  const runBacktest = async () => {
    try {
      setIsBacktesting(true);
      let strategyParams: any = {};
      if (selectedStrategyId === "opening-breakout") {
        strategyParams = {};
      }

      const response = await axios.post<BacktestResponse>(
        `${API_BASE_URL}/backtest`,
        {
          pair,
          resolution: interval,
          strategyId: selectedStrategyId,
          month: selectedMonth,
          year: selectedYear,
          capital: initialCapital,
          maxPositionSize,
          leverage,
          trailingSL,
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
          capital: initialCapital,
          maxPositionSize,
          leverage,
          trailingSL,
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
    fetchDynamicLeverage();
  }, [pair, isLiveMonitoring]);

  // Polling for Live Monitoring
  useEffect(() => {
    let candleIntervalId: any;
    let tickerIntervalId: any;

    if (isLiveMonitoring && view === "trade") {
      // Initial fetch
      fetchMarketData();
      fetchTicker();

      // Setup WebSocket Link
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit("subscribe", pair);

      const handlePriceChange = (data: any) => {
        const rawPrice = data.p || data.price || data.last_price;
        if (rawPrice && (!data.m || data.m === pair)) {
          const price = parseFloat(rawPrice);
          setTickerPrice(price);
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
        }
      };

      socket.on("price-change", handlePriceChange);
      socket.on("candlestick", (data) => {
        // Candlestick websocket updates
        // For now ticker price pushes live chart nicely
      });

      // Fetch live balance for compounding/bankruptcy
      const fetchInitialBalance = async () => {
        try {
          const res = await axios.post(`${API_BASE_URL}/user/balances`);
          const inrBalance = res.data.find((b: any) => b.currency === "INR");
          if (inrBalance) {
            setLiveBalance(parseFloat(inrBalance.balance));
            if (parseFloat(inrBalance.balance) <= 0) setIsBankruptcy(true);
          }
        } catch (err) {
          console.error("fetchInitialBalance failed:", err);
        }
      };
      fetchInitialBalance();

      // Poll candles every 10 seconds (heavy call)
      candleIntervalId = window.setInterval(() => {
        fetchMarketData();

        const runLiveStrategy = async () => {
          if (isBankruptcy) return; // BANKRUPTCY CHECK

          try {
            const response = await axios.post<BacktestResponse>(
              `${API_BASE_URL}/backtest`,
              {
                pair,
                resolution: liveInterval,
                strategyId: selectedStrategyId,
                capitalPerTrade: (liveBalance !== null) ? liveBalance : initialCapital, // COMPOUNDING
                isLive: true,
              },
            );
            setBacktestResult(response.data);

            // Check for new trades to alert/execute
            if (response.data.trades.length > 0) {
              const latestTrade = response.data.trades[0];
              if (latestTrade.status === "open") {
                const tradeId = `${latestTrade.entryTime}-${latestTrade.direction}`;
                if (lastAlertedTradeRef.current !== tradeId) {
                  // Play sound if this isn't the very first detection after refresh
                  if (lastAlertedTradeRef.current !== null) {
                    playAlert();
                  }
                  lastAlertedTradeRef.current = tradeId;

                  // Paper Trading Execution
                  if (isPaperTrading) {
                    axios.post(`${API_BASE_URL}/paper-trade`, {
                      trade: latestTrade,
                      pair: pair
                    }).catch(err => console.error("Paper trade record failed:", err));
                  }

                  // ONLY execute on exchange if Auto-Trade is ON
                  if (isLiveTrading) {
                    // BEFORE Execution - check bankruptcy again
                    if (((liveBalance !== null ? liveBalance : initialCapital)) <= 0) {
                      setIsBankruptcy(true);
                      alert("TERMINATED: Live strategy stopped due to zero/negative balance.");
                      return;
                    }

                    await axios.post(`${API_BASE_URL}/trade/execute`, {
                      side: latestTrade.direction === "buy" ? "buy" : "sell",
                      pair: pair.replace("B-", "").replace("_", ""),
                      price: latestTrade.entryPrice,
                      capital: liveBalance !== null ? liveBalance : initialCapital, // COMPOUNDING
                    });

                    // After execution, refresh balance
                    fetchInitialBalance();
                  }
                }
              }
            }
          } catch (err) {
            console.error("Live strategy update failed:", err);
          }
        };
        runLiveStrategy();
      }, 60000);

      // Poll ticker every 1 second (light call)
      tickerIntervalId = window.setInterval(() => {
        fetchTicker();
      }, 5000);
    }

    return () => {
      socket.off("price-change");
      socket.off("candlestick");
      socket.disconnect();
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
    isPaperTrading,
  ]);

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

      <nav className="relative  border-b border-white/5 backdrop-blur-xl bg-slate-950/70 sticky top-0 z-100">
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
              active={view === "trade"}
              onClick={() => setView("trade")}
              icon={Zap}
              label="Live Trade"
            />
            <ViewToggle
              active={view === "backtest"}
              onClick={() => setView("backtest")}
              icon={Settings2}
              label="Backtest"
            />
            <ViewToggle
              active={view === "strategy-builder"}
              onClick={() => setView("strategy-builder")}
              icon={FlaskConical}
              label="Strategy Builder"
            />
            <ViewToggle
              active={view === "paper-history"}
              onClick={() => setView("paper-history")}
              icon={Database}
              label="Paper History"
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
        {/* Main Views */}
        {view === "backtest" && (
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

                      <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Capital ($)" sub="Total balance">
                          <input
                            type="number"
                            value={initialCapital}
                            onChange={(e) =>
                              setInitialCapital(Number(e.target.value))
                            }
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                          />
                        </InputGroup>
                        <InputGroup label="Pos Size %" sub="Of capital">
                          <input
                            type="number"
                            value={maxPositionSize}
                            onChange={(e) =>
                              setMaxPositionSize(Number(e.target.value))
                            }
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                          />
                        </InputGroup>
                        <InputGroup
                          label="Leverage"
                          sub={dynamicMaxLeverage ? `Max: ${dynamicMaxLeverage}x (Enter 0 for Max)` : "0 = Dynamic Max"}
                        >
                          <input
                            type="number"
                            value={leverage}
                            onChange={(e) =>
                              setLeverage(Number(e.target.value))
                            }
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                          />
                        </InputGroup>
                      </div>

                      <div className="flex items-center justify-between px-2 py-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Trailing Stop Loss
                          </span>
                        </div>
                        <button
                          onClick={() => setTrailingSL(!trailingSL)}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            trailingSL ? "bg-blue-600" : "bg-slate-800",
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                              trailingSL ? "left-7" : "left-1",
                            )}
                          />
                        </button>
                      </div>

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

                      <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Capital ($)" sub="Total balance">
                          <input
                            type="number"
                            value={initialCapital}
                            onChange={(e) =>
                              setInitialCapital(Number(e.target.value))
                            }
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                          />
                        </InputGroup>
                        <InputGroup label="Pos Size %" sub="Of capital">
                          <input
                            type="number"
                            value={maxPositionSize}
                            onChange={(e) =>
                              setMaxPositionSize(Number(e.target.value))
                            }
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                          />
                        </InputGroup>
                        <InputGroup
                          label="Leverage"
                          sub={dynamicMaxLeverage ? `Max: ${dynamicMaxLeverage}x (Enter 0 for Max)` : "0 = Dynamic Max"}
                        >
                          <input
                            type="number"
                            value={leverage}
                            onChange={(e) =>
                              setLeverage(Number(e.target.value))
                            }
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                          />
                        </InputGroup>
                      </div>

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
                      title="Final Balance"
                      value={`$${backtestResult.summary.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={Database}
                      color={
                        backtestResult.summary.finalBalance >= backtestResult.summary.initialCapital
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }
                    />
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

        {view === "strategy-builder" && (
          <StrategyBuilderView
            sbMonth={sbMonth}
            setSbMonth={setSbMonth}
            sbYear={sbYear}
            setSbYear={setSbYear}
            sbInterval={sbInterval}
            setSbInterval={setSbInterval}
            sbPerTradeAmount={sbPerTradeAmount}
            setSbPerTradeAmount={setSbPerTradeAmount}
            sbLeverage={sbLeverage}
            setSbLeverage={setSbLeverage}
            sbUseTrailingSL={sbUseTrailingSL}
            setSbUseTrailingSL={setSbUseTrailingSL}
            sbLoading={sbLoading}
            sbResult={sbResult}
            sbError={sbError}
            sbSorted={sbSorted}
            sbSortKey={sbSortKey}
            sbSortDir={sbSortDir}
            handleSbSort={handleSbSort}
            runStrategyBuilder={runStrategyBuilder}
            dynamicMaxLeverage={dynamicMaxLeverage}
          />
        )}

        {view === "trade" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-10"
          >
            {/* Terminal Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    Execution Terminal
                  </span>
                  <div className="h-px w-8 bg-slate-800" />
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">
                    Live Strategy Engine
                  </span>
                  {isBankruptcy && (
                    <span className="ml-4 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] font-black text-rose-400 uppercase tracking-widest animate-bounce">
                      BANKRUPTCY TRIPPED
                    </span>
                  )}
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-br from-white via-slate-200 to-emerald-500 bg-clip-text text-transparent">
                  Live Trade Console
                </h1>
              </div>

              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3 bg-slate-900/40 p-1.5 rounded-2xl border border-white/5">
                  {[
                    "B-BTC_USDT",
                    "B-ETH_USDT",
                    "B-DOGE_USDT",
                    "B-SHIB_USDT",
                    "B-XAU_USDT",
                  ].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPair(p)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
                        pair === p
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                          : "text-slate-500 hover:text-slate-200 hover:bg-white/5",
                      )}
                    >
                      {p.split("-")[1].replace("_", "/")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6">
                {liveBalance !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-black text-blue-400 font-mono">
                      {liveBalance.toLocaleString()} INR
                    </span>
                  </div>
                )}
                {tickerPrice && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      ${tickerPrice.toLocaleString()}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setIsSilent(!isSilent)}
                  className={cn(
                    "p-3 rounded-2xl border transition-all active:scale-95",
                    isSilent
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      : "bg-blue-500/10 border-blue-500/20 text-blue-400",
                  )}
                >
                  {isSilent ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Main Terminal Body */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Left Sidebar: Controls & Status */}
              <aside className="lg:col-span-1 space-y-6">
                {/* Strategy Control */}
                <div className="p-8 bg-slate-900/60 border border-white/10 rounded-[2.5rem] shadow-2xl space-y-8">
                  <section>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-emerald-500" />{" "}
                      Strategy Configuration
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Live Monitor
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isLiveMonitoring}
                            onChange={(e) =>
                              setIsLiveMonitoring(e.target.checked)
                            }
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                        </label>
                      </div>
                      {isLiveMonitoring && (
                        <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Paper Trade
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isPaperTrading}
                              onChange={(e) => setIsPaperTrading(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-checked:bg-indigo-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                          </label>
                        </div>
                      )}
                      <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Auto-Trade
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isLiveTrading}
                            onChange={(e) => setIsLiveTrading(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                        </label>
                      </div>

                      <InputGroup label="Select Strategy" sub="Active logic">
                        <select
                          value={selectedStrategyId}
                          onChange={(e) =>
                            setSelectedStrategyId(e.target.value)
                          }
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                        >
                          {strategies.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </InputGroup>

                      <InputGroup label="Time Interval" sub="Candle timeframe">
                        <div className="grid grid-cols-3 gap-2">
                          {["1", "5", "15", "30", "60", "D"].map((tf) => (
                            <button
                              key={tf}
                              onClick={() => setLiveInterval(tf)}
                              className={cn(
                                "py-3 rounded-xl text-[10px] font-black uppercase transition-all border",
                                liveInterval === tf
                                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                                  : "bg-slate-950 border-white/5 text-slate-500 hover:text-slate-300",
                              )}
                            >
                              {tf === "D" ? "1D" : tf + "M"}
                            </button>
                          ))}
                        </div>
                      </InputGroup>

                      <InputGroup
                        label="Per Trade Capital ($)"
                        sub="Position size"
                      >
                        <input
                          type="number"
                          value={initialCapital}
                          onChange={(e) =>
                            setInitialCapital(Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                        />
                      </InputGroup>
                    </div>
                  </section>
                </div>

                <div className="p-8 bg-slate-900/60 border border-white/10 rounded-[2.5rem] shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-500" /> Activity
                      Log
                    </h3>
                    {backtestResult && (
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-500 uppercase">
                            Win/Loss
                          </p>
                          <p className="text-[10px] font-bold text-white">
                            <span className="text-emerald-400">
                              {
                                backtestResult.trades.filter(
                                  (t) => t.profit > 0,
                                ).length
                              }
                            </span>
                            <span className="text-slate-600 mx-1">/</span>
                            <span className="text-rose-400">
                              {
                                backtestResult.trades.filter(
                                  (t) => t.profit < 0,
                                ).length
                              }
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-500 uppercase">
                            Total P/L
                          </p>
                          <p
                            className={cn(
                              "text-[10px] font-bold",
                              backtestResult.summary.totalProfit >= 0
                                ? "text-emerald-400"
                                : "text-rose-400",
                            )}
                          >
                            ${backtestResult.summary.totalProfit.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-500 uppercase">
                            Final Balance
                          </p>
                          <p className="text-[10px] font-bold text-white">
                            ${backtestResult.summary.finalBalance.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                    {[...(backtestResult?.trades || [])]
                      .sort(
                        (a, b) =>
                          dayjs(b.entryTime).valueOf() -
                          dayjs(a.entryTime).valueOf(),
                      )
                      .slice(0, 15)
                      .map((trade, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedTradeForChart(trade)}
                          className={cn(
                            "flex items-center justify-between text-[10px] font-mono py-2 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 px-2 rounded-lg transition-colors",
                            selectedTradeForChart === trade &&
                            "bg-blue-500/10 border-blue-500/20",
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="text-slate-500 text-[8px]">
                              {dayjs(trade.entryTime).format("HH:mm:ss")}
                            </span>
                            <span
                              className={cn(
                                "font-black",
                                trade.direction === "buy"
                                  ? "text-emerald-500"
                                  : "text-rose-500",
                              )}
                            >
                              {trade.direction.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-300 block">
                              ${trade.entryPrice.toFixed(0)}
                            </span>
                            <span
                              className={cn(
                                "font-black",
                                trade.profit >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400",
                              )}
                            >
                              {trade.profit >= 0 ? "+" : ""}
                              {trade.profit.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </aside>

              {/* Center: Main Chart & Active Trade */}
              <div className="lg:col-span-3 space-y-8">
                <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500" /> Live
                      Market Chart
                    </h2>
                    <div className="px-4 py-1.5 rounded-xl bg-slate-950/50 border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {pair} •{" "}
                      {liveInterval === "D" ? "1D" : liveInterval + "M"}
                    </div>
                  </div>
                  <div className="h-[500px] w-full bg-slate-950/50 rounded-3xl border border-white/5 overflow-hidden">
                    <LiveMarketChart
                      candles={candles}
                      trades={backtestResult?.trades || []}
                      selectedTrade={selectedTradeForChart}
                    />
                  </div>
                </div>

                {/* Active Trade Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {!backtestResult ||
                    backtestResult.trades.filter((t) => t.status === "open")
                      .length === 0 ? (
                    <div className="md:col-span-2 p-12 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-600">
                      <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                        <Zap className="w-8 h-8 opacity-20" />
                      </div>
                      <p className="text-sm font-black uppercase tracking-widest">
                        No Active Positions
                      </p>
                    </div>
                  ) : (
                    backtestResult.trades
                      .filter((t) => t.status === "open")
                      .slice(0, 1)
                      .map((trade, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-8 border rounded-[2.5rem] shadow-2xl relative overflow-hidden group bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-emerald-500/20"
                        >
                          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                            <Activity className="w-32 h-32 text-emerald-400" />
                          </div>
                          <div className="relative z-10 space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div
                                  className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                                    trade.direction === "buy"
                                      ? "bg-emerald-500 text-slate-950"
                                      : "bg-rose-500 text-white",
                                  )}
                                >
                                  {trade.direction === "buy" ? (
                                    <TrendingUp className="w-6 h-6" />
                                  ) : (
                                    <TrendingDown className="w-6 h-6" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-lg font-black text-white uppercase tracking-tighter">
                                    {trade.direction} Position
                                  </h4>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    {pair} • IN PROGRESS
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className={cn(
                                    "text-3xl font-black tracking-tighter",
                                    trade.profit >= 0
                                      ? "text-emerald-400"
                                      : "text-rose-400",
                                  )}
                                >
                                  {trade.profit >= 0 ? "+" : ""}$
                                  {trade.profit.toFixed(2)}
                                </p>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  Live P/L
                                </p>
                              </div>
                            </div>

                            <div className="h-px w-full bg-white/5" />

                            <div className="grid grid-cols-3 gap-6">
                              <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">
                                  Entry Price
                                </p>
                                <p className="text-sm font-bold text-white font-mono">
                                  ${trade.entryPrice.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">
                                  Stop Loss
                                </p>
                                <p className="text-sm font-bold text-rose-400 font-mono">
                                  ${trade.sl.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">
                                  Target
                                </p>
                                <p className="text-sm font-bold text-emerald-400 font-mono">
                                  ${trade.tp?.toLocaleString() || "N/A"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === "paper-history" && (
          <PaperTradeHistoryView />
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
  selectedTrade,
}: {
  candles: Candle[];
  trades: Trade[];
  selectedTrade?: Trade | null;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const ema20SeriesRef = useRef<any>(null);
  const ema50SeriesRef = useRef<any>(null);
  const highSeriesRef = useRef<any>(null);
  const lowSeriesRef = useRef<any>(null);
  const slLineRef = useRef<any>(null);
  const tpLineRef = useRef<any>(null);
  const tradeHighlightSeriesRef = useRef<any>(null);

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

    const tradeHighlightSeries = chart.addSeries(AreaSeries, {
      topColor: "rgba(16, 185, 129, 0.4)",
      bottomColor: "rgba(16, 185, 129, 0.1)",
      lineColor: "rgba(16, 185, 129, 0.8)",
      lineWidth: 2,
      priceLineVisible: false,
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      title: "EMA 20",
    });

    const ema50Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      title: "EMA 50",
    });

    const highSeries = chart.addSeries(LineSeries, {
      color: "rgba(16, 185, 129, 0.3)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "High",
    });

    const lowSeries = chart.addSeries(LineSeries, {
      color: "rgba(239, 68, 68, 0.3)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "Low",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    tradeHighlightSeriesRef.current = tradeHighlightSeries;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;
    highSeriesRef.current = highSeries;
    lowSeriesRef.current = lowSeries;

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

    if (sortedData.length > 0) {
      candleSeriesRef.current.setData(sortedData);

      // Calculate EMA 20
      const ema20 = calculateEMA(
        sortedData.map((d) => d.close),
        20,
      );
      ema20SeriesRef.current.setData(
        sortedData.map((d, i) => ({ time: d.time, value: ema20[i] })),
      );

      // Calculate EMA 50
      const ema50 = calculateEMA(
        sortedData.map((d) => d.close),
        50,
      );
      ema50SeriesRef.current.setData(
        sortedData.map((d, i) => ({ time: d.time, value: ema50[i] })),
      );

      // Calculate 20-period High/Low
      const hl = calculateHighLow(sortedData, 20);
      highSeriesRef.current.setData(
        sortedData.map((d, i) => ({ time: d.time, value: hl.highs[i] })),
      );
      lowSeriesRef.current.setData(
        sortedData.map((d, i) => ({ time: d.time, value: hl.lows[i] })),
      );
    }

    // Add markers for trades
    const markers: any[] = [];

    // If a trade is selected from the log, prioritize its markers
    const tradesToMark = selectedTrade ? [selectedTrade] : trades;

    tradesToMark.forEach((trade) => {
      const entryTime =
        Math.floor(dayjs(trade.entryTime).valueOf() / 1000) + istOffset;
      markers.push({
        time: entryTime,
        position: trade.direction === "buy" ? "belowBar" : "aboveBar",
        color: trade.direction === "buy" ? "#10b981" : "#ef4444",
        shape: trade.direction === "buy" ? "arrowUp" : "arrowDown",
        text: `ENTRY ${trade.direction.toUpperCase()} @ ${trade.entryPrice.toFixed(2)}`,
        size: 2,
      });

      if (trade.status === "open") {
        // Highlight active trade with a special marker
        markers.push({
          time: entryTime,
          position: trade.direction === "buy" ? "belowBar" : "aboveBar",
          color: "#3b82f6",
          shape: "circle",
          text: "ACTIVE",
        });
      }

      if (trade.exitTime) {
        const exitTime =
          Math.floor(dayjs(trade.exitTime).valueOf() / 1000) + istOffset;
        markers.push({
          time: exitTime,
          position: trade.direction === "buy" ? "aboveBar" : "belowBar",
          color: "#94a3b8",
          shape: trade.direction === "buy" ? "arrowDown" : "arrowUp",
          text: `EXIT ${trade.exitReason || ""} @ ${trade.exitPrice?.toFixed(2)}`,
          size: 2,
        });
      }
    });

    if (
      candleSeriesRef.current &&
      typeof candleSeriesRef.current.setMarkers === "function"
    ) {
      candleSeriesRef.current.setMarkers(markers);

      // Scroll to selected trade if exists
      if (selectedTrade && chartRef.current) {
        chartRef.current.timeScale().scrollToPosition(0, false); // First reset
        // We don't have a direct "scrollToTime" in basic lightweight-charts without more complex logic,
        // but setMarkers already highlights it. For now, we'll ensure it's in view if possible.
      }
    }

    // Add SL/TP Lines for the latest active trade
    const activeTrade = trades.find((t) => t.status === "open");
    if (candleSeriesRef.current) {
      // Clear existing lines
      if (slLineRef.current) {
        candleSeriesRef.current.removePriceLine(slLineRef.current);
        slLineRef.current = null;
      }
      if (tpLineRef.current) {
        candleSeriesRef.current.removePriceLine(tpLineRef.current);
        tpLineRef.current = null;
      }

      if (activeTrade) {
        slLineRef.current = candleSeriesRef.current.createPriceLine({
          price: activeTrade.sl,
          color: "#ef4444",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL: ${activeTrade.sl.toFixed(2)}`,
        });

        if (activeTrade.tp) {
          tpLineRef.current = candleSeriesRef.current.createPriceLine({
            price: activeTrade.tp,
            color: "#10b981",
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `TP: ${activeTrade.tp.toFixed(2)}`,
          });
        }
      }
    }

    // Add Highlight Area for selected trade
    if (selectedTrade && tradeHighlightSeriesRef.current) {
      const entryTime =
        Math.floor(dayjs(selectedTrade.entryTime).valueOf() / 1000) + istOffset;
      const exitTime = selectedTrade.exitTime
        ? Math.floor(dayjs(selectedTrade.exitTime).valueOf() / 1000) + istOffset
        : Math.floor(dayjs().valueOf() / 1000) + istOffset;

      const isProfit = selectedTrade.profit >= 0;
      tradeHighlightSeriesRef.current.applyOptions({
        topColor: isProfit
          ? "rgba(16, 185, 129, 0.4)"
          : "rgba(239, 68, 68, 0.4)",
        bottomColor: isProfit
          ? "rgba(16, 185, 129, 0.1)"
          : "rgba(239, 68, 68, 0.1)",
        lineColor: isProfit
          ? "rgba(16, 185, 129, 0.8)"
          : "rgba(239, 68, 68, 0.8)",
        lineWidth: 2,
      });

      const highlightData = sortedData
        .filter((d) => d.time >= entryTime && d.time <= exitTime)
        .map((d) => ({ time: d.time, value: d.close }));

      tradeHighlightSeriesRef.current.setData(highlightData);
    } else if (tradeHighlightSeriesRef.current) {
      tradeHighlightSeriesRef.current.setData([]);
    }
  }, [candles, trades, selectedTrade]);

  return (
    <div className="p-6 bg-slate-900/40 border border-white/5 rounded-[2.5rem] backdrop-blur-sm overflow-hidden">
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}

function calculateEMA(data: number[], period: number) {
  const k = 2 / (period + 1);
  let ema = data[0];
  const results = [ema];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    results.push(ema);
  }
  return results;
}

function calculateHighLow(data: any[], period: number) {
  const highs = [];
  const lows = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - period + 1);
    const window = data.slice(start, i + 1);
    highs.push(Math.max(...window.map((d) => d.high)));
    lows.push(Math.min(...window.map((d) => d.low)));
  }
  return { highs, lows };
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

// ════════════════════════════════════════════════════════════
//  Strategy Builder View
// ════════════════════════════════════════════════════════════

const SB_MONTHS = [
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
];

function SbSortIcon({
  colKey,
  sortKey,
  sortDir,
}: {
  colKey: string;
  sortKey: string;
  sortDir: "asc" | "desc";
}) {
  if (colKey !== sortKey)
    return <ChevronUp className="w-3 h-3 opacity-20 inline ml-1" />;
  return sortDir === "desc" ? (
    <ChevronDown className="w-3 h-3 text-violet-400 inline ml-1" />
  ) : (
    <ChevronUp className="w-3 h-3 text-violet-400 inline ml-1" />
  );
}

function StrategyBuilderView({
  sbMonth,
  setSbMonth,
  sbYear,
  setSbYear,
  sbInterval,
  setSbInterval,
  sbPerTradeAmount,
  setSbPerTradeAmount,
  sbLeverage,
  setSbLeverage,
  sbUseTrailingSL,
  setSbUseTrailingSL,
  sbLoading,
  sbResult,
  sbError,
  sbSorted,
  sbSortKey,
  sbSortDir,
  handleSbSort,
  runStrategyBuilder,
  dynamicMaxLeverage,
}: any) {
  const profitableCount =
    sbResult?.results?.filter((r: any) => r.totalPL > 0).length ?? 0;

  const inputCls =
    "w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white font-bold outline-none focus:border-violet-500/50 transition-colors text-sm";

  const cols: {
    key: string;
    label: string;
    numeric?: boolean;
    configKey?: string;
  }[] = [
      { key: "rank", label: "#" },
      { key: "emaShort", label: "EMA S", configKey: "emaShort" },
      { key: "emaLong", label: "EMA L", configKey: "emaLong" },
      { key: "rsiPeriod", label: "RSI P", configKey: "rsiPeriod" },
      { key: "rsiThreshold", label: "RSI Min", configKey: "rsiThreshold" },
      { key: "volMultiplier", label: "Vol×", configKey: "volMultiplier" },
      { key: "atrPeriod", label: "ATR P", configKey: "atrPeriod" },
      { key: "slMult", label: "SL ×", configKey: "slMult" },
      { key: "trailingSLMult", label: "Trail×", configKey: "trailingSLMult" },
      { key: "totalTrades", label: "Trades", numeric: true },
      { key: "wins", label: "Wins", numeric: true },
      { key: "losses", label: "Loss", numeric: true },
      { key: "winRate", label: "Win %", numeric: true },
      { key: "totalPL", label: "Total P/L", numeric: true },
      { key: "avgWin", label: "Avg Win", numeric: true },
      { key: "avgLoss", label: "Avg Loss", numeric: true },
      { key: "riskReward", label: "R:R", numeric: true },
    ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-400 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter">
              Strategy <span className="text-violet-400">Builder</span>
            </h1>
          </div>
          <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
            Tests every possible combination of EMA, RSI, Volume, and ATR filter
            parameters on your chosen month of market data. Results are ranked
            by total profit — find the configuration that actually works.
          </p>
        </div>
        {sbResult && (
          <div className="flex items-center gap-5 shrink-0">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                Combinations
              </p>
              <p className="text-2xl font-black text-white">
                {sbResult.totalCombinations?.toLocaleString()}
              </p>
            </div>
            <div className="w-px h-12 bg-white/5" />
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                With Trades
              </p>
              <p className="text-2xl font-black text-violet-400">
                {sbResult.testedCombinations?.toLocaleString()}
              </p>
            </div>
            <div className="w-px h-12 bg-white/5" />
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                Profitable
              </p>
              <p className="text-2xl font-black text-emerald-400">
                {profitableCount?.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="p-8 bg-slate-900/60 border border-white/10 rounded-[2.5rem] shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/20">
            <Filter className="w-5 h-5 text-violet-400" />
          </div>
          <h2 className="text-lg font-black tracking-tight">Configuration</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Month
            </label>
            <select
              value={sbMonth}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSbMonth(Number(e.target.value))
              }
              className={inputCls}
            >
              {SB_MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Year
            </label>
            <select
              value={sbYear}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSbYear(Number(e.target.value))
              }
              className={inputCls}
            >
              {[2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Interval
            </label>
            <select
              value={sbInterval}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSbInterval(e.target.value)
              }
              className={inputCls}
            >
              {["1", "5", "15", "30", "60"].map((iv) => (
                <option key={iv} value={iv}>
                  {iv === "60" ? "1H" : iv + " Min"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Per Trade Amount ($)
            </label>
            <input
              type="number"
              value={sbPerTradeAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSbPerTradeAmount(Number(e.target.value))
              }
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Leverage {dynamicMaxLeverage ? `(Max: ${dynamicMaxLeverage}x)` : "(0=Max)"}
            </label>
            <input
              type="number"
              value={sbLeverage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSbLeverage(Number(e.target.value))
              }
              className={inputCls}
            />
          </div>
          <div className="space-y-2 flex flex-col justify-end">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Trailing SL
            </label>
            <button
              onClick={() => setSbUseTrailingSL(!sbUseTrailingSL)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-2xl border font-black text-xs uppercase tracking-widest transition-all",
                sbUseTrailingSL
                  ? "bg-violet-600/20 border-violet-500/30 text-violet-300"
                  : "bg-slate-800/50 border-white/5 text-slate-500",
              )}
            >
              <div
                className={cn(
                  "w-8 h-4 rounded-full relative transition-all shrink-0",
                  sbUseTrailingSL ? "bg-violet-600" : "bg-slate-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                    sbUseTrailingSL ? "left-[18px]" : "left-0.5",
                  )}
                />
              </div>
              {sbUseTrailingSL ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <button
          onClick={runStrategyBuilder}
          disabled={sbLoading}
          className="w-full py-4 rounded-[1.5rem] bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-violet-600/25 transition-all flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {sbLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" /> Scanning all
              combinations…
            </>
          ) : (
            <>
              <FlaskConical className="w-5 h-5" /> Find Best Filter Combinations
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {sbError && (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300 font-bold">{sbError}</p>
        </div>
      )}

      {/* Loading Indicator */}
      {sbLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-violet-600/10 border-t-violet-500 animate-spin" />
            <FlaskConical className="w-10 h-10 text-violet-400 absolute inset-0 m-auto" />
          </div>

          <div className="text-center space-y-2">
            <p className="text-2xl font-black text-white tracking-tight">
              Scanning Market Dynamics
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Testing thousands of filter combinations on {SB_MONTHS[sbMonth]}{" "}
              {sbYear} data to find the most profitable configuration.
            </p>
          </div>

          {/* Real-time Parameter Scanner UI */}
          <div className="w-full max-w-2xl p-8 bg-slate-900/40 border border-violet-500/20 rounded-[2.5rem] backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-transparent animate-pulse" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
                    Active Engine Scan
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    Processing...
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <ScannerStat
                  label="EMA Combo"
                  value={`${[5, 9, 12, 20][Math.floor(Date.now() / 200) % 4]}/${[26, 50, 100, 200][Math.floor(Date.now() / 300) % 4]}`}
                />
                <ScannerStat
                  label="RSI Filter"
                  value={`${[7, 9, 14][Math.floor(Date.now() / 150) % 3]} @ >${[45, 50, 55][Math.floor(Date.now() / 400) % 3]}`}
                />
                <ScannerStat
                  label="Vol Mult"
                  value={`${[1.0, 1.2, 1.5][Math.floor(Date.now() / 250) % 3]}x`}
                />
                <ScannerStat
                  label="ATR SL"
                  value={`${[1.0, 1.5, 2.0, 2.5][Math.floor(Date.now() / 350) % 4]}x`}
                />
              </div>

              <div className="mt-8 h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-violet-500"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!sbLoading && sbResult && sbSorted.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Top-3 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sbSorted.slice(0, 3).map((r: any, idx: number) => {
              const medals = ["🥇", "🥈", "🥉"];
              const colors = [
                "from-amber-600/20 to-yellow-500/5 border-amber-500/20",
                "from-slate-500/20 to-slate-400/5 border-slate-500/20",
                "from-orange-700/20 to-amber-700/5 border-orange-600/20",
              ];
              return (
                <div
                  key={idx}
                  className={cn(
                    "p-6 bg-gradient-to-br rounded-3xl border space-y-4",
                    colors[idx],
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{medals[idx]}</span>
                    <span
                      className={cn(
                        "text-xl font-black tracking-tight",
                        r.totalPL > 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {r.totalPL > 0 ? "+" : ""}
                      {r.totalPL.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        Win Rate
                      </p>
                      <p className="text-white font-black">
                        {r.winRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        Trades
                      </p>
                      <p className="text-white font-black">{r.totalTrades}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        EMA
                      </p>
                      <p className="text-white font-black">
                        {r.config.emaShort}/{r.config.emaLong}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        RSI
                      </p>
                      <p className="text-white font-black">
                        {r.config.rsiPeriod} &gt; {r.config.rsiThreshold}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        Vol ×
                      </p>
                      <p className="text-white font-black">
                        {r.config.volMultiplier}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        ATR SL Mult
                      </p>
                      <p className="text-white font-black">
                        {r.config.slMult}×
                      </p>
                    </div>
                    {r.riskReward !== null && (
                      <div className="col-span-2">
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                          Risk : Reward
                        </p>
                        <p className="text-white font-black">
                          1 : {r.riskReward}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Ranked Table */}
          <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-violet-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">
                  All Ranked Combinations
                </h3>
                <span className="px-3 py-1 rounded-full bg-violet-600/20 text-violet-300 text-[10px] font-black">
                  Top {sbSorted.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest hidden md:block">
                Click headers to sort
              </p>
            </div>

            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table
                className="w-full text-left"
                style={{ minWidth: "1100px" }}
              >
                <thead className="sticky top-0 z-10">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-950/90 backdrop-blur-sm">
                    {cols.map((col) => (
                      <th
                        key={col.key}
                        onClick={() =>
                          col.key !== "rank" &&
                          handleSbSort(col.configKey || col.key)
                        }
                        className={cn(
                          "px-4 py-4 whitespace-nowrap select-none",
                          col.key !== "rank" &&
                          "cursor-pointer hover:text-violet-300 transition-colors",
                          col.numeric && "text-right",
                        )}
                      >
                        {col.label}
                        {col.key !== "rank" && (
                          <SbSortIcon
                            colKey={col.configKey || col.key}
                            sortKey={sbSortKey}
                            sortDir={sbSortDir}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {sbSorted.map((r: any, i: number) => {
                    const isProfitable = r.totalPL > 0;
                    return (
                      <tr
                        key={i}
                        className={cn(
                          "group transition-colors hover:bg-white/[0.025]",
                          i < 3 && "bg-violet-600/[0.04]",
                        )}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black",
                              i === 0
                                ? "bg-amber-500/20 text-amber-400"
                                : i === 1
                                  ? "bg-slate-500/20 text-slate-300"
                                  : i === 2
                                    ? "bg-orange-700/20 text-orange-500"
                                    : "bg-slate-900 text-slate-600",
                            )}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {r.config.emaShort}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {r.config.emaLong}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {r.config.rsiPeriod}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {r.config.rsiThreshold}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {r.config.volMultiplier}×
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {r.config.atrPeriod}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {r.config.slMult}×
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {r.config.trailingSLMult}×
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-slate-300 font-bold">
                          {r.totalTrades}
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-emerald-400 font-bold">
                          {r.wins}
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-rose-400 font-bold">
                          {r.losses}
                        </td>
                        <td className="px-4 py-3 text-xs text-right font-bold">
                          <span
                            className={cn(
                              r.winRate >= 60
                                ? "text-emerald-400"
                                : r.winRate >= 45
                                  ? "text-amber-400"
                                  : "text-rose-400",
                            )}
                          >
                            {r.winRate.toFixed(1)}%
                          </span>
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-sm text-right font-black",
                            isProfitable ? "text-emerald-400" : "text-rose-400",
                          )}
                        >
                          {isProfitable ? "+" : ""}
                          {r.totalPL.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-emerald-300 font-mono">
                          {r.avgWin > 0 ? `+${r.avgWin.toFixed(4)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-rose-300 font-mono">
                          {r.avgLoss > 0 ? `-${r.avgLoss.toFixed(4)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-right font-bold text-slate-300">
                          {r.riskReward !== null ? `1:${r.riskReward}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!sbLoading && !sbResult && !sbError && (
        <div className="flex flex-col items-center justify-center py-28 gap-6 border-2 border-dashed border-white/5 rounded-[3rem]">
          <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center">
            <FlaskConical className="w-10 h-10 text-violet-500/40" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-400 mb-2">
              Ready to Discover
            </h3>
            <p className="text-slate-600 text-sm max-w-sm">
              Select your target month, interval &amp; capital above, then run
              the scanner to find the best-performing filter configurations.
            </p>
          </div>
        </div>
      )}

      {!sbLoading && sbResult && sbSorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-amber-500/5 border border-amber-500/10 rounded-3xl">
          <AlertCircle className="w-10 h-10 text-amber-400" />
          <p className="text-amber-300 font-bold">
            No combinations produced any trades for this period.
          </p>
          <p className="text-slate-500 text-sm">
            Try a shorter interval (5m / 15m) or a different month with higher
            volatility.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function ScannerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">
        {label}
      </p>
      <p className="text-sm font-mono font-black text-violet-100">{value}</p>
    </div>
  );
}
