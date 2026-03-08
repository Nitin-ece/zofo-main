"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import {
    Bell,
    Moon,
    Sun,
    Volume2,
    ShieldCheck,
    User,
    CheckCircle2,
    Clock,
    Smartphone
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollReveal } from "@/components/scroll-reveal"

export default function SettingsPage() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [activeTab, setActiveTab] = useState("appearance")

    // Prevent hydration mismatch — theme is only available after mount
    useEffect(() => {
        setMounted(true)
    }, [])

    const tabs = [
        { id: "appearance", label: "Appearance", icon: Sun },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "account", label: "Account", icon: User },
        { id: "focus", label: "Focus Preferences", icon: Clock },
        { id: "privacy", label: "Privacy & Security", icon: ShieldCheck },
    ]

    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="flex h-16 items-center justify-between px-6">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
                        <p className="text-sm text-muted-foreground">Manage your ZoFo preferences</p>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-5xl p-6">
                <div className="grid gap-8 md:grid-cols-[240px_1fr]">
                    {/* Settings Sidebar */}
                    <nav className="space-y-2">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${isActive
                                        ? "bg-primary/10 text-primary shadow-[0_0_15px_-5px] shadow-primary/30"
                                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                        }`}
                                >
                                    <tab.icon className={`h-4 w-4 ${isActive ? "text-primary" : "opacity-70"}`} />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </nav>

                    {/* Settings Content */}
                    <div className="min-w-0">
                        {activeTab === "appearance" && (
                            <ScrollReveal delay={100} direction="up">
                                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                                    <CardHeader>
                                        <CardTitle className="text-xl">Appearance</CardTitle>
                                        <CardDescription>Customize how ZoFo looks on your device.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-8">
                                        {/* Theme Selection */}
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-medium text-foreground">Theme Preference</h3>
                                            <div className="grid grid-cols-3 gap-4">
                                                <button
                                                    onClick={() => setTheme("light")}
                                                    className={`flex flex-col items-center gap-3 rounded-2xl border-2 bg-secondary/20 p-4 transition-all hover:bg-secondary/40 ${mounted && theme === "light" ? "border-primary" : "border-transparent"
                                                        }`}
                                                >
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-sm">
                                                        <Sun className="h-6 w-6" />
                                                    </div>
                                                    <span className="text-sm font-medium">Light</span>
                                                    {mounted && theme === "light" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                                </button>

                                                <button
                                                    onClick={() => setTheme("dark")}
                                                    className={`flex flex-col items-center gap-3 rounded-2xl border-2 bg-secondary/20 p-4 transition-all hover:bg-secondary/40 ${mounted && theme === "dark" ? "border-primary" : "border-transparent"
                                                        }`}
                                                >
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm">
                                                        <Moon className="h-6 w-6" />
                                                    </div>
                                                    <span className="text-sm font-medium">Dark</span>
                                                    {mounted && theme === "dark" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                                </button>

                                                <button
                                                    onClick={() => setTheme("system")}
                                                    className={`flex flex-col items-center gap-3 rounded-2xl border-2 bg-secondary/20 p-4 transition-all hover:bg-secondary/40 ${mounted && theme === "system" ? "border-primary" : "border-transparent"
                                                        }`}
                                                >
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-white to-slate-900 text-primary shadow-sm">
                                                        <Smartphone className="h-6 w-6" />
                                                    </div>
                                                    <span className="text-sm font-medium">System</span>
                                                    {mounted && theme === "system" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Sound Effects */}
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-medium text-foreground">Sound & Physics</h3>
                                            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                        <Volume2 className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground">UI Sound Effects</p>
                                                        <p className="text-sm text-muted-foreground">Play clicks and achievement sounds</p>
                                                    </div>
                                                </div>
                                                {/* Fake switch */}
                                                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                                                    <span className="pointer-events-none block h-5 w-5 translate-x-5 rounded-full bg-background shadow-lg ring-0 transition-transform" />
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </ScrollReveal>
                        )}

                        {/* Placeholders for other tabs to show it's working */}
                        {activeTab !== "appearance" && (
                            <ScrollReveal direction="up">
                                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                                    <CardHeader>
                                        <CardTitle className="text-xl capitalize">{activeTab}</CardTitle>
                                        <CardDescription>Configure your {activeTab} settings here. Work in progress.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex h-64 items-center justify-center rounded-b-3xl bg-secondary/10">
                                        <p className="text-muted-foreground">Configuration options coming soon.</p>
                                    </CardContent>
                                </Card>
                            </ScrollReveal>
                        )}

                        <div className="mt-8 flex justify-end">
                            <Button className="rounded-xl bg-primary px-8 text-primary-foreground">
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
