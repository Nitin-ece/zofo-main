"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { ensureUserRecord } from "@/lib/database"

interface AuthContextType {
    user: User | null
    loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true })

export const useAuth = () => useContext(AuthContext)

const PROTECTED_ROUTES = [
    "/dashboard",
    "/timer",
    "/analytics",
    "/leaderboard",
    "/music",
    "/rooms",
    "/profile",
    "/battles",
    "/quests",
    "/chat",
    "/planner",
    "/achievements",
    "/settings"
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        let mounted = true

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (mounted) {
                    setUser(session?.user ?? null)
                    setLoading(false)
                    // Ensure public.users row exists for authenticated user
                    if (session?.user) {
                        ensureUserRecord(session.user.id).catch(console.warn)
                    }
                }
            } catch (error) {
                console.error("Error getting session:", error)
                if (mounted) setLoading(false)
            }
        }

        initializeAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (mounted) {
                    setUser(session?.user ?? null)
                    setLoading(false)

                    // On sign-in / token refresh: ensure public.users row exists
                    if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
                        ensureUserRecord(session.user.id).catch(console.warn)
                    }
                }
            }
        )

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    useEffect(() => {
        if (!loading) {
            const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname?.startsWith(route))
            if (isProtectedRoute && !user) {
                router.replace("/login")
            }
            if ((pathname === "/login" || pathname === "/signup") && user) {
                router.replace("/dashboard")
            }
        }
    }, [user, loading, pathname, router])

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    )
}
