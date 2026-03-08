"use client"

import { useState, useRef, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { uploadAvatar } from "@/lib/database"
import {
  Target, Timer, Flame, Trophy, Calendar, TrendingUp,
  Edit2, Camera, Award
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { toast } from "sonner"

// ── Helpers ──────────────────────────────────────────────────────────

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── Component ────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fopoStats, setFopoStats] = useState<{ total_fopo: number; level: number } | null>(null)
  const [focusStats, setFocusStats] = useState<{ totalMinutes: number; sessionCount: number; zeroDistractions: number } | null>(null)
  const [weeklyChart, setWeeklyChart] = useState<{ day: string; zofo: number }[]>([])
  const [streakDays, setStreakDays] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      setUserData({
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username || user.email?.split("@")[0] || "User",
        avatar_url: user.user_metadata?.avatar_url,
        created_at: user.created_at
      })

      // Fetch FoPo stats
      supabase.from("fopo_points").select("total_fopo, level").eq("user_id", user.id).single()
        .then(({ data }) => { if (data) setFopoStats(data) })

      // Fetch focus sessions for stats + chart + streaks
      supabase.from("focus_sessions").select("focus_minutes, distractions, fopo_earned, start_time")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true })
        .then(({ data }) => {
          if (!data || data.length === 0) {
            setFocusStats({ totalMinutes: 0, sessionCount: 0, zeroDistractions: 0 })
            // Empty 7-day chart
            const empty = []
            for (let i = 6; i >= 0; i--) {
              const d = new Date(); d.setDate(d.getDate() - i)
              empty.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), zofo: 0 })
            }
            setWeeklyChart(empty)
            return
          }

          // Stats
          const totalMinutes = data.reduce((s, r) => s + (r.focus_minutes || 0), 0)
          const zeroDistractions = data.filter(r => (r.distractions || 0) === 0).length
          setFocusStats({ totalMinutes, sessionCount: data.length, zeroDistractions })

          // Build 7-day chart from real data
          const dailyMap = new Map<string, number>()
          data.forEach(s => {
            const dateKey = s.start_time?.split("T")[0]
            if (dateKey) {
              dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + (s.fopo_earned || 0))
            }
          })

          const chart = []
          for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
            const dayName = d.toLocaleDateString("en-US", { weekday: "short" })
            chart.push({ day: dayName, zofo: dailyMap.get(key) || 0 })
          }
          setWeeklyChart(chart)

          // Compute streak from session dates
          const uniqueDates = [...new Set(data.map(s => s.start_time?.split("T")[0]).filter(Boolean))].sort()
          let current = 0
          let best = 0
          let streak = 1

          const today = new Date()
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

          if (uniqueDates.length > 0) {
            // Check consecutive days from the end
            for (let i = uniqueDates.length - 1; i > 0; i--) {
              const curr = new Date(uniqueDates[i])
              const prev = new Date(uniqueDates[i - 1])
              const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
              if (diffDays === 1) {
                streak++
              } else {
                break
              }
            }

            // Only count as current streak if last session date is today or yesterday
            const lastDate = uniqueDates[uniqueDates.length - 1]
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
            const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`

            if (lastDate === todayStr || lastDate === yesterdayStr) {
              current = streak
            } else {
              current = 0
            }

            // Calculate best streak across all dates
            let tempStreak = 1
            best = 1
            for (let i = 1; i < uniqueDates.length; i++) {
              const curr = new Date(uniqueDates[i])
              const prev = new Date(uniqueDates[i - 1])
              const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
              if (diffDays === 1) {
                tempStreak++
                best = Math.max(best, tempStreak)
              } else {
                tempStreak = 1
              }
            }
          }

          setStreakDays(current)
          setBestStreak(best)
        })
    })
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userData?.id) return
    try {
      setIsUploading(true)
      const newAvatarUrl = await uploadAvatar(userData.id, file)
      setUserData((prev: any) => ({ ...prev, avatar_url: newAvatarUrl }))
      toast.success("Avatar updated!")
    } catch (error) {
      toast.error("Failed to upload avatar. Ensure the 'avatars' bucket exists and is public.")
    } finally {
      setIsUploading(false)
    }
  }

  // Computed achievements based on real data
  const achievements = [
    { name: "First Focus", description: "Complete your first session", icon: "🎯", unlocked: (focusStats?.sessionCount || 0) >= 1 },
    { name: "Hour Hero", description: "Focus for 1 hour total", icon: "⏰", unlocked: (focusStats?.totalMinutes || 0) >= 60 },
    { name: "Streak Starter", description: "Maintain a 3-day streak", icon: "🔥", unlocked: bestStreak >= 3 },
    { name: "No Distractions", description: "Complete a distraction-free session", icon: "🧘", unlocked: (focusStats?.zeroDistractions || 0) >= 1 },
    { name: "Level 5", description: "Reach Level 5", icon: "⭐", unlocked: (fopoStats?.level || 1) >= 5 },
    { name: "Marathon", description: "Focus 8+ hours in one day", icon: "🏃", unlocked: false }, // Would need daily aggregation
  ]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground">Your productivity journey</p>
          </div>
          <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="gap-2 border-border">
            <Edit2 className="h-4 w-4" /> Edit Profile
          </Button>
        </div>
      </header>

      <div className="p-6">
        {/* Profile Header */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
              {/* Avatar */}
              <div className="relative">
                {userData?.avatar_url ? (
                  <img src={userData.avatar_url} alt="Avatar" className="h-32 w-32 rounded-full border-4 border-primary object-cover" />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-primary bg-primary/10 text-4xl font-bold text-primary">
                    {userData?.username ? userData.username.substring(0, 2).toUpperCase() : "??"}
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} disabled={isUploading} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-secondary text-muted-foreground hover:text-foreground ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <Camera className="h-4 w-4" />
                </button>
                {/* Level badge */}
                <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg">
                  {fopoStats?.level ?? 1}
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-foreground">{userData?.username || "Loading..."}</h2>
                <p className="text-muted-foreground">@{userData?.username?.toLowerCase().replace(/\s+/g, "") || "user"}</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Welcome to your ZoFo Profile! Complete focus sessions to level up.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 md:justify-start">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {userData?.created_at ? new Date(userData.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span>{fopoStats ? `Level ${fopoStats.level}` : "New User"}</span>
                  </div>
                </div>
              </div>

              {/* Level Progress */}
              <div className="w-full max-w-xs rounded-lg border border-border/50 bg-secondary/30 p-4 md:w-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Level {fopoStats?.level ?? 1}</span>
                  <span className="text-muted-foreground">Level {(fopoStats?.level ?? 1) + 1}</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: fopoStats ? `${((fopoStats.total_fopo % 1000) / 1000) * 100}%` : "0%" }} />
                </div>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {fopoStats ? `${fopoStats.total_fopo % 1000} / 1,000 FoPo` : "0 / 1,000 FoPo"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total ZoFo", value: fopoStats?.total_fopo?.toLocaleString() ?? "0", Icon: Target, bg: "bg-primary/10", color: "text-primary" },
            { label: "Focus Time", value: focusStats ? formatDuration(focusStats.totalMinutes) : "0m", Icon: Timer, bg: "bg-accent/10", color: "text-accent" },
            { label: "Sessions", value: String(focusStats?.sessionCount ?? 0), Icon: Flame, bg: "bg-orange-500/10", color: "text-orange-400" },
            { label: "Level", value: String(fopoStats?.level ?? 1), Icon: Award, bg: "bg-yellow-500/10", color: "text-yellow-400" },
          ].map((card, i) => (
            <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.bg}`}>
                    <card.Icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* ZoFo Growth Chart — REAL DATA */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <TrendingUp className="h-5 w-5 text-primary" />
                ZoFo This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {weeklyChart.every(d => d.zofo === 0) ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Complete focus sessions to see your progress chart</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyChart}>
                      <defs>
                        <linearGradient id="profileGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="var(--color-muted-foreground, #888)" tick={{ fill: "var(--color-muted-foreground, #888)", fontSize: 12 }} tickMargin={10} />
                      <YAxis stroke="var(--color-muted-foreground, #888)" tick={{ fill: "var(--color-muted-foreground, #888)", fontSize: 12 }} tickMargin={10} width={50} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card, #222)",
                          border: "1px solid var(--color-border, #444)",
                          borderRadius: "12px",
                          color: "var(--color-foreground, #fff)",
                          boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)"
                        }}
                        itemStyle={{ color: "var(--color-primary, #6366f1)", fontWeight: "bold" }}
                      />
                      <Area type="monotone" dataKey="zofo" stroke="var(--color-primary, #6366f1)" strokeWidth={3} fill="url(#profileGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Streak Section — REAL DATA */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Flame className="h-5 w-5 text-orange-400" />
                Focus Streaks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current Streak */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                        <Flame className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Current Streak</p>
                        <p className="text-sm text-muted-foreground">
                          {streakDays > 0 ? "Keep it going!" : "Start a session today!"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{streakDays} day{streakDays !== 1 ? "s" : ""}</p>
                      <p className={`text-sm ${streakDays > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                        {streakDays > 0 ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Best Streak */}
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Best Streak</span>
                    <span className="flex items-center gap-1 font-bold text-yellow-500">
                      <Trophy className="h-4 w-4" />
                      {bestStreak} day{bestStreak !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Motivational message */}
                {streakDays === 0 && (
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Complete a focus session today to start your streak! 🔥</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievements — from REAL DATA */}
        <Card className="mt-6 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Award className="h-5 w-5 text-yellow-400" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {achievements.map((achievement, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-4 transition-all ${achievement.unlocked
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/30 bg-secondary/10 opacity-50"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{achievement.icon}</span>
                    <div>
                      <p className={`font-medium ${achievement.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                        {achievement.name}
                      </p>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      {achievement.unlocked && <p className="mt-1 text-xs text-primary">Unlocked</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
