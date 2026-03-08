import type { Metadata } from 'next'
import { Inter, Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { MusicPlayerProvider } from '@/components/music-player-context'
import { FloatingMusicPlayer } from '@/components/floating-music-player'
import { AuthProvider } from '@/components/auth-provider'
import { SuppressExtensionWarnings } from '@/components/suppress-extension-warnings'
import './globals.css'

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ZoFo - Zone into Focus',
  description: 'Gamified focus and productivity platform. Earn ZoFo points, track your productivity, compete on the global leaderboard, and study with friends in ZoFo Rooms.',
  icons: {
    icon: '/zofo-logo.png',
    apple: '/zofo-logo.png',
  },
}

import { Toaster } from 'sonner'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased text-foreground bg-background" suppressHydrationWarning>
        <SuppressExtensionWarnings />
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            storageKey="zofo-theme"
          >
            <MusicPlayerProvider>
              {children}
              <FloatingMusicPlayer />
            </MusicPlayerProvider>
            <Toaster richColors position="top-right" closeButton />
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
