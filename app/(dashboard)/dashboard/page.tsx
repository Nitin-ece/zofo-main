"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Target, Timer, Flame, AlertTriangle, TrendingUp, Play, Trophy,
  Zap, ChevronRight, Gift, Star, Users, UserPlus, CheckCircle2,
  Circle, Crown, Sparkles, Sword
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getHeatmapData } from "@/lib/database"
import { useAuth } from "@/components/auth-provider"

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"]

const streakBadges = [
  { days: 7, label: "7-Day Streak", achieved: false, icon: "🔥" },
  { days: 30, label: "30-Day Master", achieved: false, icon: "⚡" },
  { days: 100, label: "100-Day Legend", achieved: false, icon: "👑" },
]

const inviteRewards = [
  { milestone: 3, label: "Invite 3 Friends", reward: "+150 FoPo", progress: 0, color: "text-cyan-400" },
  { milestone: 10, label: "Invite 10 Friends", reward: "Special Badge", progress: 0, color: "text-purple-400" },
]

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: "easeOut" as const } })
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [time, setTime] = useState<Date | null>(null)
  const [chestOpened, setChestOpened] = useState(false)
  const [fopoStats, setFopoStats] = useState<{ total_fopo: number; level: number } | null>(null)
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [topUsers, setTopUsers] = useState<any[]>([])
  const [todayFopo, setTodayFopo] = useState(0)
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [heatmapData, setHeatmapData] = useState<number[][]>(Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => 0)))

  useEffect(() => {
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!user?.id) return

    // Fetch FoPo stats
    supabase.from("fopo_points").select("total_fopo, level").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setFopoStats(data) })

    // Fetch recent sessions
    supabase.from("focus_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => { if (data) setRecentSessions(data) })

    // Fetch today's sessions
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    supabase.from("focus_sessions")
      .select("fopo_earned, focus_minutes")
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString())
      .then(({ data }) => {
        if (data) {
          setTodayFopo(data.reduce((s, r) => s + (r.fopo_earned || 0), 0))
          setTodayMinutes(data.reduce((s, r) => s + (r.focus_minutes || 0), 0))
        }
      })

    // Fetch live heatmap data
    getHeatmapData(user.id, 7).then(setHeatmapData).catch(console.error)

    // Fetch leaderboard top 3
    supabase.from("fopo_points").select("user_id, total_fopo").order("total_fopo", { ascending: false }).limit(3)
      .then(async ({ data }) => {
        if (!data) return
        const enriched = await Promise.all(data.map(async (d, i) => {
          const { data: u } = await supabase.auth.admin?.getUserById?.(d.user_id).catch?.(() => ({ data: null })) || {}
          return {
            rank: i + 1,
            name: d.user_id === user.id ? "You" : `User ${i + 1}`,
            score: d.total_fopo,
            avatar: d.user_id === user.id
              ? (user.user_metadata?.username?.substring(0, 2).toUpperCase() || user.email?.substring(0, 2).toUpperCase() || "U")
              : `U${i + 1}`,
            isMe: d.user_id === user.id
          }
        }))
        setTopUsers(enriched)
      })
  }, [user])

  const greeting = () => {
    if (!time) return "Welcome"
    const hour = time.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  const username = user?.user_metadata?.username || user?.email?.split("@")[0] || "there"
  const focusHoursToday = Math.floor(todayMinutes / 60)
  const focusMinsToday = todayMinutes % 60
  const todayFocusStr = todayMinutes > 0 ? `${focusHoursToday}h ${focusMinsToday}m` : "0m"

  const dailyQuests = [
    {
      id: 1, label: "Complete 1 focus session", current: time ? recentSessions.filter(s => {
        const d = new Date(s.created_at); return d.toDateString() === time.toDateString()
      }).length : 0, target: 1, icon: Timer
    },
    { id: 2, label: "Earn 50 FoPo today", current: todayFopo, target: 50, icon: Target },
    { id: 3, label: "Focus for 25 minutes", current: todayMinutes, target: 25, icon: Flame },
  ]

  const allQuestsComplete = dailyQuests.every(q => q.current >= q.target)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{greeting()}, {username}</h1>
            <p className="text-sm text-muted-foreground">
              {time ? time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '\u00A0'}
            </p>
          </div>
          <Link href="/timer">
            <Button className="gap-2 bg-primary text-primary-foreground shadow-[0_0_20px_-5px] shadow-primary/40 hover:bg-primary/90">
              <Play className="h-4 w-4" />
              Start Focus Session
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Today's ZoFo", value: todayFopo.toLocaleString(), sub: todayFopo > 0 ? "Keep going!" : "Start a session to earn", subColor: todayFopo > 0 ? "text-green-400" : "text-muted-foreground", Icon: Target, bg: "bg-primary/10", color: "text-primary", SubIcon: todayFopo > 0 ? TrendingUp : null },
            { label: "Focus Time Today", value: todayFocusStr, sub: "Goal: 2h", subColor: "text-muted-foreground", Icon: Timer, bg: "bg-accent/10", color: "text-accent", SubIcon: null },
            { label: "Total FoPo", value: (fopoStats?.total_fopo ?? 0).toLocaleString(), sub: `Level ${fopoStats?.level ?? 1}`, subColor: "text-orange-400", Icon: Flame, bg: "bg-orange-500/10", color: "text-orange-400", SubIcon: Flame },
            { label: "Sessions Total", value: recentSessions.length.toString(), sub: recentSessions.length > 0 ? "View analytics for details" : "No sessions yet", subColor: "text-green-400", Icon: AlertTriangle, bg: "bg-yellow-500/10", color: "text-yellow-400", SubIcon: null },
          ].map((stat, i) => (
            <motion.div key={i} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-3xl font-bold text-foreground">{stat.value}</p>
                      <div className={`mt-2 flex items-center gap-1 text-sm ${stat.subColor}`}>
                        {stat.SubIcon && <stat.SubIcon className="h-4 w-4" />}
                        <span>{stat.sub}</span>
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

        {/* Focus Command Center */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants}>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card/80 to-accent/5 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                Focus Command Center
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid gap-6 md:grid-cols-3">
                {/* Today's Stats */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s Progress</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">FoPo Earned</span>
                      <span className="font-bold text-primary">{todayFopo.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${Math.min(100, (todayFopo / 200) * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Focus Time</span>
                      <span className="flex items-center gap-1 font-bold text-orange-400">
                        <Flame className="h-3 w-3" /> {todayFocusStr}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Heatmap mini preview */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Focus Activity</h4>
                  <div className="flex gap-1">
                    {dayLabels.map((d, i) => (
                      <div key={i} className="flex flex-col gap-1 items-center">
                        {heatmapData.slice(0, 4).map((week, w) => (
                          <div
                            key={w}
                            className={`h-4 w-4 rounded-sm heatmap-${week[i]}`}
                            title={`Intensity: ${week[i]}`}
                          />
                        ))}
                        <span className="text-[10px] text-muted-foreground mt-0.5">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Quest + CTA */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Quest</h4>
                  <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Earn 50 FoPo today</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (todayFopo / 50) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{todayFopo} / 50</p>
                  </div>
                  <Link href="/timer">
                    <Button className="w-full gap-2 bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 transition-all">
                      <Play className="h-4 w-4" />
                      Quick Start Focus
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Daily Quests + Streak Badges */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Daily Quest System */}
          <motion.div custom={5} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Daily Quests
                </CardTitle>
                <Link href="/quests" className="text-sm text-primary hover:text-primary/80">View All</Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {dailyQuests.map((quest) => {
                  const pct = Math.min(100, (quest.current / quest.target) * 100)
                  const done = quest.current >= quest.target
                  return (
                    <div key={quest.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {done
                            ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                            : <Circle className="h-4 w-4 text-muted-foreground" />
                          }
                          <span className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {quest.label}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{quest.current}/{quest.target}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${done ? "bg-green-400" : "bg-gradient-to-r from-primary to-accent"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}

                {/* Daily chest */}
                <button
                  onClick={() => allQuestsComplete && setChestOpened(true)}
                  className={`mt-4 flex w-full items-center gap-3 rounded-xl border p-4 transition-all ${allQuestsComplete
                    ? "border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20 cursor-pointer animate-pulse-glow"
                    : "border-border/30 bg-secondary/20 cursor-not-allowed opacity-60"
                    }`}
                >
                  <div className={`text-3xl ${allQuestsComplete && !chestOpened ? "animate-chest-shake" : ""}`}>
                    {chestOpened ? "✨" : "📦"}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {chestOpened ? "Daily Focus Chest Opened!" : "Daily Focus Chest"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {chestOpened ? "+250 bonus FoPo earned!" : allQuestsComplete ? "Tap to claim your reward!" : "Complete all quests to unlock"}
                    </p>
                  </div>
                  {allQuestsComplete && !chestOpened && (
                    <Gift className="ml-auto h-5 w-5 text-yellow-400" />
                  )}
                </button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Focus Streak Badges + Invite */}
          <div className="space-y-4">
            {/* Streak Badges */}
            <motion.div custom={6} initial="hidden" animate="visible" variants={cardVariants}>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Crown className="h-5 w-5 text-yellow-400" />
                    Focus Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    {streakBadges.map((badge) => (
                      <div
                        key={badge.days}
                        className={`flex-1 flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all ${badge.achieved
                          ? "border-primary/40 bg-primary/10 shadow-[0_0_15px_-5px] shadow-primary/40"
                          : "border-border/30 bg-secondary/20 opacity-50"
                          }`}
                      >
                        <span className="text-2xl">{badge.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{badge.days}d</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{badge.label.split('-')[1] || badge.label}</p>
                        </div>
                        {badge.achieved && (
                          <span className="text-[10px] font-medium text-primary">Earned ✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Invite Rewards */}
            <motion.div custom={7} initial="hidden" animate="visible" variants={cardVariants}>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <UserPlus className="h-5 w-5 text-accent" />
                    Invite & Earn
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {inviteRewards.map((r) => (
                    <div key={r.milestone} className="flex items-center gap-3 rounded-lg border border-border/30 bg-secondary/20 p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{r.label}</p>
                        <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{ width: `${(r.progress / r.milestone) * 100}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.progress}/{r.milestone} friends</p>
                      </div>
                      <div className={`text-right text-xs font-bold ${r.color}`}>
                        {r.reward}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10">
                    <UserPlus className="h-4 w-4" />
                    Invite Friends
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Focus Heatmap */}
        <motion.div custom={8} initial="hidden" animate="visible" variants={cardVariants}>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Weekly Focus Heatmap</CardTitle>
              <Link href="/analytics" className="text-sm text-primary hover:text-primary/80">Full Analytics</Link>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-2">
                <div className="flex flex-col gap-1.5 text-[10px] text-muted-foreground pr-2 font-medium">
                  {dayLabels.map((d, i) => (
                    <span key={i} className="h-6 flex items-center justify-end">{d}</span>
                  ))}
                </div>
                {heatmapData.map((week, w) => (
                  <div key={w} className="flex flex-col gap-1.5">
                    {week.map((intensity, d) => (
                      <div
                        key={d}
                        className={`h-6 w-6 rounded-md heatmap-${intensity} transition-transform hover:scale-110 cursor-default shadow-sm border border-black/10 dark:border-white/5`}
                        title={`Intensity: ${["None", "Low", "Medium", "High", "Deep Focus"][intensity]}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Less</span>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-3 w-3 rounded-sm heatmap-${i}`} />
                ))}
                <span>More</span>
              </div>
              {recentSessions.length === 0 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">Complete focus sessions to populate your heatmap</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Focus Efficiency */}
          <motion.div custom={9} initial="hidden" animate="visible" variants={cardVariants} className="lg:col-span-2">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground">Focus Summary</CardTitle>
                <Link href="/analytics" className="text-sm text-primary hover:text-primary/80">View Details</Link>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative flex h-48 w-48 items-center justify-center">
                    <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="efficiencyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="oklch(0.75 0.18 195)" />
                          <stop offset="100%" stopColor="oklch(0.65 0.20 265)" />
                        </linearGradient>
                      </defs>
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" className="text-secondary" />
                      <circle
                        cx="50" cy="50" r="45" fill="none"
                        stroke="url(#efficiencyGrad)" strokeWidth="10"
                        strokeDasharray={`${Math.min(100, (todayMinutes / 120) * 100) * 2.83} ${100 * 2.83}`}
                        strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 0 8px oklch(0.75 0.18 195 / 0.5))" }}
                      />
                    </svg>
                    <div className="text-center">
                      <p className="text-5xl font-bold text-foreground">{Math.min(100, Math.round((todayMinutes / 120) * 100))}%</p>
                      <p className="text-sm text-muted-foreground">Daily Goal</p>
                    </div>
                  </div>
                  <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-4 text-center">
                    {[
                      { v: todayFocusStr, l: "Focused Today" },
                      { v: recentSessions.length.toString(), l: "Sessions" },
                      { v: (fopoStats?.total_fopo ?? 0).toLocaleString(), l: "Total FoPo" }
                    ].map((s, i) => (
                      <div key={i}>
                        <p className="text-2xl font-bold text-foreground">{s.v}</p>
                        <p className="text-xs text-muted-foreground">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div custom={10} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { href: "/timer", Icon: Play, label: "Start Focus Session", sub: "25 min pomodoro", bg: "bg-primary/10", color: "text-primary" },
                  { href: "/planner", Icon: Zap, label: "AI Study Plan", sub: "Generate today's plan", bg: "bg-accent/10", color: "text-accent" },
                  { href: "/battles", Icon: Sword, label: "Focus Battle", sub: "Compete with friends", bg: "bg-red-500/10", color: "text-red-400" },
                  { href: "/achievements", Icon: Trophy, label: "View Achievements", sub: "See your badges", bg: "bg-orange-500/10", color: "text-orange-400" },
                ].map(({ href, Icon, label, sub, bg, color }) => (
                  <Link key={href} href={href} className="block">
                    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 p-4 transition-all hover:border-primary/50 hover:bg-secondary/50 group">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                        <Icon className={`h-5 w-5 ${color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{label}</p>
                        <p className="text-sm text-muted-foreground">{sub}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Sessions */}
          <motion.div custom={11} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground">Recent Sessions</CardTitle>
                <Link href="/analytics" className="text-sm text-primary hover:text-primary/80">View All</Link>
              </CardHeader>
              <CardContent>
                {recentSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Timer className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-muted-foreground">No sessions yet</p>
                    <p className="mt-1 text-sm text-muted-foreground/60">Start your first focus session to see it here!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentSessions.map((session, i) => {
                      const d = new Date(session.created_at)
                      let label = d.toLocaleDateString()
                      if (time) {
                        const yesterday = new Date(time); yesterday.setDate(yesterday.getDate() - 1)
                        if (d.toDateString() === time.toDateString()) label = "Today"
                        else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday"
                      }
                      return (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-border/30 bg-secondary/20 p-3 hover:bg-secondary/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Timer className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{label}</p>
                              <p className="text-sm text-muted-foreground">{session.focus_minutes}m focused</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">+{session.fopo_earned ?? 0} ZoFo</p>
                            <p className="text-sm text-green-400">{session.distractions ?? 0} distractions</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Leaderboard Preview */}
          <motion.div custom={12} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground">Top Performers</CardTitle>
                <Link href="/leaderboard" className="text-sm text-primary hover:text-primary/80">View Full Board</Link>
              </CardHeader>
              <CardContent>
                {topUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Trophy className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-muted-foreground">No users on the leaderboard yet</p>
                    <p className="mt-1 text-sm text-muted-foreground/60">Be the first to earn FoPo!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topUsers.map((u) => (
                      <div key={u.rank} className={`flex items-center justify-between rounded-lg border p-3 ${u.isMe ? 'border-primary/30 bg-primary/5' : 'border-border/30 bg-secondary/20'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${u.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' : u.rank === 2 ? 'bg-slate-300/20 text-slate-300' : 'bg-orange-500/20 text-orange-500'}`}>
                            <Trophy className="h-4 w-4" />
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                            {u.avatar}
                          </div>
                          <p className={`font-medium ${u.isMe ? 'text-primary' : 'text-foreground'}`}>{u.name}</p>
                        </div>
                        <p className={`font-semibold ${u.isMe ? 'text-primary' : 'text-foreground'}`}>{u.score.toLocaleString()} ZoFo</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
