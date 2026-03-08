"use client"

import { useMusicPlayer } from "@/components/music-player-context"
import { Play, Pause, SkipBack, SkipForward, Volume2, Music } from "lucide-react"

export function FloatingMusicPlayer() {
    const { currentTrack, isPlaying, currentTime, duration, volume, togglePlay, nextTrack, prevTrack, setVolume, seekTo } = useMusicPlayer()

    if (!currentTrack) return null

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0
    const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

    return (
        <div className="fixed bottom-6 right-6 z-[100] w-80 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl shadow-primary/20 overflow-hidden">
            {/* Progress bar at top */}
            <div className="h-1 bg-secondary">
                <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="p-4">
                <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
                        <Music className="h-5 w-5 text-primary" />
                    </div>
                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{currentTrack.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </p>
                    </div>
                    {/* Controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={prevTrack}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                        >
                            <SkipBack className="h-4 w-4" />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                        </button>
                        <button
                            onClick={nextTrack}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                        >
                            <SkipForward className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {/* Volume */}
                <div className="mt-3 flex items-center gap-2">
                    <Volume2 className="h-3 w-3 text-muted-foreground" />
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={e => setVolume(Number(e.target.value))}
                        className="flex-1 h-1 accent-primary cursor-pointer"
                    />
                    {/* Seek */}
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={1}
                        value={currentTime}
                        onChange={e => seekTo(Number(e.target.value))}
                        className="flex-1 h-1 accent-primary cursor-pointer"
                    />
                </div>
            </div>
        </div>
    )
}
