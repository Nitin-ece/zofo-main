"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sword, Trophy, Clock, Users, Flame, Target, Play, Crown, Zap, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Battle {
    id: string
    name: string
    host: string
    participants: { name: string; avatar: string; fopo: number }[]
    duration: number
    status: "waiting" | "active" | "finished"
    timeLeft?: number
}

const mockBattles: Battle[] = [
    {
        id: "1", name: "Morning Focus Clash", host: "Alex Chen", status: "active", duration: 25 * 60, timeLeft: 847,
        participants: [
            { name: "Alex Chen", avatar: "AC", fopo: 312 },
            { name: "Maria Silva", avatar: "MS", fopo: 287 },
            { name: "Yuki Tanaka", avatar: "YT", fopo: 251 },
        ]
    },
    {
        id: "2", name: "Study Sprint", host: "Emma Wilson", status: "waiting", duration: 50 * 60,
        participants: [
            { name: "Emma Wilson", avatar: "EW", fopo: 0 },
            { name: "Hans Mueller", avatar: "HM", fopo: 0 },
        ]
    },
]

function LiveBattleView({ battle, onExit }: { battle: Battle; onExit: () => void }) {
    const [timeLeft, setTimeLeft] = useState(battle.timeLeft ?? battle.duration)
    const [myFoPo, setMyFoPo] = useState(0)
    const [isRunning, setIsRunning] = useState(false)
    const [leaderboard, setLeaderboard] = useState([
        { name: "You", avatar: "JD", fopo: 0, isMe: true },
        ...battle.participants.map(p => ({ ...p, isMe: false }))
    ])

    useEffect(() => {
        if (!isRunning) return
        const interval = setInterval(() => {
            setTimeLeft(t => Math.max(0, t - 1))
            setMyFoPo(f => f + 1)
            setLeaderboard(prev => prev.map(p => p.isMe ? { ...p, fopo: p.fopo + 1 } : { ...p, fopo: p.fopo + Math.random() > 0.4 ? 1 : 0 }).sort((a, b) => b.fopo - a.fopo))
        }, 1000)
        return () => clearInterval(interval)
    }, [isRunning])

    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`
    const winner = leaderboard[0]

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">{battle.name}</h2>
                    <p className="text-muted-foreground">Live Focus Battle</p>
                </div>
                <Button variant="outline" onClick={onExit} className="border-border">Exit Battle</Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Timer */}
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center py-8 gap-4">
                        <div className="relative flex h-48 w-48 items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
                            <div className="text-center z-10">
                                <p className="text-6xl font-bold tabular-nums text-foreground">{formatTime(timeLeft)}</p>
                                <p className="text-sm text-muted-foreground mt-2">Battle Timer</p>
                            </div>
                            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                                    strokeDasharray={`${((battle.duration - timeLeft) / battle.duration) * 283} 283`}
                                    strokeLinecap="round" style={{ transition: "stroke-dasharray 1s linear" }} />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-primary">{myFoPo}</p>
                            <p className="text-sm text-muted-foreground">Your FoPo this battle</p>
                        </div>
                        <Button
                            onClick={() => setIsRunning(r => !r)}
                            className={`w-full gap-2 ${isRunning ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-gradient-to-r from-primary to-accent text-white"}`}
                        >
                            {isRunning ? <><Flame className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4 ml-0.5" /> Start Focusing</>}
                        </Button>
                    </CardContent>
                </Card>

                {/* Live Leaderboard */}
                <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                            <Trophy className="h-5 w-5 text-yellow-400" /> Live Leaderboard
                            <span className="ml-auto flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {leaderboard.map((p, i) => (
                                <motion.div
                                    key={p.name}
                                    layout
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${p.isMe ? "border-primary/40 bg-primary/10" : "border-border/30 bg-secondary/20"
                                        }`}
                                >
                                    <span className={`text-lg font-bold w-8 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-orange-500"}`}>
                                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                                    </span>
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${p.isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                                        {p.avatar ?? p.name.slice(0, 2)}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-medium ${p.isMe ? "text-primary" : "text-foreground"}`}>{p.name}{p.isMe ? " (You)" : ""}</p>
                                        <div className="mt-1 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                                                style={{ width: leaderboard[0].fopo > 0 ? `${(p.fopo / leaderboard[0].fopo) * 100}%` : "0%" }} />
                                        </div>
                                    </div>
                                    <p className={`font-bold text-lg ${p.isMe ? "text-primary" : "text-foreground"}`}>{p.fopo}</p>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {timeLeft === 0 && (
                            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
                                <p className="text-2xl mb-1">🏆</p>
                                <p className="font-bold text-foreground text-lg">{winner.name} wins!</p>
                                <p className="text-sm text-muted-foreground">+100 bonus FoPo awarded</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function BattlesPage() {
    const [activeBattle, setActiveBattle] = useState<Battle | null>(null)
    const [showCreate, setShowCreate] = useState(false)

    if (activeBattle) return <LiveBattleView battle={activeBattle} onExit={() => setActiveBattle(null)} />

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="flex h-16 items-center justify-between px-6">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            Focus Battles
                            <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500 border border-yellow-500/20">
                                Demo Mode
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">Compete in real-time focus sessions</p>
                    </div>
                    <Button onClick={() => setShowCreate(true)} className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90">
                        <Plus className="h-4 w-4" /> Create Battle
                    </Button>
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* Hero */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-primary/5 backstop-blur-sm overflow-hidden relative">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.08),transparent_70%)]" />
                        <CardContent className="relative p-8">
                            <div className="flex items-center gap-6">
                                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-accent/20">
                                    <Sword className="h-10 w-10 text-accent" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground">Focus Battles</h2>
                                    <p className="text-muted-foreground mt-1">Challenge friends to synchronized focus sessions. The user who earns the most FoPo wins bonus points and a battle badge!</p>
                                    <div className="mt-3 flex gap-4 text-sm">
                                        <span className="flex items-center gap-1 text-yellow-400"><Trophy className="h-4 w-4" /> Winner gets +100 bonus FoPo</span>
                                        <span className="flex items-center gap-1 text-primary"><Zap className="h-4 w-4" /> Real-time competition</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Active Battles */}
                <div>
                    <h2 className="text-lg font-semibold text-foreground mb-4">Live Battles</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {mockBattles.map((battle, i) => (
                            <motion.div key={battle.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                                <Card className={`border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors ${battle.status === "active" ? "border-red-500/20" : ""}`}>
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-foreground">{battle.name}</h3>
                                                    {battle.status === "active" && (
                                                        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE
                                                        </span>
                                                    )}
                                                    {battle.status === "waiting" && (
                                                        <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400">Waiting</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-0.5">Hosted by {battle.host}</p>
                                            </div>
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                {Math.floor(battle.duration / 60)} min
                                            </div>
                                        </div>

                                        {/* Participants preview */}
                                        <div className="flex items-center gap-2 mb-4">
                                            {battle.participants.map((p, pi) => (
                                                <div key={pi} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground border-2 border-background">
                                                    {p.avatar}
                                                </div>
                                            ))}
                                            <span className="text-sm text-muted-foreground ml-1">{battle.participants.length} focusers</span>
                                        </div>

                                        {/* Live fopo preview */}
                                        {battle.status === "active" && (
                                            <div className="mb-4 space-y-1.5">
                                                {battle.participants.slice(0, 2).map((p, pi) => (
                                                    <div key={pi} className="flex items-center gap-2 text-sm">
                                                        <span className="w-20 truncate text-muted-foreground">{p.name}</span>
                                                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                                            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                                                                style={{ width: `${(p.fopo / 400) * 100}%` }} />
                                                        </div>
                                                        <span className="font-medium text-foreground w-8 text-right">{p.fopo}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <Button onClick={() => setActiveBattle(battle)}
                                            className={`w-full gap-2 ${battle.status === "active" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                                            <Sword className="h-4 w-4" />
                                            {battle.status === "active" ? "Join Battle" : "Get Ready"}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Your Battle Stats */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-foreground">Your Battle Record</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                {[
                                    { value: "8", label: "Battles Won", icon: "🏆", color: "text-yellow-400" },
                                    { value: "3", label: "Battles Lost", icon: "⚔️", color: "text-muted-foreground" },
                                    { value: "+840", label: "Bonus FoPo Earned", icon: "⚡", color: "text-primary" },
                                ].map((stat, i) => (
                                    <div key={i} className="rounded-xl border border-border/30 bg-secondary/20 p-4">
                                        <span className="text-2xl">{stat.icon}</span>
                                        <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
