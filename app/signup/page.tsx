"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Check, MailCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [signupEmail, setSignupEmail] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: ""
  })

  const passwordStrength = () => {
    const { password } = formData
    if (password.length === 0) return { score: 0, text: "", color: "" }
    if (password.length < 6) return { score: 1, text: "Weak", color: "bg-red-500" }
    if (password.length < 8) return { score: 2, text: "Fair", color: "bg-yellow-500" }
    if (password.length < 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { score: 3, text: "Good", color: "bg-blue-500" }
    }
    if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
      return { score: 4, text: "Strong", color: "bg-green-500" }
    }
    return { score: 2, text: "Fair", color: "bg-yellow-500" }
  }

  const strength = passwordStrength()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Enforce Zo- prefix
    let formattedUsername = formData.username.trim()
    if (!formattedUsername.toLowerCase().startsWith("zo-")) {
      formattedUsername = `Zo-${formattedUsername}`
    }
    // ensure 'Zo-' is correctly cased
    formattedUsername = 'Zo-' + formattedUsername.substring(3);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: `${formattedUsername.toLowerCase()}@user.zofo.internal`,
        password: formData.password,
        options: {
          data: {
            username: formattedUsername,
            name: formData.name,
          }
        }
      })
      if (error) throw error

      // If email confirmation is disabled (auto-confirm on), session exists immediately
      if (data.session) {
        router.push("/dashboard")
      } else {
        // Email confirmation required — show success message
        setSignupEmail(`${formattedUsername.toLowerCase()}@user.zofo.internal`)
        setSignupSuccess(true)
      }
    } catch (err) {
      console.error(err)
      toast.error("Signup failed: " + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // Show email confirmation message
  if (signupSuccess) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[128px]" />
          <div className="absolute left-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/10 blur-[128px]" />
        </div>
        <div className="relative w-full max-w-md text-center">
          <Link href="/" className="mb-8 flex items-center justify-center">
            <Image src="/zofo-logo.png" alt="ZoFo" width={160} height={48} className="h-12 w-auto" />
          </Link>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
                  <MailCheck className="h-8 w-8 text-yellow-500" />
                </div>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-foreground">Action Required</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Your account was created! However, your Supabase project still requires Email Confirmations to be turned off to support Username-only logins.
              </p>

              <div className="rounded-md bg-yellow-500/10 p-4 border border-yellow-500/20 text-left mb-6">
                <p className="text-sm text-yellow-500 font-medium mb-1">Developer Action:</p>
                <p className="text-xs text-yellow-500/80">
                  Go to <strong>Supabase Dashboard → Authentication → Providers → Email</strong>, and turn OFF &quot;Confirm email&quot;.
                  Since we use dummy emails internally (`{signupEmail}`) to bypass the email requirement, users cannot actually verify them!
                </p>
              </div>

              <Button
                onClick={() => router.push("/login")}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Go to Login <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[128px]" />
        <div className="absolute left-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/10 blur-[128px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center justify-center">
          <Image
            src="/zofo-logo.png"
            alt="ZoFo"
            width={160}
            height={48}
            className="h-12 w-auto"
          />
        </Link>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground">Create your account</CardTitle>
            <CardDescription>Start your focus journey today</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    className="border-border bg-input pl-10"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="cooluser123"
                    className="border-border bg-input pl-10"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    className="border-border bg-input pl-10 pr-10"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {formData.password.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full ${level <= strength.score ? strength.color : 'bg-border'
                            }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Password strength: <span className="font-medium">{strength.text}</span>
                    </p>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>



            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Free 14-day trial with all features</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>No credit card required</span>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:text-primary/80">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
