"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Circle, Timer, Target, AlertTriangle, Gift, Crown, Flame, Star, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Quest {
    id: number
    label: string
    description: string
    current: number
    target: number
    icon: any
    reward: string
    completed: boolean
}

const initialQuests: Quest[] = [
    { id: 1, label: "Focus Warrior", description: "Complete 3 focus sessions today", current: 2, target: 3, icon: Timer, reward: "+50 FoPo", completed: false },
    { id: 2, label: "FoPo Hunter", description: "Earn 120 FoPo in total today", current: 89, target: 120, icon: Target, reward: "+30 FoPo", completed: false },
    { id: 3, label: "Distraction Slayer", description: "Keep distractions under 5 today", current: 3, target: 5, icon: AlertTriangle, reward: "+40 FoPo", completed: false },
    { id: 4, label: "Early Bird", description: "Start a session before 9 AM", current: 1, target: 1, icon: Star, reward: "+25 FoPo", completed: true },
    { id: 5, label: "Study Buddy", description: "Join a ZoFo Room session", current: 0, target: 1, icon: Zap, reward: "+30 FoPo", completed: false },
]

const streakBadges = [
    { days: 7, label: "7-Day Streak", icon: "🔥", earned: true, desc: "7 consecutive days of focus" },
    { days: 14, label: "2-Week Champion", icon: "⚡", earned: false, desc: "14 consecutive days" },
    { days: 30, label: "30-Day Master", icon: "💜", earned: false, desc: "30 consecutive days" },
    { days: 60, label: "60-Day Elite", icon: "🌟", earned: false, desc: "60 consecutive days" },
    { days: 100, label: "100-Day Legend", icon: "👑", earned: false, desc: "100 consecutive days" },
    { days: 365, label: "Year of Focus", icon: "🏆", earned: false, desc: "365 consecutive days" },
]

const weeklyHistory = [
    { day: "Mon", done: true },
    { day: "Tue", done: true },
    { day: "Wed", done: true },
    { day: "Thu", done: true },
    { day: "Fri", done: true },
    { day: "Sat", done: true },
    { day: "Sun", done: false },
]

export default function QuestsPage() {
    const [quests, setQuests] = useState(initialQuests)
    const [chestOpened, setChestOpened] = useState(false)
    const [chestAnimating, setChestAnimating] = useState(false)

    const allDone = quests.filter(q => !q.completed).every(q => q.current >= q.target)
    const completedCount = quests.filter(q => q.completed || q.current >= q.target).length

    const handleOpenChest = () => {
        if (!allDone || chestOpened) return
        setChestAnimating(true)
        setTimeout(() => {
            setChestOpened(true)
            setChestAnimating(false)
        }, 600)
    }

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="flex h-16 items-center justify-between px-6">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            Daily Quests
                            <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500 border border-yellow-500/20">
                                Demo Mode
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">Complete missions to earn bonus FoPo</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2">
                        <Flame className="h-4 w-4 text-orange-400" />
                        <span className="font-semibold text-orange-400">12 Day Streak</span>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* Progress Overview */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Today&apos;s Quests</h2>
                                    <p className="text-muted-foreground text-sm">{completedCount}/{quests.length} completed</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-primary">{Math.round((completedCount / quests.length) * 100)}%</p>
                                    <p className="text-xs text-muted-foreground">Complete</p>
                                </div>
                            </div>
                            <div className="h-3 rounded-full bg-secondary overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(completedCount / quests.length) * 100}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                                />
                            </div>
                            {/* Week streak dots */}
                            <div className="mt-4 flex gap-2">
                                {weeklyHistory.map((day, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${day.done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                                            {day.done ? "✓" : "○"}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">{day.day}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Quest list */}
                    <div className="lg:col-span-2 space-y-3">
                        {quests.map((quest, i) => {
                            const Icon = quest.icon
                            const isDone = quest.completed || quest.current >= quest.target
                            const pct = Math.min(100, (quest.current / quest.target) * 100)
                            return (
                                <motion.div key={quest.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                                    <Card className={`border-border/50 backdrop-blur-sm transition-colors ${isDone ? "bg-green-500/5 border-green-500/20" : "bg-card/50 hover:border-primary/20"}`}>
                                        <CardContent className="p-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isDone ? "bg-green-500/20" : "bg-primary/10"}`}>
                                                    {isDone
                                                        ? <CheckCircle2 className="h-6 w-6 text-green-400" />
                                                        : <Icon className="h-6 w-6 text-primary" />
                                                    }
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <p className={`font-semibold ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>{quest.label}</p>
                                                            <p className="text-sm text-muted-foreground">{quest.description}</p>
                                                        </div>
                                                        <span className={`text-xs font-bold ${isDone ? "text-green-400" : "text-primary"}`}>{quest.reward}</span>
                                                    </div>
                                                    <div className="mt-2 space-y-1">
                                                        <div className="flex justify-between text-xs text-muted-foreground">
                                                            <span>{quest.current}/{quest.target}</span>
                                                            <span>{Math.round(pct)}%</span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ delay: i * 0.07 + 0.3, duration: 0.6 }}
                                                                className={`h-full rounded-full ${isDone ? "bg-green-400" : "bg-gradient-to-r from-primary to-accent"}`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Chest + Badges */}
                    <div className="space-y-6">
                        {/* Daily chest */}
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                            <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${allDone && !chestOpened ? "border-yellow-500/30 shadow-[0_0_30px_-10px] shadow-yellow-500/30" : ""}`}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-foreground">
                                        <Gift className="h-5 w-5 text-yellow-400" /> Daily Focus Chest
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center gap-4 py-6">
                                    <AnimatePresence mode="wait">
                                        {chestOpened ? (
                                            <motion.div key="opened" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl">✨</motion.div>
                                        ) : (
                                            <motion.div
                                                key="closed"
                                                className={`text-6xl cursor-pointer select-none ${chestAnimating ? "animate-chest-shake" : allDone ? "animate-pulse-glow" : ""}`}
                                                onClick={handleOpenChest}
                                            >
                                                📦
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {chestOpened ? (
                                        <div className="text-center">
                                            <p className="font-bold text-lg text-foreground">Chest Opened!</p>
                                            <p className="text-primary font-bold text-xl">+250 Bonus FoPo</p>
                                            <p className="text-sm text-muted-foreground mt-1">See you tomorrow!</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <p className="font-bold text-foreground">{allDone ? "Claim Your Reward!" : "Complete All Quests"}</p>
                                            <p className="text-sm text-muted-foreground mt-1">{allDone ? "Tap the chest to open!" : `${quests.length - completedCount} quests remaining`}</p>
                                        </div>
                                    )}
                                    {allDone && !chestOpened && (
                                        <Button onClick={handleOpenChest} className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold hover:opacity-90">
                                            <Gift className="h-4 w-4" /> Open Chest!
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Streak Badges */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-foreground">
                                        <Crown className="h-5 w-5 text-yellow-400" /> Focus Milestones
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {streakBadges.map((badge, i) => (
                                        <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${badge.earned ? "border-primary/30 bg-primary/10 shadow-[0_0_15px_-5px] shadow-primary/30" : "border-border/20 bg-secondary/10 opacity-50"
                                            }`}>
                                            <span className="text-xl">{badge.icon}</span>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-foreground">{badge.label}</p>
                                                <p className="text-xs text-muted-foreground">{badge.desc}</p>
                                            </div>
                                            {badge.earned && <span className="text-xs font-bold text-green-400">✓ Earned</span>}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    )
}
