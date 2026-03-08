"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Target, Timer, AlertTriangle, Calendar, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts"
import { supabase } from "@/lib/supabase"
import { getFocusAnalytics, getHeatmapData } from "@/lib/database"

const timeRanges = ["This Week", "This Month", "Last 3 Months", "This Year"]
const dayLabels = ["M", "T", "W", "T", "F", "S", "S"]
const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } })
}

export default function AnalyticsPage() {
  const [selectedRange, setSelectedRange] = useState("This Week")
  const [isChartsExpanded, setIsChartsExpanded] = useState(false)

  // Dynamic Data States
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [distractionBreakdown, setDistractionBreakdown] = useState<any[]>([])
  const [monthlyFopoData, setMonthlyFopoData] = useState<any[]>([])
  const [bestDays, setBestDays] = useState<any[]>([])
  const [insights, setInsights] = useState({
    strengths: ["Complete a session to see your strengths!"],
    improvements: ["Log some focus time to find areas to improve."]
  })
  const [summaryStats, setSummaryStats] = useState({
    totalZofo: 0, focusHours: 0, avgEfficiency: 0, distractions: 0
  })

  const [heatmapWeeks, setHeatmapWeeks] = useState<number[][]>(Array.from({ length: 12 }, () => Array.from({ length: 7 }, () => 0)))

  const processAnalyticsData = (data: any[]) => {
    if (!data || data.length === 0) {
      const emptyDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({ day, focusHours: 0, zofo: 0 }))
      setWeeklyData(emptyDays)
      setSummaryStats({ totalZofo: 0, focusHours: 0, avgEfficiency: 0, distractions: 0 })
      return;
    }

    // 1. Calculate Summary Stats
    let totalZ = 0, totalMins = 0, totalDist = 0;
    data.forEach(s => {
      totalZ += s.fopo_earned || 0;
      totalMins += s.focus_minutes || 0;
      totalDist += s.distractions || 0;
    });

    let efficiency = 100;
    if (totalMins > 0) {
      const hours = totalMins / 60;
      const penalty = (totalDist / hours) * 5;
      efficiency = Math.max(0, Math.min(100, Math.round(100 - penalty)));
    }

    setSummaryStats({
      totalZofo: totalZ,
      focusHours: Number((totalMins / 60).toFixed(1)),
      avgEfficiency: efficiency,
      distractions: totalDist
    })

    // 2. Continuous 7-Day Timeline (Last 7 days including today)
    const dailyMap = new Map<string, { fopo: number, mins: number }>()
    data.forEach(d => {
      const dateKey = d.start_time.split('T')[0]
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { fopo: 0, mins: 0 })
      }
      const existing = dailyMap.get(dateKey)!
      existing.fopo += d.fopo_earned || 0
      existing.mins += d.focus_minutes || 0
    })

    const timeline = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
      const stats = dailyMap.get(dateKey) || { fopo: 0, mins: 0 }

      timeline.push({
        day: dayName,
        focusHours: Number((stats.mins / 60).toFixed(1)),
        zofo: stats.fopo
      })
    }
    setWeeklyData(timeline)

    // 3. Best Days & Insights
    const sortedDays = [...timeline].sort((a, b) => b.zofo - a.zofo).slice(0, 3)
    if (sortedDays[0].zofo > 0) {
      setBestDays(sortedDays.map(d => ({ day: d.day, hours: `${d.focusHours}h`, zofo: d.zofo })))
      setInsights({
        strengths: [
          `Peak performance on ${sortedDays[0].day}`,
          `Overall efficiency is at ${efficiency}%`,
          totalDist === 0 ? `Incredible! Zero recorded distractions.` : `Keep reducing your distractions!`
        ],
        improvements: [
          `Try to focus more on weekends`,
          `Minimize phone notifications`,
          `Schedule longer deep focus blocks`
        ]
      })
    }

    // Pie chart distribution
    if (totalDist > 0) {
      setDistractionBreakdown([
        { name: "Social Media", value: Math.round(totalDist * 0.4), color: "#22d3ee" },
        { name: "Notifications", value: Math.round(totalDist * 0.3), color: "#818cf8" },
        { name: "Other", value: Math.round(totalDist * 0.3), color: "#a78bfa" }
      ])
    } else {
      setDistractionBreakdown([{ name: "None", value: 100, color: "#34d399" }])
    }
  }

  useEffect(() => {
    let channel: any = null

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Initial Fetch
      getFocusAnalytics(user.id).then(processAnalyticsData).catch(console.error)
      getHeatmapData(user.id, 12).then(setHeatmapWeeks).catch(console.error)

      // Realtime Subscription
      channel = supabase
        .channel('analytics-sync')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'focus_sessions',
          filter: `user_id=eq.${user.id}`
        }, () => {
          getFocusAnalytics(user.id).then(processAnalyticsData).catch(console.error)
          getHeatmapData(user.id, 12).then(setHeatmapWeeks).catch(console.error)
        })
        .subscribe()
    }

    init()

    return () => {
      if (channel) channel.unsubscribe()
    }
  }, [])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Track your productivity insights</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-secondary/30 p-1">
              {timeRanges.map((range) => (
                <button key={range} onClick={() => setSelectedRange(range)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${selectedRange === range ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {[
            { label: "Total ZoFo", value: summaryStats.totalZofo.toLocaleString(), trend: "Lifetime", up: true, Icon: Target, bg: "bg-primary/10", color: "text-primary" },
            { label: "Focus Hours", value: `${summaryStats.focusHours}h`, trend: "Lifetime", up: true, Icon: Timer, bg: "bg-accent/10", color: "text-accent" },
            { label: "Avg Efficiency", value: `${summaryStats.avgEfficiency}%`, trend: "Based on distractions", up: summaryStats.avgEfficiency > 80, Icon: TrendingUp, bg: "bg-green-500/10", color: "text-green-400" },
            { label: "Distractions", value: summaryStats.distractions, trend: "Lifetime", up: false, Icon: AlertTriangle, bg: "bg-yellow-500/10", color: "text-yellow-400" },
          ].map((stat, i) => (
            <motion.div key={i} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-3xl font-bold text-foreground">{stat.value}</p>
                      <div className={`mt-2 flex items-center gap-1 text-sm ${stat.up ? "text-green-400" : "text-green-400"}`}>
                        {stat.up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <span>{stat.trend}</span>
                      </div>
                    </div>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full ${stat.bg}`}>
                      <stat.Icon className={`h-7 w-7 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Mobile Charts Toggle */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h2 className="text-lg font-semibold text-foreground">Detailed Charts</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChartsExpanded(!isChartsExpanded)}
            className="gap-2 border-border"
          >
            {isChartsExpanded ? (
              <><ChevronUp className="h-4 w-4" /> Collapse</>
            ) : (
              <><ChevronDown className="h-4 w-4" /> Expand View</>
            )}
          </Button>
        </div>

        {/* Charts Grid - Hidden on mobile unless expanded */}
        <div className={`grid gap-6 lg:grid-cols-2 ${!isChartsExpanded ? 'hidden lg:grid' : ''}`}>
          {/* Daily Focus Hours */}
          <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Daily Focus Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="focusStroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#818cf8" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }} />
                      <Area type="monotone" dataKey="focusHours" stroke="url(#focusStroke)" strokeWidth={2.5} fill="url(#focusGradient)" animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Weekly ZoFo Trend */}
          <motion.div custom={5} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Weekly ZoFo Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#22d3ee" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--primary)/0.05)" }} />
                      <Bar dataKey="zofo" fill="url(#barGrad)" radius={[6, 6, 0, 0]} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Distraction Breakdown */}
          <motion.div custom={6} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Distraction Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <div className="h-48 w-48 sm:h-64 sm:w-64 shrink-0 mx-auto sm:mx-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distractionBreakdown}
                          cx="50%" cy="50%"
                          innerRadius={"60%"} outerRadius={"90%"}
                          paddingAngle={3}
                          dataKey="value"
                          animationDuration={800}
                        >
                          {distractionBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3">
                    {distractionBreakdown.map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-muted-foreground">{item.name}</span>
                          </div>
                          <span className="font-medium text-foreground">{item.value}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Monthly Growth */}
          <motion.div custom={7} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Monthly ZoFo Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyFopoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="monthlyStroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#a78bfa" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="zofo" stroke="url(#monthlyStroke)" strokeWidth={2.5} fill="url(#monthlyGradient)" animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Focus Heatmap */}
        <motion.div custom={8} initial="hidden" animate="visible" variants={cardVariants} className="mt-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Calendar className="h-5 w-5 text-primary" />
                Focus Heatmap — Last 12 Weeks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-2">
                <div className="flex flex-col gap-1.5 pr-2">
                  {dayLabels.map((d, i) => (
                    <span key={i} className="h-6 flex items-center text-[10px] text-muted-foreground">{d}</span>
                  ))}
                </div>
                {heatmapWeeks.map((week, w) => (
                  <div key={w} className="flex flex-col gap-1.5">
                    {week.map((intensity, d) => (
                      <div
                        key={d}
                        className={`h-6 w-6 rounded-md heatmap-${intensity} transition-transform hover:scale-125 cursor-default`}
                        title={["No focus", "Low", "Medium", "High", "Deep Focus"][intensity]}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Less focused</span>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-4 w-4 rounded-sm heatmap-${i}`} />
                ))}
                <span>Deep focus</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Best Days & Insights */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <motion.div custom={9} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Calendar className="h-5 w-5 text-primary" /> Best Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bestDays.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border/30 bg-secondary/20 p-3">
                      <div>
                        <p className="font-medium text-foreground">{item.day}</p>
                        <p className="text-sm text-muted-foreground">{item.hours} focused</p>
                      </div>
                      <div className="flex items-center gap-1 text-primary">
                        <Target className="h-4 w-4" />
                        <span className="font-semibold">{item.zofo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div custom={10} initial="hidden" animate="visible" variants={cardVariants} className="lg:col-span-2">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Productivity Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                    <h4 className="font-medium text-green-400">Strengths</h4>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {insights.strengths.map((str, i) => <li key={i}>{str}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                    <h4 className="font-medium text-yellow-400">Areas to Improve</h4>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {insights.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
