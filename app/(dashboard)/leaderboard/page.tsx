"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Trophy, Medal, Search, Target, Globe, GraduationCap, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { getLeaderboardWithDaily } from "@/lib/database"
import { useAuth } from "@/components/auth-provider"

const podiumColors = {
  1: { border: "border-yellow-500", bg: "bg-yellow-500/15", badgeBg: "bg-yellow-500", shadow: "shadow-yellow-500/30", text: "text-yellow-500", size: "h-24 w-24" },
  2: { border: "border-slate-400", bg: "bg-slate-400/10", badgeBg: "bg-slate-400", shadow: "shadow-slate-400/20", text: "text-slate-400", size: "h-20 w-20" },
  3: { border: "border-orange-500", bg: "bg-orange-500/10", badgeBg: "bg-orange-500", shadow: "shadow-orange-500/20", text: "text-orange-500", size: "h-18 w-18" },
}
const podiumHeights = { 1: "h-32", 2: "h-24", 3: "h-16" }
const podiumOrder = [2, 1, 3]

interface LeaderboardEntry {
  rank: number
  user_id: string
  name: string
  avatar: string
  total_fopo: number
  daily_fopo: number
  level: number
  isMe: boolean
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"global" | "campus">("global")
  const [lbData, setLbData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      // Get all real users who have earned FoPo, sorted by total desc
      const raw = await getLeaderboardWithDaily()

      // Enrich each entry with a display name from auth metadata
      // We fetch the current user's metadata to label "You", and anonymize others
      const enriched: LeaderboardEntry[] = raw.map((entry, i) => {
        const isMe = entry.user_id === user?.id
        const avatar = isMe
          ? (user?.user_metadata?.username?.substring(0, 2).toUpperCase() || user?.email?.substring(0, 2).toUpperCase() || "U")
          : `#${i + 1}`
        const name = isMe
          ? (user?.user_metadata?.username || user?.email?.split("@")[0] || "You")
          : `ZoFo User ${i + 1}`
        return {
          rank: i + 1,
          user_id: entry.user_id,
          name,
          avatar,
          total_fopo: entry.total_fopo,
          daily_fopo: entry.daily_fopo,
          level: entry.level,
          isMe,
        }
      })

      setLbData(enriched)

      // Find the current user's position
      const me = enriched.find(e => e.isMe) ?? null
      setMyEntry(me)
      setLastRefresh(new Date())
    } catch (err) {
      console.error("Leaderboard fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchLeaderboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const filteredData = lbData.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const top3 = lbData.slice(0, 3)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Global Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Real users · Sorted by Total FoPo · Updates live</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search users..." className="w-56 border-border bg-input pl-9"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={fetchLeaderboard} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Tab selector */}
        <div className="mb-6 flex gap-2">
          <button onClick={() => setActiveTab("global")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "global" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
            <Globe className="h-4 w-4" /> Global Rankings
          </button>
          <button onClick={() => setActiveTab("campus")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "campus" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
            <GraduationCap className="h-4 w-4" /> Campus Focus League
          </button>
        </div>

        {activeTab === "global" && (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading real user rankings...</p>
              </div>
            ) : lbData.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <Trophy className="mb-4 h-16 w-16 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold text-foreground">No users yet!</h3>
                  <p className="mt-2 text-muted-foreground">Be the first to complete a focus session and claim the #1 spot.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Top 3 Podium */}
                {top3.length >= 1 && (
                  <div className="mb-8 flex items-end justify-center gap-6">
                    {podiumOrder.filter(r => top3[r - 1]).map((rank) => {
                      const u = top3[rank - 1]
                      if (!u) return null
                      const pc = podiumColors[rank as keyof typeof podiumColors]
                      return (
                        <motion.div
                          key={rank}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: rank === 1 ? 0 : rank === 2 ? 0.1 : 0.2, duration: 0.5, type: "spring" }}
                          className="flex flex-col items-center"
                        >
                          {rank === 1 && <span className="mb-2 text-2xl">👑</span>}
                          <div className="relative mb-3">
                            <div className={`flex ${pc.size} items-center justify-center rounded-full border-4 ${pc.border} ${pc.bg} text-xl font-bold text-foreground shadow-lg ${pc.shadow} ${u.isMe ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                              {u.avatar}
                            </div>
                            <div className={`absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full ${pc.badgeBg} text-sm font-bold text-white shadow-md`}>
                              {rank === 1 ? <Trophy className="h-4 w-4" /> : rank}
                            </div>
                          </div>
                          <p className={`font-semibold text-center ${rank === 1 ? "text-base" : "text-sm"} ${u.isMe ? 'text-primary' : 'text-foreground'}`}>{u.name}{u.isMe ? " (You)" : ""}</p>
                          <p className={`mt-1 font-bold text-sm ${pc.text}`}>{u.total_fopo.toLocaleString()} FoPo</p>
                          <p className="text-xs text-muted-foreground">Today: +{u.daily_fopo}</p>
                          <div className={`mt-3 w-24 ${podiumHeights[rank as keyof typeof podiumHeights]} rounded-t-xl border-t border-x ${pc.border} ${pc.bg} flex items-center justify-center`}>
                            <span className={`text-2xl font-black ${pc.text} opacity-30`}>{rank}</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                {/* Leaderboard Table */}
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-12 gap-4 border-b border-border/50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="col-span-1">Rank</span>
                      <span className="col-span-5">User</span>
                      <span className="col-span-3 text-center">Today's FoPo</span>
                      <span className="col-span-3 text-center">Total FoPo</span>
                    </div>
                    {filteredData.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">No users match your search.</div>
                    ) : (
                      filteredData.map((u, i) => (
                        <motion.div
                          key={u.user_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors hover:bg-secondary/30 ${i < filteredData.length - 1 ? 'border-b border-border/30' : ''} ${u.isMe ? 'bg-primary/5 border-primary/20' : ''}`}
                        >
                          <div className="col-span-1">
                            {u.rank <= 3 ? (
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${u.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' : u.rank === 2 ? 'bg-slate-300/20 text-slate-300' : 'bg-orange-500/20 text-orange-500'}`}>
                                {u.rank === 1 ? <Trophy className="h-4 w-4" /> : <Medal className="h-4 w-4" />}
                              </div>
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground">#{u.rank}</span>
                            )}
                          </div>
                          <div className="col-span-5 flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${u.isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                              {u.avatar}
                            </div>
                            <div>
                              <p className={`font-medium ${u.isMe ? 'text-primary' : 'text-foreground'}`}>
                                {u.name} {u.isMe && <span className="ml-1 text-xs font-normal text-primary/70">(You)</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">Level {u.level}</p>
                            </div>
                          </div>
                          <div className="col-span-3 text-center">
                            <span className="font-semibold text-primary">+{u.daily_fopo.toLocaleString()}</span>
                            <Target className="ml-1 inline-block h-3 w-3 text-primary" />
                          </div>
                          <div className="col-span-3 text-center font-semibold text-foreground">{u.total_fopo.toLocaleString()}</div>
                        </motion.div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Your Position Card (if not in top list due to search filter) */}
                {myEntry && (
                  <Card className="mt-6 border-primary/30 bg-primary/5 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-foreground">Your Position</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-12 items-center gap-4">
                        <div className="col-span-1">
                          <span className="flex h-8 w-8 items-center justify-center font-bold text-primary">#{myEntry.rank}</span>
                        </div>
                        <div className="col-span-5 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                            {myEntry.avatar}
                          </div>
                          <div>
                            <p className="font-medium text-primary">{myEntry.name}</p>
                            <p className="text-xs text-muted-foreground">Level {myEntry.level}</p>
                          </div>
                        </div>
                        <div className="col-span-3 text-center">
                          <span className="font-semibold text-primary">+{myEntry.daily_fopo.toLocaleString()}</span>
                          <Target className="ml-1 inline-block h-3 w-3 text-primary" />
                        </div>
                        <div className="col-span-3 text-center font-semibold text-foreground">{myEntry.total_fopo.toLocaleString()}</div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  {lastRefresh ? `Last updated: ${lastRefresh.toLocaleTimeString()} · ` : ""}Only real ZoFo users are shown
                </p>
              </>
            )}
          </>
        )}

        {activeTab === "campus" && (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <GraduationCap className="mb-4 h-16 w-16 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold text-foreground">Campus League Coming Soon</h3>
              <p className="mt-2 text-sm text-muted-foreground">University rankings will appear here once multiple users from the same campus join.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
