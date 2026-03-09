import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Music, Upload, Play, Pause, SkipBack, SkipForward, 
    Volume2, Trash2, Plus, List, Heart, Shuffle, Repeat,
    MoreVertical, FolderPlus, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
    DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu"
import { 
    Dialog, DialogContent, DialogDescription, 
    DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useMusicPlayer, Track, RepeatMode } from "@/components/music-player-context"
import { supabase } from "@/lib/supabase"
import { 
    uploadMusic, getPlaylists, createPlaylist, 
    addSongToPlaylist, getPlaylistSongs, deletePlaylist,
    removeSongFromPlaylist
} from "@/lib/database"
import { toast } from "sonner"

function formatTime(s: number) {
    if (isNaN(s)) return "0:00"
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
}

export default function MusicPage() {
    const {
        tracks, playlists, currentTrack, currentPlaylist, isPlaying, 
        currentTime, duration, volume, shuffle, repeatMode, isLoading: isPlayerLoading,
        addTracks, removeTrack, playTrack, togglePlay, nextTrack, prevTrack, 
        setVolume, seekTo, toggleShuffle, setRepeatMode, setPlaylists, playPlaylist
    } = useMusicPlayer()

    const [dragOver, setDragOver] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [newPlaylistName, setNewPlaylistName] = useState("")
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    const loadData = useCallback(async () => {
        setIsLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const [songsRes, playlistsRes] = await Promise.all([
                supabase.from("music_library").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
                getPlaylists(user.id)
            ])

            if (songsRes.data) {
                const loadedTracks = songsRes.data.map((d: any) => ({
                    id: d.id,
                    name: d.song_name,
                    url: d.file_url,
                    duration: d.duration
                }))
                addTracks(loadedTracks)
            }
            setPlaylists(playlistsRes)
        } catch (err) {
            console.error("Failed to load music data:", err)
            toast.error("Failed to load your music library")
        } finally {
            setIsLoading(false)
        }
    }, [addTracks, setPlaylists])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const newTracks: Track[] = []
        for (const file of Array.from(files)) {
            const allowedTypes = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a"]
            if (allowedTypes.includes(file.type) || file.name.endsWith(".m4a")) {
                try {
                    toast.loading(`Uploading ${file.name}...`, { id: "upload" })
                    const dbDataArr = await uploadMusic(user.id, file, file.name.replace(/\.[^.]+$/, ""))
                    const dbData = dbDataArr[0]
                    if (dbData) {
                        newTracks.push({
                            id: dbData.id,
                            name: dbData.song_name,
                            url: dbData.file_url
                        })
                    }
                    toast.success(`${file.name} uploaded!`, { id: "upload" })
                } catch (err) {
                    console.error(err)
                    const msg = (err as any)?.message || "Unknown error"
                    toast.error(`Failed to upload ${file.name}: ${msg}`, { id: "upload" })
                }
            } else {
                toast.error(`Unsupported file type: ${file.type}`)
            }
        }
        if (newTracks.length > 0) {
            addTracks(newTracks)
            if (!currentTrack) playTrack(newTracks[0])
        }
    }, [addTracks, playTrack, currentTrack])

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) return
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const playlist = await createPlaylist(user.id, newPlaylistName)
            setPlaylists([...playlists, playlist])
            setNewPlaylistName("")
            setIsCreateDialogOpen(false)
            toast.success("Playlist created!")
        } catch (err) {
            toast.error("Failed to create playlist")
        }
    }

    const handleAddToPlaylist = async (playlistId: string, songId: string) => {
        try {
            await addSongToPlaylist(playlistId, songId)
            toast.success("Added to playlist")
        } catch (err) {
            toast.error("Already in playlist or failed to add")
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
    }

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">Loading your library...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-24">
            <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="flex h-16 items-center justify-between px-6">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">Focus Music</h1>
                        <p className="text-sm text-muted-foreground">Flow state soundtracks</p>
                    </div>
                    <div className="flex gap-3">
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <FolderPlus className="h-4 w-4" /> New Playlist
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create Playlist</DialogTitle>
                                    <DialogDescription>Give your new study playlist a name.</DialogDescription>
                                </DialogHeader>
                                <Input 
                                    value={newPlaylistName} 
                                    onChange={e => setNewPlaylistName(e.target.value)}
                                    placeholder="e.g. Deep Work Beats"
                                    onKeyDown={e => e.key === "Enter" && handleCreatePlaylist()}
                                />
                                <DialogFooter>
                                    <Button onClick={handleCreatePlaylist}>Create</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-primary">
                            <Upload className="h-4 w-4" /> Upload Music
                        </Button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden"
                        onChange={e => handleFiles(e.target.files)} />
                </div>
            </header>

            <div className="p-6 space-y-8 max-w-7xl mx-auto">
                {/* Now Playing Section */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="lg:col-span-2">
                        <Card className="h-full border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 backdrop-blur-md overflow-hidden relative group">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.15),transparent_70%)]" />
                            <CardContent className="relative p-8 h-full flex flex-col justify-center gap-8">
                                <div className="flex flex-col md:flex-row items-center gap-8">
                                    {/* Rotating disc or pulse icon */}
                                    <div className="relative">
                                        <div className={`h-48 w-48 rounded-full bg-gradient-to-br from-primary via-accent to-primary border-4 border-background flex items-center justify-center shadow-2xl ${isPlaying ? "animate-[spin_8s_linear_infinite]" : ""}`}>
                                            <Music className="h-20 w-20 text-background/80" />
                                        </div>
                                        {isPlaying && (
                                            <div className="absolute -inset-4 rounded-full border-2 border-primary/30 animate-ping opacity-40" />
                                        )}
                                    </div>

                                    <div className="flex-1 text-center md:text-left space-y-4">
                                        <div>
                                            <h2 className="text-3xl font-black text-foreground tracking-tight line-clamp-2">
                                                {currentTrack ? currentTrack.name : "Ready to study?"}
                                            </h2>
                                            <p className="text-primary font-medium mt-1">
                                                {currentPlaylist ? `Playlist: ${currentPlaylist.name}` : "Your Library"}
                                            </p>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="space-y-2">
                                            <div className="relative h-2 rounded-full bg-secondary overflow-hidden cursor-pointer group"
                                                onClick={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect()
                                                    const pct = (e.clientX - rect.left) / rect.width
                                                    seekTo(pct * duration)
                                                }}>
                                                <div className="h-full rounded-full bg-primary transition-all duration-300 shadow-[0_0_10px_rgba(var(--primary),0.5)]" style={{ width: `${progress}%` }} />
                                            </div>
                                            <div className="flex justify-between text-xs font-medium text-muted-foreground font-mono">
                                                <span>{formatTime(currentTime)}</span>
                                                <span>{formatTime(duration)}</span>
                                            </div>
                                        </div>

                                        {/* Main Player Controls */}
                                        <div className="flex items-center justify-center md:justify-start gap-4">
                                            <Button variant="ghost" size="icon" onClick={toggleShuffle} 
                                                className={`h-10 w-10 rounded-full transition-colors ${shuffle ? "text-primary bg-primary/10" : "text-muted-foreground"}`}>
                                                <Shuffle className="h-5 w-5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={prevTrack} className="h-10 w-10 rounded-full text-foreground hover:bg-secondary">
                                                <SkipBack className="h-6 w-6" />
                                            </Button>
                                            <Button onClick={togglePlay} disabled={!currentTrack}
                                                className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-xl hover:scale-105 transition-transform disabled:opacity-50">
                                                {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={nextTrack} className="h-10 w-10 rounded-full text-foreground hover:bg-secondary">
                                                <SkipForward className="h-6 w-6" />
                                            </Button>
                                            <Button variant="ghost" size="icon" 
                                                onClick={() => {
                                                    const modes: RepeatMode[] = ["none", "all", "one"]
                                                    const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length]
                                                    setRepeatMode(next)
                                                }}
                                                className={`h-10 w-10 rounded-full transition-colors ${repeatMode !== "none" ? "text-primary bg-primary/10" : "text-muted-foreground"}`}>
                                                <Repeat className="h-5 w-5" />
                                                {repeatMode === "one" && <span className="absolute text-[8px] font-bold bottom-1">1</span>}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Playlists Sidebar */}
                    <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <List className="h-4 w-4" /> Playlists
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto px-4 space-y-2">
                            {playlists.length === 0 ? (
                                <div className="text-center py-8 px-4 opacity-40">
                                    <FolderPlus className="h-8 w-8 mx-auto mb-2" />
                                    <p className="text-xs">No playlists yet. Create one above!</p>
                                </div>
                            ) : (
                                playlists.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => playPlaylist(p.id)}
                                        className={`group flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all hover:bg-white/10 ${currentPlaylist?.id === p.id ? "bg-primary/20 text-primary border border-primary/20 shadow-lg" : "text-foreground"}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${currentPlaylist?.id === p.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                                                {currentPlaylist?.id === p.id && isPlaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold truncate">{p.name}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Playlist</p>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Library Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black flex items-center gap-3">
                            <Heart className="h-6 w-6 text-primary fill-primary" /> Your Library
                            <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-full">{tracks.length} Tracks</span>
                        </h2>
                    </div>

                    {tracks.length === 0 ? (
                        <Card className="border-dashed border-2 border-border/50 bg-transparent flex flex-col items-center justify-center p-20 text-center">
                            <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
                                <Upload className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-bold">Your library is empty</h3>
                            <p className="text-muted-foreground mt-2 max-w-xs">Upload your favorite focus tracks to build your personal productivity soundtrack.</p>
                            <Button className="mt-8 gap-2 bg-primary" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4" /> Start Uploading
                            </Button>
                        </Card>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <AnimatePresence>
                                {tracks.map((track, i) => {
                                    const isActive = currentTrack?.id === track.id
                                    return (
                                        <motion.div
                                            key={track.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                        >
                                            <Card 
                                                className={`group relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer ${isActive ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10" : "hover:bg-secondary/40"}`}
                                                onClick={() => playTrack(track, null)}
                                            >
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-transform ${isActive ? "bg-primary text-primary-foreground scale-110 shadow-lg" : "bg-secondary text-muted-foreground group-hover:scale-105"}`}>
                                                        {isActive && isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`font-bold text-sm truncate ${isActive ? "text-primary" : "text-foreground"}`}>{track.name}</h4>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Added recently</p>
                                                    </div>

                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem className="text-xs font-bold uppercase tracking-wider text-muted-foreground" disabled>
                                                                Add to Playlist
                                                            </DropdownMenuItem>
                                                            {playlists.map(p => (
                                                                <DropdownMenuItem key={p.id} onClick={() => handleAddToPlaylist(p.id, track.id)}>
                                                                    <Plus className="h-3 w-3 mr-2" /> {p.name}
                                                                </DropdownMenuItem>
                                                            ))}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => removeTrack(track.id)} className="text-destructive focus:text-destructive">
                                                                <Trash2 className="h-3 w-3 mr-2" /> Delete Track
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
