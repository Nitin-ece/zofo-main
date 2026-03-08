"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  Timer,
  BarChart3,
  Trophy,
  BookOpen,
  User,
  Settings,
  Award,
  LogOut,
  Users,
  MessageSquare,
  Music,
  Swords,
  ListChecks,
  Sun,
  Moon,
  Flame,
  Target
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getUserFoPo } from "@/lib/database"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/timer", icon: Timer, label: "Focus Timer" },
  { href: "/rooms", icon: Users, label: "ZoFo Rooms" },
  { href: "/music", icon: Music, label: "Music" },
  { href: "/battles", icon: Swords, label: "Focus Battles" },
  { href: "/quests", icon: ListChecks, label: "Daily Quests" },
  { href: "/chat", icon: MessageSquare, label: "AskZoFo AI" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/planner", icon: BookOpen, label: "Study Planner" },
  { href: "/achievements", icon: Award, label: "Achievements" },
  { href: "/profile", icon: User, label: "Profile" },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [fopoData, setFopoData] = useState<{ total_fopo: number; level: number } | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user?.id) {
      getUserFoPo(user.id).then(data => {
        if (data) setFopoData(data)
      }).catch(() => { })
    }
  }, [user])


  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/zofo-logo.png"
            alt="ZoFo Logo"
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
          />
        </Link>
      </div>

      {/* User Stats Bar */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <Target className="h-3 w-3" />
          {fopoData ? fopoData.total_fopo.toLocaleString() : '0'} FoPo
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-400">
          <Flame className="h-3 w-3" />
          Lv {fopoData ? fopoData.level : '1'}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary border-l-2 border-sidebar-primary pl-[10px]"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-2 border-transparent pl-[10px]"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive && "text-sidebar-primary")} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        {/* Theme toggle — only render after mount to prevent SSR hydration mismatch */}
        {mounted ? (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="mb-2 flex w-full items-center gap-3 rounded-lg border border-sidebar-border px-3 py-2 text-sm text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4 text-yellow-400" />
                Switch to Light Mode
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-blue-400" />
                Switch to Dark Mode
              </>
            )}
          </button>
        ) : (
          // Stable placeholder during SSR — no theme-dependent content
          <div className="mb-2 h-9 w-full rounded-lg border border-sidebar-border" />
        )}

        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Avatar" className="flex h-9 w-9 items-center justify-center rounded-full border border-border object-cover bg-primary" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {user?.user_metadata?.username ? user.user_metadata.username.substring(0, 2).toUpperCase() : (user?.email?.substring(0, 2).toUpperCase() || 'U')}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.user_metadata?.username || user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">{user?.email || 'Level 12 • Focus Master'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            suppressHydrationWarning
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  )
}
