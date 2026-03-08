"use client"

import { useState, useEffect } from "react"
import { Award, Lock, CheckCircle2, Trophy, Flame, Target, Clock, Zap, Star, Crown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"

// ── Level definitions ─────────────────────────────────────────────────

const LEVEL_THRESHOLDS = [
  { level: 1, name: "Novice", minXP: 0 },
  { level: 2, name: "Beginner", minXP: 500 },
  { level: 3, name: "Learner", minXP: 1200 },
  { level: 5, name: "Apprentice", minXP: 2500 },
  { level: 8, name: "Focused", minXP: 5000 },
  { level: 10, name: "Dedicated", minXP: 8000 },
  { level: 15, name: "Expert", minXP: 20000 },
  { level: 20, name: "Master", minXP: 45000 },
  { level: 25, name: "Grandmaster", minXP: 80000 },
]

function getLevelInfo(totalXP: number) {
  let currentLevel = LEVEL_THRESHOLDS[0]
  let nextLevel = LEVEL_THRESHOLDS[1] || { ...LEVEL_THRESHOLDS[0], minXP: LEVEL_THRESHOLDS[0].minXP + 1000 }

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXP >= LEVEL_THRESHOLDS[i].minXP) {
      currentLevel = LEVEL_THRESHOLDS[i]
      nextLevel = LEVEL_THRESHOLDS[i + 1] || { level: currentLevel.level + 1, name: "Legend", minXP: currentLevel.minXP + 20000 }
    }
  }

  const progress = nextLevel.minXP > currentLevel.minXP
    ? ((totalXP - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100
    : 100

  return { currentLevel, nextLevel, progress: Math.min(100, Math.max(0, progress)) }
}

// ── Achievement definitions (thresholds, computed dynamically) ────────

interface AchievementDef {
  name: string
  description: string
  threshold: number
}

const ACHIEVEMENT_DEFS: {
  category: string
  icon: any
  metric: string
  items: AchievementDef[]
}[] = [
    {
      category: "Focus",
      icon: Target,
      metric: "totalMinutes",
      items: [
        { name: "First Focus", description: "Complete your first focus session", threshold: 1 },
        { name: "Hour Hero", description: "Focus for a total of 1 hour", threshold: 60 },
        { name: "Focus Warrior", description: "Focus for a total of 10 hours", threshold: 600 },
        { name: "Deep Worker", description: "Focus for a total of 100 hours", threshold: 6000 },
        { name: "Focus Legend", description: "Focus for a total of 500 hours", threshold: 30000 },
      ]
    },
    {
      category: "Sessions",
      icon: Clock,
      metric: "sessionCount",
      items: [
        { name: "Getting Started", description: "Complete 1 session", threshold: 1 },
        { name: "Regular", description: "Complete 10 sessions", threshold: 10 },
        { name: "Consistent", description: "Complete 50 sessions", threshold: 50 },
        { name: "Dedicated", description: "Complete 200 sessions", threshold: 200 },
        { name: "Veteran", description: "Complete 1,000 sessions", threshold: 1000 },
      ]
    },
    {
      category: "ZoFo Points",
      icon: Star,
      metric: "totalFoPo",
      items: [
        { name: "Point Collector", description: "Earn 100 ZoFo", threshold: 100 },
        { name: "Point Hoarder", description: "Earn 1,000 ZoFo", threshold: 1000 },
        { name: "Point Master", description: "Earn 10,000 ZoFo", threshold: 10000 },
        { name: "Point Tycoon", description: "Earn 50,000 ZoFo", threshold: 50000 },
        { name: "ZoFo Millionaire", description: "Earn 1,000,000 ZoFo", threshold: 1000000 },
      ]
    },
    {
      category: "Efficiency",
      icon: Zap,
      metric: "zeroDistractionSessions",
      items: [
        { name: "No Distractions", description: "Complete 1 session with 0 distractions", threshold: 1 },
        { name: "Laser Focus", description: "Complete 5 distraction-free sessions", threshold: 5 },
        { name: "Perfect Day", description: "Complete 10 distraction-free sessions", threshold: 10 },
        { name: "Focus Machine", description: "Complete 50 distraction-free sessions", threshold: 50 },
        { name: "Zen Master", description: "Complete 100 distraction-free sessions", threshold: 100 },
      ]
    },
  ]

const BADGE_DEFS = [
  { name: "Bronze", minLevel: 1, icon: Award, color: "text-orange-600", bgColor: "bg-orange-600/10", borderColor: "border-orange-600/30" },
  { name: "Silver", minLevel: 3, icon: Award, color: "text-slate-400", bgColor: "bg-slate-400/10", borderColor: "border-slate-400/30" },
  { name: "Gold", minLevel: 8, icon: Award, color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/30" },
  { name: "Platinum", minLevel: 15, icon: Crown, color: "text-cyan-400", bgColor: "bg-cyan-400/10", borderColor: "border-cyan-400/30" },
  { name: "Diamond", minLevel: 20, icon: Crown, color: "text-blue-400", bgColor: "bg-blue-400/10", borderColor: "border-blue-400/30" },
]

// ── Component ────────────────────────────────────────────────────────

export default function AchievementsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [totalFoPo, setTotalFoPo] = useState(0)
  const [dbLevel, setDbLevel] = useState(1)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [zeroDistractionSessions, setZeroDistractionSessions] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setIsLoading(false); return }

      // Fetch FoPo stats
      supabase.from("fopo_points").select("total_fopo, level").eq("user_id", user.id).single()
        .then(({ data }) => {
          if (data) {
            setTotalFoPo(data.total_fopo || 0)
            setDbLevel(data.level || 1)
          }
        })

      // Fetch focus session stats
      supabase.from("focus_sessions").select("focus_minutes, distractions").eq("user_id", user.id)
        .then(({ data }) => {
          if (data) {
            setTotalMinutes(data.reduce((sum, s) => sum + (s.focus_minutes || 0), 0))
            setSessionCount(data.length)
            setZeroDistractionSessions(data.filter(s => (s.distractions || 0) === 0).length)
          }
          setIsLoading(false)
        })
    })
  }, [])

  // Compute level from real FoPo
  const { currentLevel, nextLevel, progress } = getLevelInfo(totalFoPo)

  // Metrics map for achievement lookups
  const metrics: Record<string, number> = {
    totalMinutes,
    sessionCount,
    totalFoPo,
    zeroDistractionSessions,
  }

  // Compute achievements dynamically
  const computedAchievements = ACHIEVEMENT_DEFS.map(cat => ({
    ...cat,
    items: cat.items.map(item => {
      const current = metrics[cat.metric] || 0
      const pct = Math.min(100, Math.round((current / item.threshold) * 100))
      return { ...item, unlocked: current >= item.threshold, progress: pct }
    })
  }))

  const unlockedCount = computedAchievements.reduce((acc, cat) => acc + cat.items.filter(i => i.unlocked).length, 0)
  const totalCount = computedAchievements.reduce((acc, cat) => acc + cat.items.length, 0)

  const badges = BADGE_DEFS.map(b => ({ ...b, unlocked: currentLevel.level >= b.minLevel }))

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center px-6">
            <h1 className="text-lg font-semibold text-foreground">Achievements</h1>
          </div>
        </header>
        <div className="flex items-center justify-center p-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading your achievements...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Achievements</h1>
            <p className="text-sm text-muted-foreground">Track your progress and unlock rewards</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-4 py-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <span className="font-semibold text-foreground">{unlockedCount}/{totalCount}</span>
              <span className="text-sm text-muted-foreground">Unlocked</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Level Progress */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 md:flex-row">
              {/* Level Badge */}
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary bg-primary/10">
                  <span className="text-3xl font-bold text-primary">{currentLevel.level}</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  {currentLevel.name}
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Progress to Level {nextLevel.level}</span>
                  <span className="text-sm font-medium text-foreground">{totalFoPo.toLocaleString()} / {nextLevel.minXP.toLocaleString()} XP</span>
                </div>
                <Progress value={progress} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {Math.max(0, nextLevel.minXP - totalFoPo).toLocaleString()} XP needed for next level
                </p>
              </div>
            </div>

            {/* Level Timeline */}
            <div className="mt-8 flex items-center justify-between overflow-x-auto pb-2">
              {LEVEL_THRESHOLDS.filter((_, i) => i % 2 === 0 || i === LEVEL_THRESHOLDS.length - 1).map((level, i, arr) => {
                const isUnlocked = totalFoPo >= level.minXP
                const isCurrent = totalFoPo >= level.minXP && (i === arr.length - 1 || totalFoPo < (arr[i + 1]?.minXP ?? Infinity))
                return (
                  <div key={level.level} className="flex flex-col items-center min-w-[80px]">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : isUnlocked
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}>
                      {isUnlocked ? <CheckCircle2 className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                    </div>
                    <p className={`mt-2 text-xs font-medium ${isUnlocked ? "text-foreground" : "text-muted-foreground"}`}>
                      Lvl {level.level}
                    </p>
                    <p className={`text-xs ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                      {level.name}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Badges */}
        <Card className="mt-6 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Badges</CardTitle>
            <CardDescription>Collect badges as you level up</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              {badges.map((badge) => (
                <div
                  key={badge.name}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-all ${badge.unlocked
                      ? `${badge.borderColor} ${badge.bgColor}`
                      : "border-border/30 bg-secondary/10 opacity-50"
                    }`}
                >
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full ${badge.bgColor}`}>
                    <badge.icon className={`h-8 w-8 ${badge.unlocked ? badge.color : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-sm font-medium ${badge.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                    {badge.name}
                  </span>
                  {!badge.unlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Achievement Categories */}
        {computedAchievements.map((category) => (
          <Card key={category.category} className="mt-6 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <category.icon className="h-5 w-5 text-primary" />
                {category.category}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {category.items.map((achievement, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-4 transition-all ${achievement.unlocked
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/30 bg-secondary/10"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${achievement.unlocked ? "bg-primary/20" : "bg-secondary"
                        }`}>
                        {achievement.unlocked ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${achievement.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                          {achievement.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                        {!achievement.unlocked && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="text-foreground">{achievement.progress}%</span>
                            </div>
                            <Progress value={achievement.progress} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
