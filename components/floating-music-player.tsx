import { useMusicPlayer, RepeatMode } from "@/components/music-player-context"
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Shuffle, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FloatingMusicPlayer() {
    const {
        currentTrack, currentPlaylist, isPlaying, currentTime, duration, volume,
        shuffle, repeatMode, togglePlay, nextTrack, prevTrack, setVolume, seekTo,
        toggleShuffle, setRepeatMode
    } = useMusicPlayer()

    if (!currentTrack) return null

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0
    const formatTime = (s: number) => {
        if (isNaN(s)) return "0:00"
        return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    }

    return (
        <div className="fixed bottom-6 right-6 z-[100] w-96 rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] shadow-primary/10 overflow-hidden ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Progress bar at top */}
            <div className="h-1 bg-secondary/50 cursor-pointer group" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const pct = (e.clientX - rect.left) / rect.width
                seekTo(pct * duration)
            }}>
                <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                    {/* Icon/Art */}
                    <div className="relative group">
                        <div className={`h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex shadow-inner ${isPlaying ? "animate-pulse" : ""}`}>
                            <Music className="h-6 w-6 text-primary" />
                        </div>
                        {isPlaying && (
                            <div className="absolute -inset-1 rounded-xl border border-primary/30 animate-ping opacity-20 pointer-events-none" />
                        )}
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-bold text-foreground leading-tight">{currentTrack.name}</p>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-0.5">
                            {currentPlaylist ? currentPlaylist.name : "Your Library"}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-full border border-white/5">
                        <Button variant="ghost" size="icon" onClick={prevTrack} className="h-8 w-8 rounded-full hover:bg-white/10">
                            <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={togglePlay}
                            className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform"
                        >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={nextTrack} className="h-8 w-8 rounded-full hover:bg-white/10">
                            <SkipForward className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleShuffle}
                            className={`h-7 w-7 rounded-sm transition-colors ${shuffle ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                        >
                            <Shuffle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                const modes: RepeatMode[] = ["none", "all", "one"]
                                const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length]
                                setRepeatMode(next)
                            }}
                            className={`h-7 w-7 rounded-sm transition-colors relative ${repeatMode !== "none" ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                        >
                            <Repeat className="h-3.5 w-3.5" />
                            {repeatMode === "one" && <span className="absolute text-[6px] font-black bottom-0 right-0">1</span>}
                        </Button>
                    </div>

                    <div className="flex-1 flex items-center gap-3">
                        <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volume}
                            onChange={e => setVolume(Number(e.target.value))}
                            className="flex-1 h-1 accent-primary cursor-pointer hover:accent-accent transition-colors"
                        />
                    </div>

                    <div className="text-[10px] font-mono font-bold text-muted-foreground tabular-nums">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                </div>
            </div>
        </div>
    )
}
