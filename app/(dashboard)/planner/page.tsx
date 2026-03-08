"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, Clock, BookOpen, Code, Calculator, Languages,
  CheckCircle2, Circle, Play, Plus, Trash2, Calendar,
  X, GraduationCap, Palette, FlaskConical, Globe, Music, Dumbbell
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { getFocusAnalytics } from "@/lib/database"
import { toast } from "sonner"

// ── Subject icon/color mapping ──────────────────────────────────────────

const SUBJECT_META: Record<string, { icon: any; color: string; bgColor: string }> = {
  Mathematics: { icon: Calculator, color: "text-blue-400", bgColor: "bg-blue-500/10" },
  Programming: { icon: Code, color: "text-green-400", bgColor: "bg-green-500/10" },
  Language: { icon: Languages, color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
  Reading: { icon: BookOpen, color: "text-purple-400", bgColor: "bg-purple-500/10" },
  Science: { icon: FlaskConical, color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
  Art: { icon: Palette, color: "text-pink-400", bgColor: "bg-pink-500/10" },
  Music: { icon: Music, color: "text-orange-400", bgColor: "bg-orange-500/10" },
  History: { icon: Globe, color: "text-amber-400", bgColor: "bg-amber-500/10" },
  Fitness: { icon: Dumbbell, color: "text-red-400", bgColor: "bg-red-500/10" },
  Other: { icon: GraduationCap, color: "text-muted-foreground", bgColor: "bg-secondary" },
}

const SUBJECT_NAMES = Object.keys(SUBJECT_META)

const PRIORITY_COLORS = {
  High: "text-red-400 bg-red-500/10 border-red-500/20",
  Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Low: "text-green-400 bg-green-500/10 border-green-500/20",
}

// ── Types ───────────────────────────────────────────────────────────────

interface StudyTask {
  id: string
  subject: string
  topic: string
  duration: number // minutes
  startTime: string // HH:MM
  completed: boolean
  isBreak: boolean
  priority: "High" | "Medium" | "Low"
}

// ── Local storage helpers ───────────────────────────────────────────────

const STORAGE_KEY = "zofo-planner-tasks"

function loadTasks(): StudyTask[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveTasks(tasks: StudyTask[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDuration(totalMins: number): string {
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function getSubjectMeta(name: string) {
  return SUBJECT_META[name] || SUBJECT_META.Other
}

// ── Component ───────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Add-task form state
  const [newTopic, setNewTopic] = useState("")
  const [newSubject, setNewSubject] = useState("Other")
  const [newDuration, setNewDuration] = useState(25)
  const [newStartTime, setNewStartTime] = useState("09:00")
  const [newPriority, setNewPriority] = useState<"High" | "Medium" | "Low">("Medium")
  const [newIsBreak, setNewIsBreak] = useState(false)

  // Real analytics from Supabase
  const [totalFocusToday, setTotalFocusToday] = useState(0)
  const [totalSessionsToday, setTotalSessionsToday] = useState(0)
  const [recommendations, setRecommendations] = useState<{ title: string; text: string }[]>([])

  // Load tasks from localStorage on mount
  useEffect(() => {
    setTasks(loadTasks())
    setIsLoaded(true)
  }, [])

  // Persist whenever tasks change (skip first render)
  useEffect(() => {
    if (isLoaded) saveTasks(tasks)
  }, [tasks, isLoaded])

  // Fetch real focus session data for today's stats & recommendations
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      getFocusAnalytics(user.id).then(data => {
        if (!data || data.length === 0) {
          setRecommendations([
            { title: "Get Started", text: "Complete your first focus session to get personalized recommendations." },
            { title: "Plan Your Day", text: "Add study tasks above and use the timer to track your focus time." },
            { title: "Stay Consistent", text: "Studying even 30 minutes daily builds powerful habits over time." },
          ])
          return
        }

        // Filter today's sessions
        const todayStr = new Date().toISOString().split("T")[0]
        const todaySessions = data.filter((s: any) => s.start_time?.startsWith(todayStr))
        const todayMins = todaySessions.reduce((sum: number, s: any) => sum + (s.focus_minutes || 0), 0)
        setTotalFocusToday(todayMins)
        setTotalSessionsToday(todaySessions.length)

        // Aggregate focus by day of week for recommendations
        const dayTotals: Record<string, number> = {}
        data.forEach((s: any) => {
          const dayName = new Date(s.start_time).toLocaleDateString("en-US", { weekday: "long" })
          dayTotals[dayName] = (dayTotals[dayName] || 0) + (s.focus_minutes || 0)
        })

        const sortedDays = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])
        const bestDay = sortedDays[0]?.[0] || "weekdays"
        const weakDay = sortedDays.length > 1 ? sortedDays[sortedDays.length - 1][0] : null

        const totalDistractions = data.reduce((sum: number, s: any) => sum + (s.distractions || 0), 0)
        const avgSessionLen = Math.round(data.reduce((sum: number, s: any) => sum + (s.focus_minutes || 0), 0) / data.length)

        const recs: { title: string; text: string }[] = []

        recs.push({
          title: "Peak Day",
          text: `Your strongest focus day is ${bestDay}. Schedule your hardest subjects on this day.`
        })

        if (weakDay) {
          recs.push({
            title: "Growth Area",
            text: `${weakDay} is your weakest day. Try scheduling a short 15-min session to build the habit.`
          })
        }

        if (avgSessionLen < 20) {
          recs.push({
            title: "Session Length",
            text: `Your average session is only ${avgSessionLen} min. Try 25-min Pomodoros for deeper focus.`
          })
        } else if (avgSessionLen > 45) {
          recs.push({
            title: "Take Breaks",
            text: `Your avg session is ${avgSessionLen} min. Consider 5-min breaks every 25 min for better retention.`
          })
        } else {
          recs.push({
            title: "Great Rhythm",
            text: `Your ${avgSessionLen}-min average session length is perfect for deep work. Keep it up!`
          })
        }

        if (totalDistractions > data.length) {
          recs.push({
            title: "Reduce Distractions",
            text: `You're averaging ${(totalDistractions / data.length).toFixed(1)} distractions per session. Try putting your phone in another room.`
          })
        }

        // Ensure at least 3
        while (recs.length < 3) {
          recs.push({ title: "Stay Focused", text: "Consistency beats intensity. Keep showing up every day!" })
        }

        setRecommendations(recs.slice(0, 3))
      }).catch(console.error)
    })
  }, [])

  // ── Derived stats ───────────────────────────────────────────────────

  const studyTasks = tasks.filter(t => !t.isBreak)
  const completedCount = studyTasks.filter(t => t.completed).length
  const completionPct = studyTasks.length > 0 ? Math.round((completedCount / studyTasks.length) * 100) : 0
  const totalPlannedMins = tasks.reduce((s, t) => s + t.duration, 0)

  // Subject breakdown from tasks
  const subjectMap = new Map<string, { total: number; completed: number }>()
  studyTasks.forEach(t => {
    const existing = subjectMap.get(t.subject) || { total: 0, completed: 0 }
    existing.total += 1
    if (t.completed) existing.completed += 1
    subjectMap.set(t.subject, existing)
  })

  // Sort tasks by startTime
  const sortedTasks = [...tasks].sort((a, b) => a.startTime.localeCompare(b.startTime))

  // ── Handlers ────────────────────────────────────────────────────────

  const handleToggle = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const handleDelete = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.success("Task removed")
  }

  const handleAddTask = () => {
    if (!newTopic.trim() && !newIsBreak) {
      toast.error("Please enter a topic name")
      return
    }

    const task: StudyTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subject: newIsBreak ? "Break" : newSubject,
      topic: newIsBreak ? "Break" : newTopic.trim(),
      duration: newDuration,
      startTime: newStartTime,
      completed: false,
      isBreak: newIsBreak,
      priority: newIsBreak ? "Low" : newPriority,
    }

    setTasks(prev => [...prev, task])
    toast.success(newIsBreak ? "Break added" : "Study task added")

    // Reset form
    setNewTopic("")
    setNewSubject("Other")
    setNewDuration(25)
    setNewStartTime("09:00")
    setNewPriority("Medium")
    setNewIsBreak(false)
    setShowAddModal(false)
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">AI Study Planner</h1>
            <p className="text-sm text-muted-foreground">Plan and track your study sessions</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowAddModal(true)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Overview Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            { value: studyTasks.length, label: "Tasks Planned", Icon: Calendar, bg: "bg-primary/10", color: "text-primary" },
            { value: completedCount, label: "Completed", Icon: CheckCircle2, bg: "bg-green-500/10", color: "text-green-400" },
            { value: formatDuration(totalPlannedMins), label: "Planned Duration", Icon: Clock, bg: "bg-accent/10", color: "text-accent" },
            { value: `${completionPct}%`, label: "Progress", hasRing: true },
          ].map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {"Icon" in card && card.Icon ? (
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                        <card.Icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                    ) : (
                      <div className="relative flex h-10 w-10 items-center justify-center">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-secondary" />
                          <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3"
                            strokeDasharray={`${completionPct} 100`} strokeLinecap="round" className="text-primary" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Real Focus Today stat */}
        {totalFocusToday > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <Card className="border-primary/30 bg-primary/5 backdrop-blur-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                  <Play className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today&apos;s actual focus</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatDuration(totalFocusToday)} across {totalSessionsToday} session{totalSessionsToday !== 1 ? "s" : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Subject breakdown */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Subjects</h2>
            {subjectMap.size === 0 ? (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Add study tasks to see subject breakdown</p>
                </CardContent>
              </Card>
            ) : (
              Array.from(subjectMap.entries()).map(([name, stats], i) => {
                const meta = getSubjectMeta(name)
                const Icon = meta.icon
                const pct = Math.round((stats.completed / stats.total) * 100)
                return (
                  <motion.div key={name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${meta.bgColor}`}>
                            <Icon className={`h-6 w-6 ${meta.color}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{name}</p>
                            <p className="text-sm text-muted-foreground">{stats.completed}/{stats.total} tasks done</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: i * 0.1 + 0.3, duration: 0.6 }}
                              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })
            )}
          </div>

          {/* Today's Schedule */}
          <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Today&apos;s Schedule</CardTitle>
              <CardDescription>Your planned study sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {sortedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-lg font-medium text-muted-foreground">No tasks planned yet</p>
                  <p className="mt-1 text-sm text-muted-foreground/70">Click &quot;Add Task&quot; to start building your schedule</p>
                  <Button onClick={() => setShowAddModal(true)} className="mt-4 gap-2 bg-primary text-primary-foreground">
                    <Plus className="h-4 w-4" /> Add Your First Task
                  </Button>
                </div>
              ) : (
                <div className="relative space-y-4">
                  <div className="absolute left-[23px] top-0 bottom-0 w-px bg-border" />
                  {sortedTasks.map((item, index) => {
                    const meta = getSubjectMeta(item.subject)
                    const Icon = item.isBreak ? Clock : meta.icon
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className={`relative flex items-start gap-4 ${item.completed ? "opacity-60" : ""}`}
                      >
                        <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${item.isBreak ? "bg-secondary" : meta.bgColor}`}>
                          <Icon className={`h-5 w-5 ${item.isBreak ? "text-muted-foreground" : meta.color}`} />
                        </div>
                        <div className={`flex-1 rounded-xl border p-4 transition-all ${item.completed ? "border-border/30 bg-secondary/10" : "border-border/50 bg-secondary/30 hover:border-primary/30"}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-medium ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.topic}</p>
                                {!item.isBreak && (
                                  <>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bgColor} ${meta.color}`}>{item.subject}</span>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[item.priority]}`}>
                                      {item.priority}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{item.startTime} • {formatDuration(item.duration)}</p>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <button onClick={() => handleDelete(item.id)} className="p-1 text-muted-foreground/50 hover:text-red-400 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleToggle(item.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                                {item.completed ? <CheckCircle2 className="h-5 w-5 text-green-400" /> : <Circle className="h-5 w-5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <Card className="mt-6 border-primary/30 bg-primary/5 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Sparkles className="h-5 w-5 text-primary" /> AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {recommendations.map((rec, i) => (
                  <div key={i} className="rounded-xl border border-border/50 bg-card/50 p-4">
                    <h4 className="font-medium text-foreground">{rec.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{rec.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Add Task Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <Card className="w-full max-w-md border-border/50 bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-foreground">
                    {newIsBreak ? "Add Break" : "Add Study Task"}
                    <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Break toggle */}
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="isBreak" checked={newIsBreak} onChange={e => setNewIsBreak(e.target.checked)} className="h-4 w-4 rounded border-border" />
                    <label htmlFor="isBreak" className="text-sm text-foreground">This is a break</label>
                  </div>

                  {/* Topic */}
                  {!newIsBreak && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Topic</label>
                      <Input value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="e.g., Calculus - Integration" className="border-border bg-input" />
                    </div>
                  )}

                  {/* Subject */}
                  {!newIsBreak && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Subject</label>
                      <select
                        value={newSubject}
                        onChange={e => setNewSubject(e.target.value)}
                        className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                      >
                        {SUBJECT_NAMES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Start Time */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Start Time</label>
                    <Input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} className="border-border bg-input" />
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Duration (minutes)</label>
                    <Input type="number" min={5} max={180} value={newDuration} onChange={e => setNewDuration(parseInt(e.target.value) || 25)} className="border-border bg-input" />
                  </div>

                  {/* Priority */}
                  {!newIsBreak && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Priority</label>
                      <div className="flex gap-2">
                        {(["High", "Medium", "Low"] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => setNewPriority(p)}
                            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-all ${newPriority === p
                                ? PRIORITY_COLORS[p]
                                : "border-border text-muted-foreground hover:bg-secondary"
                              }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1 border-border" onClick={() => setShowAddModal(false)}>Cancel</Button>
                    <Button
                      className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleAddTask}
                    >
                      <Plus className="h-4 w-4" /> {newIsBreak ? "Add Break" : "Add Task"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
