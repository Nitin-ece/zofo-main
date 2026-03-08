"use client"

import { Sparkles, Bot, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollReveal } from "@/components/scroll-reveal"

export default function ChatPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-6">
      <ScrollReveal>
        <div className="relative mb-8 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 shadow-2xl shadow-primary/20 backdrop-blur-xl">
            <Bot className="h-12 w-12 text-primary drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]" />
          </div>

          <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-lg">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <h1 className="mb-4 text-center text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          AskZoFo AI
        </h1>
      </ScrollReveal>

      <ScrollReveal delay={200}>
        <p className="mx-auto max-w-md text-center text-lg text-muted-foreground">
          Your personal AI study assistant is currently undergoing upgrades.
          Check back soon for an even smarter experience.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={300}>
        <Card className="mt-12 overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 border-b border-white/5 bg-secondary/30 px-6 py-4">
              <Sparkles className="h-5 w-5 text-accent" />
              <h3 className="font-medium text-foreground">Upcoming Features</h3>
            </div>
            <ul className="grid gap-3 p-6 text-sm text-muted-foreground">
              <li className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Integration with OpenAI ChatGPT and Google Gemini
              </li>
              <li className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Specialized study query optimization
              </li>
              <li className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Deep Focus mode built-in assistant
              </li>
            </ul>
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  )
}
