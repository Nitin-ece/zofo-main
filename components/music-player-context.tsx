"use client"

import { createContext, useContext, useState, useRef, useCallback } from "react"

export interface Track {
    id: string
    name: string
    url: string
    duration?: number
}

interface MusicPlayerContextType {
    tracks: Track[]
    currentTrack: Track | null
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    addTracks: (newTracks: Track[]) => void
    removeTrack: (id: string) => void
    playTrack: (track: Track) => void
    togglePlay: () => void
    nextTrack: () => void
    prevTrack: () => void
    setVolume: (v: number) => void
    seekTo: (time: number) => void
    audioRef: React.RefObject<HTMLAudioElement | null>
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null)

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
    const [tracks, setTracks] = useState<Track[]>([])
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolumeState] = useState(0.8)
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

    const playTrack = useCallback((track: Track) => {
        setCurrentTrack(track)
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
        if (!currentTrack || tracks.length === 0) return
        const idx = tracks.findIndex(t => t.id === currentTrack.id)
        const next = tracks[(idx + 1) % tracks.length]
        playTrack(next)
    }, [currentTrack, tracks, playTrack])

    const prevTrack = useCallback(() => {
        if (!currentTrack || tracks.length === 0) return
        const idx = tracks.findIndex(t => t.id === currentTrack.id)
        const prev = tracks[(idx - 1 + tracks.length) % tracks.length]
        playTrack(prev)
    }, [currentTrack, tracks, playTrack])

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

    return (
        <MusicPlayerContext.Provider value={{
            tracks, currentTrack, isPlaying, currentTime, duration, volume,
            addTracks, removeTrack, playTrack, togglePlay, nextTrack, prevTrack,
            setVolume, seekTo, audioRef
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
