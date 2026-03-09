"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Music, Upload, Play, Pause, SkipBack, SkipForward, Volume2, Trash2, Plus, List, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMusicPlayer, Track } from "@/components/music-player-context"
import { supabase } from "@/lib/supabase"
import { uploadMusic } from "@/lib/database"
import { toast } from "sonner"

function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
}

export default function MusicPage() {
    const {
        tracks, currentTrack, isPlaying, currentTime, duration, volume,
        addTracks, removeTrack, playTrack, togglePlay, nextTrack, prevTrack, setVolume, seekTo
    } = useMusicPlayer()
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const newTracks: Track[] = []
        for (const file of Array.from(files)) {
            if (file.type.startsWith("audio/")) {
                try {
                    const dbData = await uploadMusic(user.id, file, file.name.replace(/\.[^.]+$/, ""))
                    if (dbData && dbData.length > 0) {
                        newTracks.push({
                            id: dbData[0].id,
                            name: dbData[0].song_name,
                            url: dbData[0].file_url
                        })
                    }
                } catch (err) {
                    console.error(err)
                    const msg = (err as any)?.message || "Unknown error";
                    if (msg.includes("bucket_not_found") || msg.includes("Bucket not found")) {
                        toast.error("Storage Error: The 'music' bucket does not exist. Please create a public 'music' bucket in your Supabase dashboard.")
                    } else {
                        toast.error("Failed to upload music: " + msg)
                    }
                }
            }
        }
        if (newTracks.length > 0) {
            addTracks(newTracks)
            if (!currentTrack) playTrack(newTracks[0])
        }
    }, [addTracks, playTrack, currentTrack])

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                supabase.from('music_library').select('*').eq('user_id', user.id).then(({ data }) => {
                    if (data && data.length > 0) {
                        const loadedTracks = data.map(d => ({ id: d.id, name: d.song_name, url: d.file_url }))
                        addTracks(loadedTracks)
                    }
                })
            }
        })
    }, [])

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
    }

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="flex h-16 items-center justify-between px-6">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">Music</h1>
                        <p className="text-sm text-muted-foreground">Study soundtracks that keep you in flow</p>
                    </div>
                    <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                        <Upload className="h-4 w-4" /> Upload Music
                    </Button>
                    <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden"
                        onChange={e => handleFiles(e.target.files)} />
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* Now Playing */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5 backdrop-blur-sm overflow-hidden relative">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.08),transparent_60%)]" />
                        <CardContent className="relative p-8">
                            <div className="flex flex-col items-center gap-6">
                                {/* Album art placeholder */}
                                <div className="relative">
                                    <div className={`h-32 w-32 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/20 flex items-center justify-center ${isPlaying ? "shadow-[0_0_40px_-10px] shadow-primary" : ""}`}>
                                        <Music className={`h-16 w-16 text-primary/60 ${isPlaying ? "animate-pulse" : ""}`} />
                                    </div>
                                    {isPlaying && (
                                        <div className="absolute -inset-2 rounded-[20px] border border-primary/20 animate-ping opacity-30" />
                                    )}
                                </div>

                                <div className="text-center">
                                    <h2 className="text-xl font-bold text-foreground">
                                        {currentTrack ? currentTrack.name : "No track selected"}
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {currentTrack ? "Your Library" : "Upload music to begin"}
                                    </p>
                                </div>

                                {/* Progress bar */}
                                <div className="w-full max-w-md space-y-2">
                                    <div className="relative h-2 rounded-full bg-secondary overflow-hidden cursor-pointer"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const pct = (e.clientX - rect.left) / rect.width
                                            seekTo(pct * duration)
                                        }}>
                                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000" style={{ width: `${progress}%` }} />
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{formatTime(currentTime)}</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-4">
                                    <button onClick={prevTrack} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all">
                                        <SkipBack className="h-5 w-5" />
                                    </button>
                                    <button onClick={togglePlay} disabled={!currentTrack}
                                        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_30px_-5px] shadow-primary hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                        {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
                                    </button>
                                    <button onClick={nextTrack} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all">
                                        <SkipForward className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Volume */}
                                <div className="flex items-center gap-3 w-full max-w-xs">
                                    <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <input type="range" min={0} max={1} step={0.01} value={volume}
                                        onChange={e => setVolume(Number(e.target.value))}
                                        className="flex-1 h-2 accent-primary cursor-pointer" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Drop zone */}
                {tracks.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                        <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-16 cursor-pointer transition-all ${dragOver ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20 hover:border-primary/50 hover:bg-secondary/40"
                                }`}
                        >
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                                <Upload className="h-10 w-10 text-primary/60" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-foreground">Drop music files here</h3>
                                <p className="text-sm text-muted-foreground mt-1">Supports MP3, WAV, OGG and more</p>
                                <p className="text-xs text-muted-foreground mt-2">Music is saved in your browser session</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Playlist */}
                {tracks.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-foreground">
                                    <List className="h-5 w-5 text-primary" /> Your Library
                                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{tracks.length} tracks</span>
                                </CardTitle>
                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2 border-border text-sm">
                                    <Plus className="h-4 w-4" /> Add More
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <AnimatePresence>
                                    {tracks.map((track, i) => {
                                        const isActive = currentTrack?.id === track.id
                                        return (
                                            <motion.div
                                                key={track.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                transition={{ delay: i * 0.04 }}
                                                className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors border-b border-border/20 last:border-0 ${isActive ? "bg-primary/10" : "hover:bg-secondary/30"
                                                    }`}
                                                onClick={() => playTrack(track)}
                                            >
                                                {/* Play indicator or number */}
                                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-primary" : "bg-secondary"}`}>
                                                    {isActive && isPlaying
                                                        ? <Pause className="h-4 w-4 text-primary-foreground" />
                                                        : isActive
                                                            ? <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
                                                            : <span className="text-xs font-medium text-muted-foreground">{i + 1}</span>
                                                    }
                                                </div>
                                                {/* Track info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>{track.name}</p>
                                                    <p className="text-xs text-muted-foreground">Your Library</p>
                                                </div>
                                                {/* Actions */}
                                                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); removeTrack(track.id) }}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={e => { e.stopPropagation(); removeTrack(track.id) }}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Study playlist suggestions */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-foreground">Study Mood Presets</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 md:grid-cols-3">
                                {[
                                    { name: "Deep Focus", desc: "Binaural beats & ambient", icon: "🧠", color: "border-primary/30 bg-primary/5" },
                                    { name: "Chill Study", desc: "Lo-fi hip hop vibes", icon: "☕", color: "border-amber-500/30 bg-amber-500/5" },
                                    { name: "Power Mode", desc: "Energetic instrumentals", icon: "⚡", color: "border-accent/30 bg-accent/5" },
                                ].map((preset) => (
                                    <div key={preset.name} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${preset.color}`}>
                                        <span className="text-2xl">{preset.icon}</span>
                                        <div>
                                            <p className="font-semibold text-foreground text-sm">{preset.name}</p>
                                            <p className="text-xs text-muted-foreground">{preset.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-xs text-muted-foreground text-center">Upload your own music files to use your personal library</p>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
