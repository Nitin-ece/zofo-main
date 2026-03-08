"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Timer,
  TrendingUp,
  Trophy,
  Zap,
  Brain,
  BarChart3,
  ArrowRight,
  Play,
  Flame,
  Star,
  ChevronRight,
  Users,
  MessageSquare,
  Video
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollReveal } from "@/components/scroll-reveal"

const features = [
  {
    icon: Timer,
    title: "Smart Timer",
    description: "Track focus sessions with an intelligent timer that adapts to your workflow."
  },
  {
    icon: TrendingUp,
    title: "Analytics",
    description: "Visualize your productivity trends with detailed charts and insights."
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    description: "Compete with users worldwide and climb the global rankings."
  },
  {
    icon: Brain,
    title: "AskZoFo AI",
    description: "Get instant answers to your questions without leaving your focus session."
  },
  {
    icon: Video,
    title: "ZoFo Rooms",
    description: "Study with friends in video call rooms with built-in collaboration tools."
  },
  {
    icon: Zap,
    title: "Gamification",
    description: "Unlock achievements, badges, and level up as you improve focus."
  }
]

const leaderboardPreview = [
  { rank: 1, name: "Alex Chen", country: "US", score: 2847, avatar: "AC" },
  { rank: 2, name: "Maria Silva", country: "BR", score: 2654, avatar: "MS" },
  { rank: 3, name: "Yuki Tanaka", country: "JP", score: 2521, avatar: "YT" },
  { rank: 4, name: "John Smith", country: "UK", score: 2398, avatar: "JS" },
  { rank: 5, name: "Emma Wilson", country: "CA", score: 2275, avatar: "EW" },
]

export default function LandingPage() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/zofo-logo.png"
              alt="ZoFo Logo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </Link>
            <Link href="#leaderboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Leaderboard
            </Link>
            <Link href="/rooms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              ZoFo Rooms
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Background glow effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[128px]" />
          <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/20 blur-[128px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <ScrollReveal>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm">
              <Flame className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Join 50,000+ focused users worldwide</span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="mx-auto max-w-4xl text-balance text-5xl font-bold tracking-tight text-foreground md:text-7xl">
              <span className="bg-gradient-to-r from-[#00d4ff] via-[#5b8aff] to-[#a855f7] bg-clip-text text-transparent">ZoFo</span> – Zone into Focus
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
              Gamify your productivity. Earn ZoFo points when you stay focused, study with friends in video rooms,
              and get instant AI answers without breaking your flow.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/dashboard">
                <Button size="lg" className="h-12 gap-2 bg-primary px-8 text-primary-foreground shadow-[0_0_30px_-5px] shadow-primary/50 hover:bg-primary/90 hover:shadow-[0_0_40px_-5px] hover:shadow-primary/60">
                  <Play className="h-5 w-5" />
                  Start Focusing
                </Button>
              </Link>
              <Link href="/rooms">
                <Button variant="outline" size="lg" className="h-12 gap-2 border-border px-8">
                  <Users className="h-5 w-5" />
                  Join a Room
                </Button>
              </Link>
            </div>
          </ScrollReveal>

          {/* Stats */}
          <ScrollReveal delay={400}>
            <div className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { value: "50K+", label: "Active Users" },
                { value: "2.5M+", label: "Focus Sessions" },
                { value: "98%", label: "Improved Focus" },
                { value: "4.9", label: "App Rating" }
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl font-bold text-foreground md:text-4xl">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-border/40 bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                Everything you need to stay focused
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Powerful features designed to help you achieve deep focus and maximize productivity.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <ScrollReveal key={i} delay={i * 100}>
                <Card
                  className={`group relative h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card ${hoveredFeature === i ? 'shadow-[0_0_30px_-10px] shadow-primary/30' : ''
                    }`}
                  onMouseEnter={() => setHoveredFeature(i)}
                  onMouseLeave={() => setHoveredFeature(null)}
                >
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                  {hoveredFeature === i && (
                    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-accent/5" />
                  )}
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                  Track your focus in real-time
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Our intuitive dashboard gives you instant insights into your productivity patterns.
                  Monitor your ZoFo score, track streaks, and identify distractions.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    "Real-time focus tracking with smart interruption detection",
                    "AskZoFo AI - get answers without leaving your session",
                    "ZoFo Rooms - study with friends on video calls",
                    "Integration with ChatGPT, Gemini, and Claude"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
                        <ChevronRight className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard" className="mt-8 inline-block">
                  <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                    View Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </ScrollReveal>

            {/* Dashboard Preview Card */}
            <ScrollReveal direction="right">
              <div className="relative">
                <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 blur-2xl" />
                <Card className="relative border-border/50 bg-card">
                  <CardContent className="p-6">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{"Today's ZoFo"}</p>
                        <p className="text-3xl font-bold text-foreground">1,247</p>
                      </div>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary bg-primary/10">
                        <span className="text-lg font-bold text-primary">92%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-lg bg-secondary/50 p-3 text-center">
                        <Timer className="mx-auto mb-1 h-5 w-5 text-primary" />
                        <p className="text-xl font-semibold text-foreground">4.5h</p>
                        <p className="text-xs text-muted-foreground">Focus Time</p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-3 text-center">
                        <Flame className="mx-auto mb-1 h-5 w-5 text-orange-400" />
                        <p className="text-xl font-semibold text-foreground">12</p>
                        <p className="text-xs text-muted-foreground">Day Streak</p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-3 text-center">
                        <BarChart3 className="mx-auto mb-1 h-5 w-5 text-accent" />
                        <p className="text-xl font-semibold text-foreground">3</p>
                        <p className="text-xs text-muted-foreground">Distractions</p>
                      </div>
                    </div>
                    {/* AI Chat Preview */}
                    <div className="mt-4 rounded-lg border border-border/50 bg-secondary/30 p-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span>AskZoFo: {"\"What's the formula for compound interest?\""}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section id="leaderboard" className="border-t border-border/40 bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                Compete on the global leaderboard
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                See how you rank against focused individuals from around the world.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="mx-auto mt-12 max-w-3xl">
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-0">
                  <div className="grid grid-cols-4 gap-4 border-b border-border/50 px-6 py-4 text-sm font-medium text-muted-foreground">
                    <span>Rank</span>
                    <span className="col-span-2">User</span>
                    <span className="text-right">Daily ZoFo</span>
                  </div>
                  {leaderboardPreview.map((user, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-4 items-center gap-4 px-6 py-4 transition-colors hover:bg-secondary/30 ${i < leaderboardPreview.length - 1 ? 'border-b border-border/30' : ''
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        {user.rank <= 3 ? (
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${user.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                              user.rank === 2 ? 'bg-slate-300/20 text-slate-300' :
                                'bg-orange-500/20 text-orange-500'
                            }`}>
                            <Trophy className="h-4 w-4" />
                          </div>
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center text-muted-foreground">
                            #{user.rank}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${user.rank === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                          }`}>
                          {user.avatar}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.country}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-foreground">{user.score.toLocaleString()}</span>
                        <Star className="ml-1 inline-block h-3 w-3 text-primary" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="mt-6 text-center">
                <Link href="/leaderboard">
                  <Button variant="outline" className="gap-2 border-border">
                    View Full Leaderboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal direction="scale">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-12 text-center">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
              </div>
              <div className="relative">
                <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                  Ready to zone into focus?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                  Join thousands of users who have transformed their productivity with ZoFo.
                  Start your focus journey today.
                </p>
                <Link href="/signup" className="mt-8 inline-block">
                  <Button size="lg" className="h-12 gap-2 bg-primary px-8 text-primary-foreground shadow-[0_0_30px_-5px] shadow-primary/50 hover:bg-primary/90">
                    <Zap className="h-5 w-5" />
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/zofo-logo.png"
                alt="ZoFo"
                width={100}
                height={30}
                className="h-8 w-auto"
              />
            </Link>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <Link href="#" className="transition-colors hover:text-foreground">Privacy</Link>
              <Link href="#" className="transition-colors hover:text-foreground">Terms</Link>
              <Link href="#" className="transition-colors hover:text-foreground">Support</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              2026 ZoFo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
