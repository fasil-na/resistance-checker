import { useEffect, useState } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Sun, Book, Code, RefreshCw, Activity, Heart, Shield, Terminal } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ActivityItem {
  id: number
  name: string
  status: string
  icon: string
}

const iconMap: Record<string, any> = {
  zap: Zap,
  sun: Sun,
  book: Book,
  code: Code,
}

export default function App() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchActivities = async () => {
    try {
      setRefreshing(true)
      const response = await axios.get('http://localhost:5001/api/activities')
      setActivities(response.data)
      setError(null)
    } catch (err) {
      setError('Failed to fetch activities from backend')
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500/30">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <nav className="relative z-10 border-b border-slate-800/50 backdrop-blur-md bg-slate-950/50 sticky top-0">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Resistance<span className="text-purple-400">Node</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Dashboard</a>
            <a href="#" className="hover:text-white transition-colors">History</a>
            <button
              onClick={fetchActivities}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50"
              disabled={refreshing}
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin text-purple-400")} />
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <header className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              System Dashboard
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
              Real-time synchronization between your Node.js backend and React frontend.
              Monitor your latest activities and system health below.
            </p>
          </motion.div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard title="System Status" value="Online" icon={Heart} color="text-emerald-400" />
          <StatCard title="Total Activities" value={activities.length.toString()} icon={Activity} color="text-blue-400" />
          <StatCard title="Last Updated" value="Just now" icon={Terminal} color="text-purple-400" />
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Latest Activities</h2>
            <div className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs text-slate-400">
              Fetched from <code className="text-purple-400">/api/activities</code>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 w-full bg-slate-900/50 animate-pulse rounded-xl border border-slate-800" />
                ))
              ) : error ? (
                <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
                  {error}
                </div>
              ) : (
                activities.map((activity, idx) => {
                  const Icon = iconMap[activity.icon] || Zap
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}
                      className="p-5 flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-2xl transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                          <Icon className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-100">{activity.name}</h3>
                          <p className="text-sm text-slate-500">Activity ID: {activity.id}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold",
                        activity.status === 'Completed' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          activity.status === 'Pending' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      )}>
                        {activity.status}
                      </div>
                    </motion.div>
                  )
                })
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-slate-900 py-8">
        <div className="max-w-5xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>© 2026 ResistanceApp. Powered by Node.js & React.</p>
        </div>
      </footer>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  return (
    <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent blur-2xl group-hover:from-white/10 transition-all" />
      <div className="flex flex-col gap-3">
        <div className={cn("p-2 rounded-lg bg-slate-800 w-fit shrink-0", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
        </div>
      </div>
    </div>
  )
}
