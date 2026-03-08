"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play, Pause, Square, RotateCcw, AlertTriangle,
  Target, Flame, Zap, Settings, Volume2, VolumeX,
  Maximize2, Minimize2, Sparkles, Send, X, MessageSquare, Music
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { saveFocusSession } from "@/lib/database"
import { toast } from "sonner"

type TimerMode = "focus" | "shortBreak" | "longBreak"

interface AIMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const TIMER_SETTINGS = {
  focus: { duration: 25 * 60, label: "Focus", color: "text-primary" },
  shortBreak: { duration: 5 * 60, label: "Short Break", color: "text-green-400" },
  longBreak: { duration: 15 * 60, label: "Long Break", color: "text-accent" },
}

const MAX_FOPO_FOR_RING = 500

const quickSuggestions = [
  "Explain this concept simply",
  "Give me a study tip",
  "Motivate me! 💪",
  "Quiz me on what I'm studying",
]

function EnergyRing({ progress, isRunning }: { progress: number; isRunning: boolean }) {
  const clampedProgress = Math.min(1, Math.max(0, progress))
  const circumference = 2 * Math.PI * 52
  const dasharray = clampedProgress * circumference

  const getRingColor = () => {
    if (clampedProgress < 0.3) return "rgba(150,160,180,0.3)"
    if (clampedProgress < 0.6) return "url(#blueGrad)"
    if (clampedProgress < 1.0) return "url(#purpleGrad)"
    return "url(#neonGrad)"
  }

  return (
    <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120" style={{ width: "120%", height: "120%", top: "-10%", left: "-10%" }}>
      <defs>
        <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
      {/* Energy fill */}
      {clampedProgress > 0 && (
        <circle
          cx="60" cy="60" r="52" fill="none"
          stroke={getRingColor()}
          strokeWidth="4"
          strokeDasharray={`${dasharray} ${circumference}`}
          strokeLinecap="round"
          filter={clampedProgress >= 0.6 ? "url(#glow)" : undefined}
          className={clampedProgress >= 1 ? "animate-pulse-glow" : ""}
          style={{ transition: "stroke-dasharray 1s linear" }}
        />
      )}
    </svg>
  )
}

export default function TimerPage() {
  const [mode, setMode] = useState<TimerMode>("focus")
  const [timeLeft, setTimeLeft] = useState(TIMER_SETTINGS.focus.duration)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionZofo, setSessionZofo] = useState(0)
  const [distractions, setDistractions] = useState(0)
  const [completedPomodoros, setCompletedPomodoros] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [showFocusTransition, setShowFocusTransition] = useState(false)
  const [showAIChat, setShowAIChat] = useState(false)
  const [showMusic, setShowMusic] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [isAILoading, setIsAILoading] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Refs to always hold CURRENT values inside timer useEffect (fixes stale closure bug)
  const sessionZofoRef = useRef(0)
  const distractionsRef = useRef(0)
  const sessionStartTimeRef = useRef<Date | null>(null)
  const modeRef = useRef<TimerMode>("focus")

  // Keep refs in sync with state
  useEffect(() => { sessionZofoRef.current = sessionZofo }, [sessionZofo])
  useEffect(() => { distractionsRef.current = distractions }, [distractions])
  useEffect(() => { sessionStartTimeRef.current = sessionStartTime }, [sessionStartTime])
  useEffect(() => { modeRef.current = mode }, [mode])

  const currentSettings = TIMER_SETTINGS[mode]
  const progress = ((currentSettings.duration - timeLeft) / currentSettings.duration) * 100
  const energyProgress = Math.min(1, sessionZofo / MAX_FOPO_FOR_RING)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }


  const doSaveSession = async (startTime: Date, focusMinutesOverride?: number) => {
    const endTime = new Date()
    const fopoToSave = sessionZofoRef.current
    const distractionsToSave = distractionsRef.current
    const focusMinutes = focusMinutesOverride ?? Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000))

    if (fopoToSave <= 0 && focusMinutes < 1) return // nothing to save

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.warning("Not logged in — session not saved")
        return
      }
      await saveFocusSession(user.id, startTime.toISOString(), endTime.toISOString(), focusMinutes, distractionsToSave, fopoToSave)
      toast.success(`Session Saved! +${fopoToSave} ZoFo points earned.`, {
        description: `Duration: ${focusMinutes}m | Distractions: ${distractionsToSave}`
      })
    } catch (err: any) {
      console.error("Save session error:", err)
      toast.error("Save failed. Please check your connection.")
    }
  }

  const switchMode = useCallback((newMode: TimerMode) => {
    setMode(newMode)
    setTimeLeft(TIMER_SETTINGS[newMode].duration)
    setIsRunning(false)
  }, [])

  const handleStart = () => {
    setIsRunning(true)
    if (mode === "focus" && !sessionStartTime) {
      setSessionStartTime(new Date())
    }
  }
  const handlePause = () => setIsRunning(false)

  const handleStop = () => {
    setIsRunning(false)
    // Save whatever was earned before resetting
    if (modeRef.current === "focus" && sessionStartTimeRef.current && sessionZofoRef.current > 0) {
      doSaveSession(sessionStartTimeRef.current)
    }
    setTimeLeft(currentSettings.duration)
    setSessionZofo(0)
    sessionZofoRef.current = 0
    setDistractions(0)
    distractionsRef.current = 0
    setSessionStartTime(null)
    sessionStartTimeRef.current = null
  }

  const handleReset = () => {
    setTimeLeft(currentSettings.duration)
    setIsRunning(false)
    setSessionZofo(0)
    sessionZofoRef.current = 0
    setDistractions(0)
    distractionsRef.current = 0
    setSessionStartTime(null)
    sessionStartTimeRef.current = null
  }

  const handleDistraction = useCallback(() => {
    if (isRunning && mode === "focus") {
      setDistractions(d => d + 1)
      setSessionZofo(f => Math.max(0, f - 15))
    }
  }, [isRunning, mode])

  useEffect(() => {
    const handleVisibilityChange = () => {
      // If the page is hidden (user switched tabs/minimized) while a focus timer is running
      if (document.hidden && isRunning && mode === "focus") {
        handleDistraction()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [isRunning, mode, handleDistraction])

  const enterFocusMode = () => {
    setShowFocusTransition(true)
    setTimeout(() => {
      setFocusMode(true)
      setShowFocusTransition(false)
      handleStart()
    }, 1500)
  }

  const exitFocusMode = () => {
    setShowFocusTransition(true)
    setTimeout(() => {
      setFocusMode(false)
      setShowFocusTransition(false)
    }, 800)
  }

  const handleAISend = async (message?: string) => {
    const text = message || aiInput.trim()
    if (!text || isAILoading) return
    const userMessage: AIMessage = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() }
    setAiMessages(prev => [...prev, userMessage])
    setAiInput("")
    setIsAILoading(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      const aiResponse: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: text.includes("Motivate")
          ? "You're doing amazing! Every second you focus, you grow stronger. Keep going — the person you're becoming is worth every minute! 🚀"
          : `Great question! Based on what you asked, here's a clear and concise answer that should help your studies:\n\n${text.includes("?") ? "The key concept here is to break it down step by step and connect it to what you already know..." : "I'm here to help you stay in deep focus. Ask me anything!"}`,
        timestamp: new Date()
      }
      setAiMessages(prev => [...prev, aiResponse])
    } catch (err: any) {
      console.error(err)
      toast.error("AI Assistant is currently offline.")
    } finally {
      setIsAILoading(false)
    }
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [aiMessages])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1)
        if (modeRef.current === "focus") {
          setSessionZofo(f => {
            const next = f + 1
            sessionZofoRef.current = next
            return next
          })
        }
      }, 1000)
    } else if (timeLeft === 0) {
      setIsRunning(false)
      if (modeRef.current === "focus") {
        setCompletedPomodoros(p => p + 1)

        // Use refs to get current values — avoids stale closure bug
        const startTime = sessionStartTimeRef.current
        if (startTime) {
          const focusMinutes = Math.round(TIMER_SETTINGS.focus.duration / 60)
          doSaveSession(startTime, focusMinutes)
          setSessionStartTime(null)
          sessionStartTimeRef.current = null
          // Reset counters
          setSessionZofo(0)
          sessionZofoRef.current = 0
          setDistractions(0)
          distractionsRef.current = 0
        }

        if ((completedPomodoros + 1) % 4 === 0) switchMode("longBreak")
        else switchMode("shortBreak")
      } else {
        switchMode("focus")
      }
      if (focusMode) exitFocusMode()
    }
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, timeLeft, completedPomodoros, switchMode, focusMode])

  // Focus Mode Transition
  if (showFocusTransition) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      >
        <div className="text-center">
          <Image src="/zofo-logo.png" alt="ZoFo" width={200} height={60} className="mx-auto mb-8 h-16 w-auto animate-pulse" />
          <p className="text-xl text-primary">{focusMode ? "Exiting Focus Mode..." : "Entering Focus Mode..."}</p>
          <div className="mt-6 flex justify-center gap-2">
            <span className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="h-3 w-3 animate-bounce rounded-full bg-primary" />
          </div>
        </div>
      </motion.div>
    )
  }

  // Focus Mode View
  if (focusMode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex bg-[#050510] overflow-hidden"
      >
        {/* Ambient background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-[100px] animate-ambient-float" />
          <div className="absolute top-1/2 -right-48 h-80 w-80 rounded-full bg-accent/10 blur-[120px] animate-ambient-float [animation-delay:3s]" />
          <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-[80px] animate-ambient-float [animation-delay:6s]" />
        </div>

        {/* Timer Section */}
        <div className={`flex flex-1 flex-col items-center justify-center relative transition-all duration-300 ${(showAIChat || showMusic) ? 'pr-96' : ''}`}>
          {/* Exit Button */}
          <button onClick={exitFocusMode} className="absolute left-6 top-6 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white">
            <Minimize2 className="h-4 w-4" /> Exit Focus Mode
          </button>

          {/* Right-Side Toggles */}
          <div className="absolute right-6 top-6 flex items-center gap-3">
            <button
              onClick={() => { setShowMusic(!showMusic); setShowAIChat(false); }}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm backdrop-blur-sm transition-all ${showMusic ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <Music className="h-4 w-4" /> Music
            </button>
            <button
              onClick={() => { setShowAIChat(!showAIChat); setShowMusic(false); }}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm backdrop-blur-sm transition-all ${showAIChat ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <Sparkles className="h-4 w-4" /> AskZoFo
            </button>
          </div>

          {/* Large Timer with Energy Ring */}
          <div className="relative mb-12">
            <div className="relative flex h-80 w-80 items-center justify-center md:h-96 md:w-96">
              {/* Outer ambient glow */}
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />

              {/* Energy Ring */}
              <EnergyRing progress={energyProgress} isRunning={isRunning} />

              {/* Progress ring */}
              <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3"
                  strokeDasharray={`${progress * 2.83} ${100 * 2.83}`}
                  strokeLinecap="round"
                  className="text-primary drop-shadow-[0_0_20px_currentColor]"
                  style={{ transition: "stroke-dasharray 1s linear" }}
                />
              </svg>

              {/* Time display */}
              <div className="relative z-10 text-center">
                <p className="text-7xl font-bold tabular-nums text-white md:text-8xl drop-shadow-[0_0_30px_rgba(0,212,255,0.4)]">
                  {formatTime(timeLeft)}
                </p>
                <p className="mt-4 text-lg text-white/60">{currentSettings.label}</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <Button variant="outline" size="icon" onClick={handleReset} className="h-14 w-14 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10">
              <RotateCcw className="h-6 w-6" />
            </Button>
            {!isRunning ? (
              <Button onClick={handleStart} className="h-20 w-20 rounded-full bg-primary text-primary-foreground shadow-[0_0_50px_-10px] shadow-primary hover:bg-primary/90">
                <Play className="h-10 w-10 ml-1" />
              </Button>
            ) : (
              <Button onClick={handlePause} className="h-20 w-20 rounded-full bg-primary text-primary-foreground shadow-[0_0_50px_-10px] shadow-primary hover:bg-primary/90">
                <Pause className="h-10 w-10" />
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={handleStop} className="h-14 w-14 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10">
              <Square className="h-6 w-6" />
            </Button>
          </div>

          {/* Session Stats */}
          <div className="mt-12 flex gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{sessionZofo}</p>
              <p className="text-sm text-white/40">FoPo Earned</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-400">{completedPomodoros}</p>
              <p className="text-sm text-white/40">Pomodoros</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-400">{distractions}</p>
              <p className="text-sm text-white/40">Distractions</p>
            </div>
          </div>

          {/* Energy level indicator */}
          {isRunning && (
            <div className="mt-6 flex items-center gap-2 text-sm">
              <div className="h-2 w-48 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-1000"
                  style={{ width: `${energyProgress * 100}%` }}
                />
              </div>
              <span className="text-white/40 text-xs">
                {energyProgress < 0.3 ? "Building focus..." :
                  energyProgress < 0.6 ? "Blue energy ⚡" :
                    energyProgress < 1.0 ? "Purple power! 🔮" : "MAX FOCUS! 🚀"}
              </span>
            </div>
          )}

          {/* Log Distraction */}
          {isRunning && (
            <Button variant="outline" onClick={handleDistraction} className="mt-6 gap-2 border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20">
              <AlertTriangle className="h-4 w-4" /> Log Distraction (-15 FoPo)
            </Button>
          )}
        </div>

        {/* Music Panel */}
        <AnimatePresence>
          {showMusic && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 flex h-full w-96 flex-col border-l border-white/10 bg-black/90 backdrop-blur-xl"
            >
              <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
                    <Music className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Focus Music</h3>
                    <p className="text-xs text-white/40">Lo-Fi & Beats</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowMusic(false)} className="text-white/60 hover:text-white">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Music Player Placeholder */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                    <Play className="h-8 w-8 text-primary ml-1" />
                  </div>
                  <h4 className="font-semibold text-white">Lofi Study Beats</h4>
                  <p className="text-sm text-white/60 mb-6">Chillhop Music</p>

                  <div className="space-y-2">
                    <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full w-1/3 bg-primary rounded-full" />
                    </div>
                    <div className="flex justify-between text-xs text-white/40">
                      <span>1:24</span>
                      <span>3:45</span>
                    </div>
                  </div>
                </div>

                <h4 className="mt-8 mb-4 font-medium text-white/80 text-sm">Playlists</h4>
                <div className="space-y-3">
                  {["Deep Focus (Binaural)", "Chill Lofi Beats", "Classical Study", "Nature Ambient"].map(playlist => (
                    <button key={playlist} className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left hover:bg-white/5 hover:border-white/10 transition-colors">
                      <div className="h-10 w-10 rounded-md bg-white/10 flex items-center justify-center">
                        <Music className="h-4 w-4 text-white/60" />
                      </div>
                      <span className="text-sm font-medium text-white/80">{playlist}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AskZoFo Chat Panel */}
        <AnimatePresence>
          {showAIChat && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 flex h-full w-96 flex-col border-l border-white/10 bg-black/90 backdrop-blur-xl"
            >
              <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">AskZoFo</h3>
                    <p className="text-xs text-white/40">AI Study Assistant</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAIChat(false)} className="text-white/60 hover:text-white">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick suggestions */}
              {aiMessages.length === 0 && (
                <div className="border-b border-white/10 p-4">
                  <p className="mb-2 text-xs text-white/40">Quick questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickSuggestions.map(s => (
                      <button key={s} onClick={() => handleAISend(s)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-primary/20 hover:text-primary hover:border-primary/30 transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                {aiMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Sparkles className="mb-4 h-12 w-12 text-primary/50" />
                    <h4 className="mb-2 text-lg font-medium text-white">Need help while studying?</h4>
                    <p className="text-sm text-white/40">Ask me any question. I'll help without breaking your focus.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {aiMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"}`}>
                          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isAILoading && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3">
                          <div className="flex gap-1">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-white/10 p-4">
                <div className="flex gap-2">
                  <Textarea value={aiInput} onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAISend() } }}
                    placeholder="Ask a study question..."
                    className="min-h-[44px] max-h-24 resize-none border-white/10 bg-white/5 text-white placeholder:text-white/40"
                    rows={1}
                  />
                  <Button onClick={() => handleAISend()} disabled={!aiInput.trim() || isAILoading}
                    className="h-[44px] w-[44px] shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // Normal Timer View
  return (
    <div className="min-h-screen">

      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Focus Timer</h1>
            <p className="text-sm text-muted-foreground">Stay focused, earn ZoFo</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} className="text-muted-foreground hover:text-foreground">
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center px-6 py-12">
        {/* Focus Mode Button */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Button onClick={enterFocusMode} className="mb-8 gap-2 bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all">
            <Maximize2 className="h-4 w-4" /> Enter Focus Mode
          </Button>
        </motion.div>

        {/* Mode Selector */}
        <div className="mb-8 flex rounded-lg border border-border bg-secondary/30 p-1">
          {(Object.keys(TIMER_SETTINGS) as TimerMode[]).map((m) => (
            <button key={m} onClick={() => switchMode(m)} suppressHydrationWarning
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {TIMER_SETTINGS[m].label}
            </button>
          ))}
        </div>

        {/* Timer Circle with Energy Ring */}
        <div className="relative mb-8">
          <div className="relative flex h-80 w-80 items-center justify-center">
            {/* Energy Ring */}
            <EnergyRing progress={energyProgress} isRunning={isRunning} />

            {/* Background circle */}
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4"
                strokeDasharray={`${progress * 2.83} ${100 * 2.83}`}
                strokeLinecap="round"
                className={currentSettings.color}
                style={{ filter: isRunning ? "drop-shadow(0 0 10px currentColor)" : "none", transition: "stroke-dasharray 1s linear" }}
              />
            </svg>

            {/* Inner content */}
            <div className="relative z-10 text-center">
              <p className={`text-6xl font-bold tabular-nums ${currentSettings.color}`}>{formatTime(timeLeft)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{currentSettings.label}</p>
            </div>
          </div>
          {isRunning && <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-primary/10 blur-3xl" />}
        </div>

        {/* Energy level bar */}
        {mode === "focus" && (
          <div className="mb-6 w-full max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Focus Energy</span>
              <span className="text-xs font-medium text-primary">{Math.round(energyProgress * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 transition-all duration-1000"
                style={{ width: `${energyProgress * 100}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {energyProgress < 0.3 ? "Gray: Building..." : energyProgress < 0.6 ? "🔵 Blue glow" : energyProgress < 1.0 ? "🟣 Purple energy" : "⚡ DEEP FOCUS!"}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="mb-8 flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handleReset} className="h-12 w-12 rounded-full border-border">
            <RotateCcw className="h-5 w-5" />
          </Button>
          {!isRunning ? (
            <Button onClick={handleStart} className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-[0_0_30px_-5px] shadow-primary/50 hover:bg-primary/90">
              <Play className="h-7 w-7 ml-1" />
            </Button>
          ) : (
            <Button onClick={handlePause} className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-[0_0_30px_-5px] shadow-primary/50 hover:bg-primary/90">
              <Pause className="h-7 w-7" />
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handleStop} className="h-12 w-12 rounded-full border-border">
            <Square className="h-5 w-5" />
          </Button>
        </div>

        {/* Distraction Button */}
        {mode === "focus" && isRunning && (
          <Button variant="outline" onClick={handleDistraction} className="mb-8 gap-2 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400">
            <AlertTriangle className="h-4 w-4" /> Log Distraction (-15 FoPo)
          </Button>
        )}

        {/* Session Stats */}
        <div className="grid w-full max-w-3xl grid-cols-4 gap-4">
          {[
            { value: sessionZofo, label: "Session FoPo", Icon: Target, bg: "bg-primary/10", color: "text-primary" },
            { value: completedPomodoros, label: "Pomodoros", Icon: Flame, bg: "bg-orange-500/10", color: "text-orange-400" },
            { value: distractions, label: "Distractions", Icon: AlertTriangle, bg: "bg-yellow-500/10", color: "text-yellow-400" },
            { value: sessionZofo, label: "Session Coins", Icon: Sparkles, bg: "bg-emerald-500/10", color: "text-emerald-400" },
          ].map(({ value, label, Icon, bg, color }, i) => (
            <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center p-6">
                <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full ${bg}`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tips */}
        <Card className="mt-8 w-full max-w-2xl border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Zap className="h-5 w-5 text-primary" /> Focus Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Try Focus Mode for an immersive, distraction-free experience with ambient visuals",
                "Watch your Energy Ring fill as you earn FoPo — reach 100% for deep focus!",
                "Use AskZoFo to get answers without leaving your session",
                "Put your phone on silent or in another room",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
