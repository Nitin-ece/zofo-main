"use client"

import { createContext, useContext, useState, useRef, useCallback } from "react"

export interface Track {
    id: string
    name: string
    url: string
    duration?: number
}

export interface Playlist {
    id: string
    name: string
    tracks?: Track[]
}

export type RepeatMode = "none" | "one" | "all"

interface MusicPlayerContextType {
    tracks: Track[]
    playlists: Playlist[]
    currentTrack: Track | null
    currentPlaylist: Playlist | null
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    shuffle: boolean
    repeatMode: RepeatMode
    isLoading: boolean
    addTracks: (newTracks: Track[]) => void
    removeTrack: (id: string) => void
    playTrack: (track: Track, fromPlaylist?: Playlist | null) => void
    togglePlay: () => void
    nextTrack: () => void
    prevTrack: () => void
    setVolume: (v: number) => void
    seekTo: (time: number) => void
    toggleShuffle: () => void
    setRepeatMode: (mode: RepeatMode) => void
    setPlaylists: (playlists: Playlist[]) => void
    playPlaylist: (playlistId: string) => Promise<void>
    audioRef: React.RefObject<HTMLAudioElement | null>
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null)

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
    const [tracks, setTracks] = useState<Track[]>([])
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
    const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolumeState] = useState(0.8)
    const [shuffle, setShuffle] = useState(false)
    const [repeatMode, setRepeatMode] = useState<RepeatMode>("none")
    const [isLoading, setIsLoading] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const addTracks = useCallback((newTracks: Track[]) => {
        setTracks(prev => {
            const ids = new Set(prev.map(t => t.id))
            return [...prev, ...newTracks.filter(t => !ids.has(t.id))]
        })
    }, [])

    const removeTrack = useCallback((id: string) => {
        setTracks(prev => prev.filter(t => t.id !== id))
        if (currentTrack?.id === id) {
            setCurrentTrack(null)
            setIsPlaying(false)
        }
    }, [currentTrack])

    const playTrack = useCallback((track: Track, fromPlaylist: Playlist | null = null) => {
        setCurrentTrack(track)
        setCurrentPlaylist(fromPlaylist)
        setIsPlaying(true)
        if (audioRef.current) {
            audioRef.current.src = track.url
            audioRef.current.volume = volume
            audioRef.current.play().catch(() => { })
        }
    }, [volume])

    const togglePlay = useCallback(() => {
        if (!audioRef.current || !currentTrack) return
        if (isPlaying) {
            audioRef.current.pause()
            setIsPlaying(false)
        } else {
            audioRef.current.play().catch(() => { })
            setIsPlaying(true)
        }
    }, [isPlaying, currentTrack])

    const nextTrack = useCallback(() => {
        const activeTracks = currentPlaylist?.tracks || tracks
        if (!currentTrack || activeTracks.length === 0) return

        if (repeatMode === "one") {
            playTrack(currentTrack, currentPlaylist)
            return
        }

        let next: Track
        if (shuffle) {
            const otherTracks = activeTracks.filter(t => t.id !== currentTrack.id)
            if (otherTracks.length === 0) {
               next = currentTrack
            } else {
               next = otherTracks[Math.floor(Math.random() * otherTracks.length)]
            }
        } else {
            const idx = activeTracks.findIndex(t => t.id === currentTrack.id)
            if (idx === activeTracks.length - 1) {
                if (repeatMode === "all") {
                    next = activeTracks[0]
                } else {
                    setIsPlaying(false)
                    return
                }
            } else {
                next = activeTracks[idx + 1]
            }
        }
        playTrack(next, currentPlaylist)
    }, [currentTrack, tracks, currentPlaylist, shuffle, repeatMode, playTrack])

    const prevTrack = useCallback(() => {
        const activeTracks = currentPlaylist?.tracks || tracks
        if (!currentTrack || activeTracks.length === 0) return

        let prev: Track
        const idx = activeTracks.findIndex(t => t.id === currentTrack.id)
        if (idx <= 0) {
            if (repeatMode === "all") {
                prev = activeTracks[activeTracks.length - 1]
            } else {
                prev = activeTracks[0]
            }
        } else {
            prev = activeTracks[idx - 1]
        }
        playTrack(prev, currentPlaylist)
    }, [currentTrack, tracks, currentPlaylist, repeatMode, playTrack])

    const setVolume = useCallback((v: number) => {
        setVolumeState(v)
        if (audioRef.current) audioRef.current.volume = v
    }, [])

    const seekTo = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time
            setCurrentTime(time)
        }
    }, [])

    const toggleShuffle = () => setShuffle(!shuffle)

    const playPlaylist = async (playlistId: string) => {
        const playlist = playlists.find(p => p.id === playlistId)
        if (!playlist) return
        
        setIsLoading(true)
        try {
            const { getPlaylistSongs } = await import("@/lib/database")
            const playlistTracks = await getPlaylistSongs(playlistId)
            const fullPlaylist = { ...playlist, tracks: playlistTracks }
            
            // Re-sync local playlists state with tracks
            setPlaylists(prev => prev.map(p => p.id === playlistId ? fullPlaylist : p))
            
            if (playlistTracks.length > 0) {
                playTrack(playlistTracks[0], fullPlaylist)
            }
        } catch (err) {
            console.error("Failed to play playlist:", err)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <MusicPlayerContext.Provider value={{
            tracks, playlists, currentTrack, currentPlaylist, isPlaying, currentTime,
            duration, volume, shuffle, repeatMode, isLoading,
            addTracks, removeTrack, playTrack, togglePlay, nextTrack, prevTrack,
            setVolume, seekTo, toggleShuffle, setRepeatMode, setPlaylists, playPlaylist,
            audioRef
        }}>
            {children}
            <audio
                ref={audioRef}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
                onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
                onEnded={nextTrack}
            />
        </MusicPlayerContext.Provider>
    )
}

export function useMusicPlayer() {
    const ctx = useContext(MusicPlayerContext)
    if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider")
    return ctx
}
