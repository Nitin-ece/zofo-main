"use client"

import { useState, useEffect, useRef } from "react"
import {
  Plus, Users, Video, VideoOff, Mic, MicOff, MessageSquare, PhoneOff,
  Copy, Check, Search, Lock, Globe, Sparkles, Send, X, AlertCircle, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollReveal } from "@/components/scroll-reveal"
import { useAuth } from "@/components/auth-provider"
import { getPublicRooms, createStudyRoom, joinRoom, leaveRoom, sendMessage, getRoomMessages, deleteRoom } from "@/lib/database"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { z } from "zod"
import { useWebRTC } from "@/hooks/useWebRTC"

// Helper component to reliably bind remote MediaStreams to a video element
function RemoteVideo({ stream, className, userId }: { stream: MediaStream; className?: string; userId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log(`[UI] Binding stream to video element for user: ${userId}. Tracks: ${stream.getTracks().length}`);
      videoRef.current.srcObject = stream;
    } else {
      console.warn(`[UI] Missing videoRef or stream for user: ${userId}`);
    }
  }, [stream, userId]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={className}
    />
  );
}

const RoomSchema = z.object({
  name: z.string().min(3, "Room name must be at least 3 characters").max(50, "Room name too long"),
  subject: z.string().min(2, "Subject must be at least 2 characters").max(30, "Subject too long"),
  max_participants: z.number().min(2).max(20)
})

const MessageSchema = z.string().min(1, "Message cannot be empty").max(500, "Message too long")

interface Room {
  id: string
  name: string
  host: { username: string; email: string }
  participants: number
  max_participants: number
  subject: string
  is_private: boolean
  is_live: boolean
  room_code: string
}

interface ChatMessage {
  id: string
  user: string
  avatar: string
  message: string
  timestamp: Date
  isAI?: boolean
  user_id?: string
}

export default function RoomsPage() {
  const { user } = useAuth()
  const [activeView, setActiveView] = useState<"browse" | "room">("browse")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [chatInput, setChatInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [isJoiningByCode, setIsJoiningByCode] = useState(false)

  // Real data states
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // New Room Form state
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomSubject, setNewRoomSubject] = useState("")
  const [newRoomMax, setNewRoomMax] = useState(8)
  const [newRoomPrivate, setNewRoomPrivate] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState<string | null>(null)

  // WebRTC states
  const { localStream, remoteUsers, error: mediaError, isMuted, isVideoOn, isWaiting, isConnecting, startMedia, stopMedia, toggleMute, toggleVideo } = useWebRTC(
    activeRoom?.id,
    user?.id,
    user?.email?.split('@')[0] || "User"
  )
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOn]);

  // Fetch live rooms on mount and subscribe to changes
  useEffect(() => {
    fetchRooms()

    // 1. Subscribe to study_rooms changes
    const roomSub = supabase
      .channel('public:study_rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_rooms' }, () => {
        fetchRooms()
      })
      .subscribe()

    // 2. Subscribe to room_participants changes
    const participantSub = supabase
      .channel('public:room_participants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, () => {
        fetchRooms() // update counts in browser
      })
      .subscribe()

    // 3. Subscribe to study_rooms deletions specifically for kicking users
    const roomDeleteSub = supabase
      .channel('public:study_rooms:delete')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'study_rooms' }, (payload) => {
        // If the room we are sitting in got deleted by the host, kick us out
        setActiveRoom(currentRoom => {
          if (currentRoom && currentRoom.id === payload.old.id) {
            toast.error("The host has ended this class.")
            setActiveView("browse")
            stopMedia()
            return null
          }
          return currentRoom
        })
        fetchRooms() // Also refresh the public list
      })
      .subscribe()

    return () => {
      roomSub.unsubscribe()
      participantSub.unsubscribe()
      roomDeleteSub.unsubscribe()
    }
  }, [])

  // Handle local webcam, DB join/leave, and Messages subscription when in 'room' view
  useEffect(() => {
    let currentRoomId: string | null = null;
    let messageSub: any = null;

    if (activeView === "room" && activeRoom && user) {
      currentRoomId = activeRoom.id;
      startMedia();
      joinRoom(currentRoomId, user.id).catch(console.error);

      // Handle raw tab close / navigation
      const handleBeforeUnload = () => {
        if (currentRoomId && user) {
          leaveRoom(currentRoomId, user.id).catch(console.error);
        }
      };
      window.addEventListener("beforeunload", handleBeforeUnload);

      // Fetch existing messages
      getRoomMessages(currentRoomId).then(async (data) => {
        const messagesData = data || [];

        // Fetch usernames for all messages manually to avoid schema join issues
        const userIds = Array.from(new Set(messagesData.map(m => m.user_id).filter(Boolean)));
        let userMap: Record<string, string> = {};

        if (userIds.length > 0) {
          const { data: usersData } = await supabase.from('users').select('id, username').in('id', userIds);
          if (usersData) {
            usersData.forEach(u => { userMap[u.id] = u.username });
          }
        }

        const formatted = messagesData.map((m: any) => {
          const uName = userMap[m.user_id] || "Unknown";
          return {
            id: m.id,
            user: uName,
            avatar: uName.substring(0, 2).toUpperCase(),
            message: m.message,
            timestamp: new Date(m.created_at),
            user_id: m.user_id
          }
        })
        setMessages(formatted)
      }).catch(console.error)

      // Subscribe to fresh messages
      messageSub = supabase
        .channel(`room_messages:${currentRoomId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${currentRoomId}`
        }, async (payload) => {
          // Fetch user data for the new message
          const { data: userData } = await supabase.from('users').select('username').eq('id', payload.new.user_id).single()
          const fetchedName = userData?.username || "Unknown"

          const newMessage: ChatMessage = {
            id: payload.new.id,
            user: fetchedName,
            avatar: fetchedName.substring(0, 2).toUpperCase(),
            message: payload.new.message,
            timestamp: new Date(payload.new.created_at),
            user_id: payload.new.user_id
          }
          setMessages(prev => {
            // Avoid duplicate if we just sent it
            if (prev.some(m => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
        })
        .subscribe()

      // Cleanup: leave room and unsubscribe
      return () => {
        stopMedia();
        window.removeEventListener("beforeunload", handleBeforeUnload);
        if (currentRoomId && user) {
          leaveRoom(currentRoomId, user.id).catch(console.error);
        }
        if (messageSub) messageSub.unsubscribe()
      }
    } else {
      stopMedia();
      setMessages([])
    }

    // Cleanup for browse mode
    return () => {
      stopMedia();
      if (currentRoomId && user?.id) {
        leaveRoom(currentRoomId, user.id).catch(console.error);
      }
      if (messageSub) messageSub.unsubscribe()
    }
  }, [activeView, activeRoom?.id, user?.id])

  const fetchRooms = async () => {
    // only set loading true on first load to avoid flickering
    try {
      const data = await getPublicRooms()
      setRooms(data as any)
    } catch (err) {
      console.error("Failed to fetch rooms:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!user) {
      console.error("User is not authenticated");
      toast.error("Please sign in to create a room.");
      return;
    }

    // Validation with Zod
    const validation = RoomSchema.safeParse({
      name: newRoomName.trim(),
      subject: newRoomSubject.trim(),
      max_participants: newRoomMax
    })

    if (!validation.success) {
      toast.error(validation.error.errors[0].message)
      return
    }

    setIsCreating(true)

    try {
      const code = `ZOFO-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

      const newRoom = await createStudyRoom({
        host_id: user.id,
        name: newRoomName.trim(),
        subject: newRoomSubject.trim(),
        max_participants: newRoomMax,
        is_private: newRoomPrivate,
        room_code: code
      })



      setShowCreateModal(false)
      setActiveRoom({
        ...newRoom,
        host: { username: "You", email: user.email }
      } as any)
      setActiveView("room")

      // refresh background list
      fetchRooms()
      toast.success("Room created successfully!");
    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || "Unknown error occurred";
      console.error("[UI] Failed to create room. Real Error:", errorMessage);
      toast.error(`Creation failed: ${errorMessage}`);
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyCode = () => {
    if (activeRoom) {
      navigator.clipboard.writeText(activeRoom.room_code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleSendMessage = async () => {
    if (!activeRoom || !user) return

    const input = chatInput.trim()

    // Validation
    const validation = MessageSchema.safeParse(input)
    if (!validation.success) {
      // Don't toast for empty messages, just return
      if (input.length > 0) toast.error(validation.error.errors[0].message)
      return
    }

    setChatInput("")

    try {
      await sendMessage(activeRoom.id, user.id, input)
      // The realtime subscription will handle adding it to the UI
    } catch (err) {
      console.error("Failed to send message:", err)
    }

    // Still simulate local AI response for better UX
    if (input.includes("?")) {
      setTimeout(() => {
        const aiResponse: ChatMessage = {
          id: `ai-${Date.now()}`,
          user: "AskZoFo",
          avatar: "ZF",
          message: "That's a great question! Based on common study patterns, I'd recommend focusing on...",
          timestamp: new Date(),
          isAI: true
        }
        setMessages(prev => [...prev, aiResponse])
      }, 1500)
    }
  }

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.host?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleEndClass = async () => {
    if (!activeRoom || !user) return;

    try {
      await deleteRoom(activeRoom.id, user.id);
      toast.success("Class ended and room deleted.");
    } catch (e) {
      console.error("Failed to delete room:", e);
      toast.error("Failed to end the class.");
    }

    setActiveView("browse");
    setActiveRoom(null);
    stopMedia();
    fetchRooms();
  }

  const handleLeaveRoom = () => {
    setActiveView("browse");
    setActiveRoom(null);
    stopMedia();
    fetchRooms();
  }

  // Join a room by typing its code in the search bar
  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    if (!user) { toast.error("Please sign in to join a room."); return }

    setIsJoiningByCode(true)
    try {
      // Look for a matching public or host-owned room
      const { data, error } = await supabase
        .from('study_rooms')
        .select('*, host:users(username, email)')
        .eq('room_code', code)
        .eq('is_live', true)
        .single()

      if (error || !data) {
        toast.error("Room not found. Double-check the code and try again.")
        return
      }

      setActiveRoom(data as any)
      setActiveView("room")
      setJoinCode("")
    } catch (err) {
      console.error("Join by code failed:", err)
      toast.error("Failed to join room.")
    } finally {
      setIsJoiningByCode(false)
    }
  }

  if (activeView === "room" && activeRoom) {
    const isHost = activeRoom.host?.email === user?.email || activeRoom.host?.username === user?.user_metadata?.username;

    return (
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Video Grid */}
        <div className={`flex flex-1 flex-col ${showChat ? 'pr-80' : ''} transition-all duration-300`}>
          {/* Room Header */}
          <div className="flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{activeRoom.name}</h2>
                <p className="text-xs text-muted-foreground">{activeRoom.participants} participant(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyCode} className="gap-2 border-border">
                {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {activeRoom.room_code}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowChat(!showChat)} className={showChat ? "bg-primary/10 text-primary" : "text-muted-foreground"}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Video Grid */}
          <div className="flex-1 overflow-y-auto bg-black/50 p-4">
            {mediaError && (
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-500/10 p-4 text-red-500 border border-red-500/20">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">{mediaError}</p>
              </div>
            )}
            <div className="grid h-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Local User Video */}
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-card/30 backdrop-blur-sm border border-border/50">
                {isVideoOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted // Local user is always muted to themselves to prevent echo
                    className="h-full w-full object-cover [transform:rotateY(180deg)]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/20 text-3xl font-bold text-primary">
                      YO
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
                  <span className="text-sm font-medium text-white">You</span>
                  {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
                </div>
              </div>

              {/* Remote Users Videos */}
              {remoteUsers.map((remoteUser) => (
                <div key={remoteUser.userId} className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-card/30 backdrop-blur-sm border border-border/50">
                  <RemoteVideo
                    userId={remoteUser.userId}
                    stream={remoteUser.stream}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
                    <span className="text-sm font-medium text-white">{remoteUser.username}</span>
                  </div>
                </div>
              ))}

              {/* Connecting indicator — shown while WebRTC handshake is in progress */}
              {isConnecting && remoteUsers.length === 0 && (
                <div className="relative flex aspect-video items-center justify-center rounded-xl border border-border/50 bg-card/10 backdrop-blur-sm">
                  <div className="text-center">
                    <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">Connecting to peer...</p>
                    <p className="text-xs text-muted-foreground mt-1">Establishing secure video connection</p>
                  </div>
                </div>
              )}

              {/* Waiting for others placeholder — shown when alone in the room */}
              {isWaiting && !isConnecting && remoteUsers.length === 0 && (
                <div className="relative flex aspect-video items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/10 backdrop-blur-sm">
                  <div className="text-center">
                    <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">Waiting for others to join...</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Share the room code: <span className="font-mono text-primary">{activeRoom.room_code}</span></p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Controls */}
          <div className="flex h-20 items-center justify-center gap-4 border-t border-border/40 bg-background/80 backdrop-blur-xl">
            <Button variant={isMuted ? "destructive" : "outline"} size="lg" onClick={toggleMute} className="h-14 w-14 rounded-full">
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <Button variant={!isVideoOn ? "destructive" : "outline"} size="lg" onClick={toggleVideo} className="h-14 w-14 rounded-full">
              {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>

            <div className="flex items-center gap-4 border-l border-border/40 pl-4">
              {isHost && (
                <div className="flex flex-col items-center">
                  <Button variant="destructive" size="lg"
                    onClick={handleEndClass}
                    className="h-14 w-14 rounded-full"
                  >
                    <X className="h-6 w-6" />
                  </Button>
                  <span className="text-[10px] text-destructive mt-1 font-medium tracking-wide">
                    END CLASS
                  </span>
                </div>
              )}

              <div className="flex flex-col items-center">
                <Button variant="secondary" size="lg"
                  onClick={handleLeaveRoom}
                  className="h-14 w-14 rounded-full bg-secondary hover:bg-secondary/80 text-foreground"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
                <span className="text-[10px] text-muted-foreground mt-1 font-medium tracking-wide">
                  LEAVE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="fixed right-0 top-0 flex h-full w-80 flex-col border-l border-border/40 bg-background pt-16 transition-transform">
            <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
              <h3 className="font-semibold text-foreground">Room Chat</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowChat(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${msg.isAI ? "bg-gradient-to-br from-primary to-accent text-white" : "bg-secondary text-secondary-foreground"
                      }`}>
                      {msg.isAI ? <Sparkles className="h-4 w-4" /> : msg.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${msg.isAI ? "text-primary" : "text-foreground"}`}>{msg.user}</span>
                        <span className="text-xs text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground flex-wrap break-words">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AskZoFo Quick Access */}
            <div className="border-t border-border/40 p-3">
              <button className="flex w-full items-center gap-2 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 p-3 text-left transition-colors hover:from-primary/20 hover:to-accent/20">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">AskZoFo</p>
                  <p className="text-xs text-muted-foreground">Ask AI a study question</p>
                </div>
              </button>
            </div>

            {/* Input */}
            <div className="border-t border-border/40 p-3">
              <div className="flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} placeholder="Type a message..." className="border-border bg-input" />
                <Button onClick={handleSendMessage} size="icon" className="shrink-0 bg-primary text-primary-foreground">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">ZoFo Rooms</h1>
            <p className="text-sm text-muted-foreground">Study with friends in live video rooms</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={fetchRooms} className="border-border/40 text-muted-foreground" disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button suppressHydrationWarning onClick={() => setShowCreateModal(true)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Create Room
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Search */}
        <ScrollReveal>
          <div className="mb-6 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input suppressHydrationWarning value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search rooms by name, subject, or host..." className="border-border bg-card pl-10" />
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                placeholder="Room Code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                suppressHydrationWarning
                className="w-full border-border bg-background sm:w-40 font-mono uppercase"
              />
              <Button
                onClick={handleJoinByCode}
                disabled={isJoiningByCode || !joinCode.trim()}
                className="shrink-0 bg-primary/20 text-primary hover:bg-primary/30"
              >
                {isJoiningByCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
              </Button>
            </div>
          </div>
        </ScrollReveal>

        {/* Public Rooms */}
        <ScrollReveal delay={100}>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Global Study Rooms</h2>
        </ScrollReveal>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[200px] rounded-xl border border-border/50 bg-card/20 animate-pulse">
                <div className="flex flex-col h-full p-5 space-y-4">
                  <div className="flex justify-between">
                    <div className="h-6 w-1/2 bg-muted rounded" />
                    <div className="h-4 w-4 bg-muted rounded" />
                  </div>
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="flex gap-2">
                    <div className="h-4 w-12 bg-muted rounded-full" />
                    <div className="h-4 w-16 bg-muted rounded-full" />
                  </div>
                  <div className="mt-auto h-10 w-full bg-muted rounded" />
                </div>
              </div>
            ))
          ) : filteredRooms.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl bg-card/20">
              No active study rooms right now. Be the first to create one!
            </div>
          ) : filteredRooms.map((room, i) => (
            <ScrollReveal key={room.id} delay={200 + i * 50}>
              <Card className="group border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{room.name}</h3>
                        {room.is_live && (
                          <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground truncate">Hosted by {room.host?.username || "Unknown"}</p>
                    </div>
                    {room.is_private ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Globe className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {room.participants}/{room.max_participants}
                    </span>
                    <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-xs">
                      {room.subject}
                    </span>
                  </div>

                  <Button
                    onClick={async () => {
                      if (!user) {
                        toast.error("Please sign in to join a room.");
                        return;
                      }
                      setIsJoining(room.id)
                      // Simulate a small delay for better UX feel
                      await new Promise(r => setTimeout(r, 600))
                      setActiveRoom(room);
                      setActiveView("room");
                      setIsJoining(null)
                    }}
                    disabled={isJoining === room.id || room.participants >= room.max_participants}
                    className="w-full gap-2 bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                  >
                    {isJoining === room.id ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                    {isJoining === room.id ? "Joining..." : room.participants >= room.max_participants ? "Room Full" : "Join Room"}
                  </Button>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md border-border/50 bg-card animate-in zoom-in-95">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-foreground">
                Create Study Room
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Room Name</label>
                <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="e.g., Late Night Calculus" className="border-border bg-input" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Subject</label>
                <Input value={newRoomSubject} onChange={e => setNewRoomSubject(e.target.value)} placeholder="e.g., Mathematics" className="border-border bg-input" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Max Participants</label>
                <Input value={newRoomMax} onChange={e => setNewRoomMax(parseInt(e.target.value))} type="number" min={2} max={20} className="border-border bg-input" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="private" checked={newRoomPrivate} onChange={e => setNewRoomPrivate(e.target.checked)} className="h-4 w-4 rounded border-border" />
                <label htmlFor="private" className="text-sm text-foreground">Make room private (invite code only)</label>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button
                  className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim() || !newRoomSubject.trim() || isCreating}
                >
                  {isCreating ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  {isCreating ? "Creating..." : "Create & Join"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
