import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import dayjs from 'dayjs'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Clock, Activity, BarChart3, Database,
  Shield, Zap, RefreshCw, Layers, Settings2, Play, Table, PieChart,
  ChevronRight, AlertCircle, Info
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Trade {
  breakoutTime: string
  entryTime: string
  exitTime?: string
  direction: 'buy' | 'sell'
  entryPrice: number
  exitPrice?: number
  profit: number
  status: 'open' | 'closed'
  exitReason?: string
}

interface BacktestResponse {
  trades: Trade[]
  summary: {
    totalProfit: number
    count: number
    successCount: number
    failedCount: number
    winRate: number
    initialCapital: number
  }
}

interface ApiResponse {
  s: string
  data: Candle[]
}

const API_BASE_URL = 'http://localhost:5001/api'

export default function App() {
  const [view, setView] = useState<'live' | 'backtest'>('live')
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pair, setPair] = useState('B-BTC_USDT')

  const [rangeTime, setRangeTime] = useState('04:00')
  const [cutoffTime, setCutoffTime] = useState('02:15')
  const [buffer, setBuffer] = useState(2)
  const [riskReward, setRiskReward] = useState(1.2)
  const [initialCapital, setInitialCapital] = useState(1000)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [interval, setInterval] = useState('15')
  const [useTrailingSL, setUseTrailingSL] = useState(false)
  const [backtestResult, setBacktestResult] = useState<BacktestResponse | null>(null)
  const [isBacktesting, setIsBacktesting] = useState(false)
  const [isTestMode, setIsTestMode] = useState(false)

  const fetchMarketData = async () => {
    try {
      setRefreshing(true)
      const response = await axios.get<ApiResponse>(`${API_BASE_URL}/market-data`, {
        params: {
          pair,
          resolution: '60',
          isTest: isTestMode
        }
      })
      if (response.data.s === 'ok') {
        setCandles([...response.data.data].sort((a, b) => b.time - a.time))
        setError(null)
      } else {
        setError('Market data stream returned empty or invalid status.')
      }
    } catch (err) {
      setError('Connection to backend failed. Please check if the server is running.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const runBacktest = async () => {
    try {
      setIsBacktesting(true)
      const [rHour, rMin] = rangeTime.split(':').map(Number)
      const [cHour, cMin] = cutoffTime.split(':').map(Number)

      const response = await axios.post<BacktestResponse>(`${API_BASE_URL}/backtest`, {
        pair,
        resolution: interval,
        rangeHour: rHour,
        rangeMinute: rMin,
        cutoffHour: cHour,
        cutoffMinute: cMin,
        buffer,
        riskReward,
        month: selectedMonth,
        year: selectedYear,
        initialCapital,
        useTrailingSL,
        isTest: isTestMode
      })
      setBacktestResult(response.data)
      setView('backtest')
    } catch (err) {
      console.error(err)
    } finally {
      setIsBacktesting(false)
    }
  }

  useEffect(() => {
    fetchMarketData()
  }, [pair, isTestMode])

  const stats = useMemo(() => {
    if (candles.length === 0) return { avgPrice: 0, maxHigh: 0, minLow: 0, totalVolume: 0 }
    const totalVolume = candles.reduce((acc, c) => acc + c.volume, 0)
    const maxHigh = Math.max(...candles.map(c => c.high))
    const minLow = Math.min(...candles.map(c => c.low))
    const avgPrice = candles.reduce((acc, c) => acc + c.close, 0) / candles.length
    return { avgPrice, maxHigh, minLow, totalVolume }
  }, [candles])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Background decoration */}
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
              <span className="font-bold text-xl tracking-tight block">Resistance<span className="text-blue-400">Terminal</span></span>
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] leading-none">Intelligence Engine</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-white/5">
            <ViewToggle active={view === 'live'} onClick={() => setView('live')} icon={Activity} label="Live Feed" />
            <ViewToggle active={view === 'backtest'} onClick={() => setView('backtest')} icon={Settings2} label="Backtest" />
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
        {view === 'live' ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest">Real-time Data</span>
                  <div className="h-px w-8 bg-slate-800" />
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Candlestick Feed</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
                  Market Pulse
                </h1>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 rounded-2xl">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTestMode}
                      onChange={(e) => setIsTestMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                    <span className="ml-3 text-[10px] font-black text-rose-400 uppercase tracking-widest">Test Mode</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-slate-900/40 p-1.5 rounded-2xl border border-white/5">
                  {['B-BTC_USDT', 'B-ETH_USDT', 'B-SOL_USDT'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPair(p)}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                        pair === p
                          ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20"
                          : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                      )}
                    >
                      {p.split('-')[1]}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <StatCard title="Real-time Avg" value={`$${stats.avgPrice.toLocaleString()}`} icon={Layers} color="text-blue-400" gradient="from-blue-600/10 to-transparent" />
              <StatCard title="Session High" value={`$${stats.maxHigh.toLocaleString()}`} icon={TrendingUp} color="text-emerald-400" gradient="from-emerald-600/10 to-transparent" />
              <StatCard title="Session Low" value={`$${stats.minLow.toLocaleString()}`} icon={TrendingDown} color="text-rose-400" gradient="from-rose-600/10 to-transparent" />
              <StatCard title="Volume Aggregate" value={stats.totalVolume.toFixed(2)} icon={Activity} color="text-amber-400" gradient="from-amber-600/10 to-transparent" />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between px-2 mb-2">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" /> Recent Candles
                  </h2>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-600">
                    <span>RES: 60M</span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>PAIR: {pair}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-24 w-full bg-white/5 animate-pulse rounded-3xl border border-white/5" />
                      ))
                    ) : (
                      candles.slice(0, 15).map((candle, idx) => (
                        <CandleRow key={candle.time} candle={candle} index={idx} />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] relative overflow-hidden group shadow-2xl shadow-blue-600/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-[80px] -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10">
                    <Shield className="w-10 h-10 text-white/40 mb-6" />
                    <h3 className="text-2xl font-black text-white mb-3 leading-tight">Secure Edge<br />Technology</h3>
                    <p className="text-blue-100/70 text-sm leading-relaxed mb-8">Proprietary Node.js adapter for high-frequency market data streaming.</p>
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
                  <h2 className="text-xl font-black tracking-tight">Setup Parameters</h2>
                </div>

                <div className="space-y-6">
                  <InputGroup label="Range Start Time" sub="Set the definition hour for daily range">
                    <input
                      type="time"
                      value={rangeTime}
                      onChange={(e) => setRangeTime(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:border-blue-500/50 outline-none transition-all"
                    />
                  </InputGroup>

                  <InputGroup label="Cutoff Time" sub="Daily trade closure forced at this hour">
                    <input
                      type="time"
                      value={cutoffTime}
                      onChange={(e) => setCutoffTime(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:border-blue-500/50 outline-none transition-all"
                    />
                  </InputGroup>

                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Year" sub="Target year">
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                      >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </InputGroup>
                    <InputGroup label="Month" sub="Target month">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                      >
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                          <option key={m} value={i}>{m}</option>
                        ))}
                      </select>
                    </InputGroup>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Interval" sub="Candle timeframe">
                      <select
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                      >
                        {['1', '5', '15', '30', '60', 'D'].map(i => <option key={i} value={i}>{i === 'D' ? '1 Day' : i + ' Min'}</option>)}
                      </select>
                    </InputGroup>
                    <InputGroup label="Capital ($)" sub="Initial deposit">
                      <input
                        type="number"
                        value={initialCapital}
                        onChange={(e) => setInitialCapital(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                      />
                    </InputGroup>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Buffer ($)" sub="Breakout threshold">
                      <input
                        type="number"
                        value={buffer}
                        onChange={(e) => setBuffer(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                      />
                    </InputGroup>
                    <InputGroup label="Risk Reward" sub="Target multiplier">
                      <input
                        type="number"
                        step="0.1"
                        value={riskReward}
                        onChange={(e) => setRiskReward(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none"
                      />
                    </InputGroup>
                  </div>

                  <div className="flex items-center gap-3 px-2 py-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useTrailingSL}
                        onChange={(e) => setUseTrailingSL(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-bold text-slate-300">Enable Trailing Stop Loss</span>
                    </label>
                  </div>

                  <button
                    onClick={runBacktest}
                    disabled={isBacktesting}
                    className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:bg-slate-800"
                  >
                    {isBacktesting ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                    {isBacktesting ? 'Computing Data...' : 'Run Simulation'}
                  </button>
                </div>
              </div>

              <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-200 mb-1">Backtesting Engine</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Simulated using direct historical data from CoinDCX. Results may vary based on live slippage and execution latencies.</p>
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
                  <h3 className="text-xl font-bold text-slate-400 mb-2">No Results Available</h3>
                  <p className="max-w-xs text-sm">Configure your strategy parameters on the left and run the simulation to see historical performance.</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <ResultCard title="Total P/L" value={`$${backtestResult.summary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={TrendingUp} color={backtestResult.summary.totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"} />
                    <ResultCard title="Success" value={backtestResult.summary.successCount.toString()} icon={Zap} color="text-emerald-400" />
                    <ResultCard title="Failed" value={backtestResult.summary.failedCount.toString()} icon={AlertCircle} color="text-rose-400" />
                    <ResultCard title="Win Rate" value={`${backtestResult.summary.winRate.toFixed(1)}%`} icon={RefreshCw} color="text-blue-400" />
                  </div>

                  <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Trade Execution Log</h3>
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
                            <th className="px-8 py-5 text-right">Net Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {backtestResult.trades.map((trade, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                                    trade.direction === 'buy' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                  )}>
                                    {trade.direction === 'buy' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-white capitalize">{trade.direction} Position</div>
                                    <div className="flex flex-col gap-1 mt-1">
                                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter">
                                        <span className="text-slate-600 w-12 text-right">Breakout:</span>
                                        <span className="text-amber-500/80">{dayjs(trade.breakoutTime).format('MMM DD HH:mm')}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter">
                                        <span className="text-slate-600 w-12 text-right">Entry:</span>
                                        <span className="text-blue-400">{dayjs(trade.entryTime).format('MMM DD HH:mm')}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter">
                                        <span className="text-slate-600 w-12 text-right">Exit:</span>
                                        <span className="text-rose-400">{trade.exitTime ? dayjs(trade.exitTime).format('MMM DD HH:mm') : '---'}</span>
                                      </div>
                                      {trade.exitReason && (
                                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter">
                                          <span className="text-slate-600 w-12 text-right">Reason:</span>
                                          <span className={cn(
                                            trade.exitReason === 'TP' ? "text-emerald-400" :
                                              trade.exitReason === 'SL' ? "text-rose-400" :
                                                "text-slate-400"
                                          )}>
                                            {trade.exitReason}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-6 font-mono text-xs text-slate-400">${trade.entryPrice.toLocaleString()}</td>
                              <td className="px-5 py-6 font-mono text-xs text-slate-400">${trade.exitPrice?.toLocaleString() || '---'}</td>
                              <td className={cn(
                                "px-8 py-6 text-right font-black text-sm",
                                trade.profit > 0 ? "text-emerald-400" : "text-rose-400"
                              )}>
                                {trade.profit > 0 ? '+' : ''}{trade.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
            <a href="#" className="hover:text-blue-400 transition-colors">Documentation</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Risk Protocol</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Network Status</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CandleRow({ candle, index }: { candle: Candle, index: number }) {
  const isGreen = candle.close >= candle.open
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="p-6 bg-slate-900/40 border border-white/5 rounded-[2rem] hover:bg-white/[0.03] transition-all group overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
        <Zap className={cn("w-16 h-16", isGreen ? "text-emerald-400" : "text-rose-400")} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-5">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border rotate-3 group-hover:rotate-0 transition-transform shadow-lg",
            isGreen ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          )}>
            {isGreen ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-black text-xl leading-none">${candle.close.toLocaleString()}</h3>
              <span className={cn(
                "px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tighter uppercase",
                isGreen ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              )}>
                {((Math.abs(candle.close - candle.open) / candle.open) * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {new Date(candle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
  )
}

function StatCard({ title, value, icon: Icon, color, gradient }: { title: string, value: string, icon: any, color: string, gradient: string }) {
  return (
    <div className="p-8 bg-slate-900/50 border border-white/5 rounded-[2.5rem] relative overflow-hidden group shadow-sm hover:border-white/10 transition-all">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none", gradient)} />
      <div className="relative z-10 flex flex-col gap-5">
        <div className={cn("p-3 rounded-2xl bg-slate-950/80 w-fit shrink-0 border border-white/5 shadow-inner", color)}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">{title}</p>
          <p className="text-3xl font-black text-white tracking-tighter group-hover:scale-[1.02] origin-left transition-transform">{value}</p>
        </div>
      </div>
    </div>
  )
}

function ResultCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  return (
    <div className="p-8 bg-slate-900/40 border border-white/10 rounded-[2.5rem] flex flex-col items-center text-center group">
      <div className={cn("p-4 rounded-full bg-slate-950 mb-4 border border-white/5 group-hover:scale-110 transition-transform", color)}>
        <Icon className="w-8 h-8" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">{title}</p>
      <p className={cn("text-4xl font-black tracking-tighter", color)}>{value}</p>
    </div>
  )
}

function ViewToggle({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all",
        active ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function InputGroup({ label, sub, children }: { label: string, sub: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-black text-slate-200 block mb-0.5">{label}</label>
        <span className="text-[10px] font-bold text-slate-600 lowercase block">{sub}</span>
      </div>
      {children}
    </div>
  )
}

function OHItem({ label, val }: { label: string, val: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-black text-slate-700 uppercase mb-0.5">{label}</span>
      <span className="text-xs font-mono font-bold text-slate-300">${val.toLocaleString()}</span>
    </div>
  )
}

function InsightRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.02] last:border-0">
      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-black text-slate-300">{value}</span>
    </div>
  )
}
