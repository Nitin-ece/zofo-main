"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  delay?: number
  direction?: "up" | "down" | "left" | "right" | "scale"
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up"
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  const getTransform = () => {
    switch (direction) {
      case "up": return "translateY(30px) scale(0.98)"
      case "down": return "translateY(-30px) scale(0.98)"
      case "left": return "translateX(30px) scale(0.98)"
      case "right": return "translateX(-30px) scale(0.98)"
      case "scale": return "scale(0.92)"
      default: return "translateY(30px) scale(0.98)"
    }
  }

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : getTransform(),
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

export function StaggeredReveal({
  children,
  className,
  staggerDelay = 100
}: {
  children: ReactNode[]
  className?: string
  staggerDelay?: number
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <ScrollReveal key={i} delay={i * staggerDelay}>
          {child}
        </ScrollReveal>
      ))}
    </div>
  )
}
