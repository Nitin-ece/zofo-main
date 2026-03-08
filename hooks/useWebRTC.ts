"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RemoteUser {
    userId: string;
    username: string;
    stream: MediaStream;
}

export interface WebRTCState {
    localStream: MediaStream | null;
    remoteUsers: RemoteUser[];
    error: string | null;
    isMuted: boolean;
    isVideoOn: boolean;
    isWaiting: boolean;       // true = in room but no remote peer connected yet
    isConnecting: boolean;    // true = WebRTC handshake in progress
    startMedia: () => Promise<void>;
    stopMedia: () => void;
    toggleMute: () => void;
    toggleVideo: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICE Server Config
// Includes Google STUN + OpenRelay TURN for NAT traversal on restricted networks
// ─────────────────────────────────────────────────────────────────────────────

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // TURN fallback: required when both peers are behind symmetric NAT
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useWebRTC(
    roomId?: string,
    userId?: string,
    userName?: string
): WebRTCState {
    // ── UI State ──────────────────────────────────────────────────────────────
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isWaiting, setIsWaiting] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    // ── Refs (stable across renders, no re-render on change) ──────────────────
    const localStreamRef = useRef<MediaStream | null>(null);

    /** Map of peerId → RTCPeerConnection */
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    /**
     * ICE candidate queue: holds RTCIceCandidateInit objects received BEFORE
     * setRemoteDescription() completes. Flushed once the remote description is set.
     */
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
        new Map()
    );

    /** Whether we have called setRemoteDescription for a given peer */
    const hasRemoteDescRef = useRef<Map<string, boolean>>(new Map());

    /** Socket.io client reference */
    const socketRef = useRef<Socket | null>(null);

    /** Whether media (camera/mic) is ready – used to gate peer-joined announcement */
    const mediaReadyRef = useRef(false);

    /** Guard to prevent multiple concurrent startMedia() calls */
    const startingMediaRef = useRef(false);

    /** Tracks whether the component (hook instance) is still mounted */
    const mountedRef = useRef(true);

    // ── Mutable refs for isMuted / isVideoOn avoids stale closures ────────────
    const isMutedRef = useRef(false);
    const isVideoOnRef = useRef(true);

    // ─────────────────────────────────────────────────────────────────────────
    // Core: Send a signal via Socket.io
    // ─────────────────────────────────────────────────────────────────────────
    const sendSignal = useCallback(
        (type: string, targetId: string | null, data: unknown) => {
            if (!socketRef.current || !userId || !userName || !roomId) return;
            socketRef.current.emit("webrtc-signal", {
                roomId,
                type,
                senderId: userId,
                senderName: userName,
                targetId,   // null = broadcast to all, string = targeted
                data,
            });
        },
        [userId, userName, roomId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Flush queued ICE candidates after remote description is set
    // ─────────────────────────────────────────────────────────────────────────
    const flushPendingCandidates = useCallback(
        async (peerId: string, pc: RTCPeerConnection) => {
            const queued = pendingCandidatesRef.current.get(peerId) ?? [];
            pendingCandidatesRef.current.delete(peerId);
            for (const candidate of queued) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.warn("[WebRTC] Error adding queued ICE candidate:", e);
                }
            }
        },
        []
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Handle incoming remote track — add/update RemoteUser state
    // ─────────────────────────────────────────────────────────────────────────
    const handleTrackEvent = useCallback(
        (event: RTCTrackEvent, peerId: string, peerName: string) => {
            if (!mountedRef.current) return;
            const stream = event.streams[0];
            if (!stream) return;

            setRemoteUsers((prev) => {
                const existing = prev.find((u) => u.userId === peerId);

                // Track was added to an existing stream.
                // We MUST create a new MediaStream instance so React state 
                // detects the change and triggers the RemoteVideo's useEffect.
                const newStream = new MediaStream(stream.getTracks());

                if (existing) {
                    return prev.map((u) =>
                        u.userId === peerId ? { ...u, stream: newStream } : u
                    );
                }
                return [...prev, { userId: peerId, username: peerName, stream: newStream }];
            });

            setIsWaiting(false);
            setIsConnecting(false);
        },
        []
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Create a new RTCPeerConnection for a given peer
    // ─────────────────────────────────────────────────────────────────────────
    const createPeerConnection = useCallback(
        (peerId: string, peerName: string) => {
            // Prevent duplicate connections
            if (peersRef.current.has(peerId)) {
                console.log(`[WebRTC] Connection for ${peerId} already exists, reusing.`);
                return peersRef.current.get(peerId)!;
            }

            console.log(`[WebRTC] Creating peer connection for ${peerName} (${peerId})`);
            const pc = new RTCPeerConnection(ICE_SERVERS);

            // Add local tracks (if media is ready) so the remote peer receives our stream
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current!);
                });
            }

            // ICE candidate → send to the specific peer
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    sendSignal("ice-candidate", peerId, event.candidate.toJSON());
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log(
                    `[WebRTC] ICE state with ${peerId}: ${pc.iceConnectionState}`
                );
                if (pc.iceConnectionState === "failed") {
                    console.warn("[WebRTC] ICE failed — attempting ICE restart");
                    pc.restartIce();
                }
            };

            // Remote stream arrived
            pc.ontrack = (event) => handleTrackEvent(event, peerId, peerName);

            // Clean up disconnected peers
            pc.onconnectionstatechange = () => {
                console.log(
                    `[WebRTC] Connection state with ${peerId}: ${pc.connectionState}`
                );
                if (
                    pc.connectionState === "disconnected" ||
                    pc.connectionState === "failed" ||
                    pc.connectionState === "closed"
                ) {
                    peersRef.current.delete(peerId);
                    hasRemoteDescRef.current.delete(peerId);
                    pendingCandidatesRef.current.delete(peerId);
                    if (mountedRef.current) {
                        setRemoteUsers((prev) => prev.filter((u) => u.userId !== peerId));
                        setIsWaiting((prev) => {
                            const remainingPeers = peersRef.current.size;
                            return remainingPeers === 0 ? true : prev;
                        });
                    }
                }
            };

            peersRef.current.set(peerId, pc);
            return pc;
        },
        [handleTrackEvent, sendSignal]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // startMedia: Capture camera + microphone
    // Only announces presence to the room after media is ready.
    // ─────────────────────────────────────────────────────────────────────────
    const startMedia = useCallback(async () => {
        if (startingMediaRef.current || localStreamRef.current) return;
        startingMediaRef.current = true;

        try {
            setError(null);

            // Check if WebRTC media devices API is supported/available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                if (mountedRef.current) {
                    setError(
                        "Camera and microphone access is blocked. This usually happens if you are accessing the app over HTTP (like a local network IP) instead of localhost or HTTPS."
                    );
                }
                startingMediaRef.current = false;
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: { echoCancellation: true, noiseSuppression: true },
            });

            if (!mountedRef.current) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }

            // Apply initial mute/video state
            stream.getVideoTracks().forEach((t) => (t.enabled = isVideoOnRef.current));
            stream.getAudioTracks().forEach((t) => (t.enabled = !isMutedRef.current));

            localStreamRef.current = stream;
            setLocalStream(stream);
            mediaReadyRef.current = true;

            // Now safe to announce presence — existing peers will initiate offers
            if (socketRef.current?.connected) {
                sendSignal("peer-joined", null, { userName });
            }
        } catch (err) {
            console.error("[WebRTC] getUserMedia error:", err);
            if (mountedRef.current) {
                setError(
                    "Could not access camera or microphone. Please allow permissions in your browser."
                );
            }
        } finally {
            startingMediaRef.current = false;
        }
    }, [sendSignal, userName]);

    // ─────────────────────────────────────────────────────────────────────────
    // stopMedia: Stop tracks, close peers, clean up channel
    // ─────────────────────────────────────────────────────────────────────────
    const stopMedia = useCallback(() => {
        // Announce departure to room peers
        if (socketRef.current?.connected && userId) {
            sendSignal("peer-left", null, null);
        }

        // Stop all media tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        mediaReadyRef.current = false;
        startingMediaRef.current = false;

        // Close all peer connections
        peersRef.current.forEach((pc) => pc.close());
        peersRef.current.clear();
        hasRemoteDescRef.current.clear();
        pendingCandidatesRef.current.clear();

        // Remove socket connection
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        if (mountedRef.current) {
            setLocalStream(null);
            setRemoteUsers([]);
            setIsWaiting(true);
            setIsConnecting(false);
        }
    }, [sendSignal, userId]);

    // ─────────────────────────────────────────────────────────────────────────
    // Controls
    // ─────────────────────────────────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        const newMuted = !isMutedRef.current;
        isMutedRef.current = newMuted;
        if (localStreamRef.current) {
            localStreamRef.current
                .getAudioTracks()
                .forEach((t) => (t.enabled = !newMuted));
        }
        setIsMuted(newMuted);
    }, []);

    const toggleVideo = useCallback(() => {
        const newVideoOn = !isVideoOnRef.current;
        isVideoOnRef.current = newVideoOn;
        if (localStreamRef.current) {
            localStreamRef.current
                .getVideoTracks()
                .forEach((t) => (t.enabled = newVideoOn));
        }
        setIsVideoOn(newVideoOn);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Signaling effect: Subscribe to Socket.io WebRTC namespace
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!roomId || !userId || !userName) return;

        mountedRef.current = true;

        /**
         * Offer arbitration: the peer with the SMALLER userId string always sends
         * the offer. This prevents both peers from creating offers simultaneously.
         */
        const shouldBeOfferer = (peerId: string) => userId < peerId;

        // Initialize socket.io connection pointing to our custom Next.js API route
        const initSocket = async () => {
            // Ping the Next.js API route once so it boots up the socket IO server 
            await fetch("/api/socket/io");

            if (!mountedRef.current) return;

            const socket = io({
                path: "/api/socket/io",
                addTrailingSlash: false,
            });

            socketRef.current = socket;

            socket.on("connect", () => {
                console.log("[WebRTC] Socket signaling connected");
                socket.emit("join-room", roomId);

                if (mediaReadyRef.current) {
                    sendSignal("peer-joined", null, { userName });
                }
            });

            socket.on("connect_error", (err: Error) => {
                console.error("[WebRTC] Socket connect error:", err);
                if (mountedRef.current) {
                    setError("Signaling connection lost. Please leave and rejoin the room (Socket Error).");
                }
            });

            socket.on("webrtc-signal", async (payload: any) => {
                if (!mountedRef.current) return;

                const { type, senderId, senderName, targetId, data } = payload;

                // Ignore our own signals
                if (senderId === userId) return;

                // If this signal has a specific target and it's not us, ignore it
                if (targetId && targetId !== userId) return;

                // ── Handle each signal type ──────────────────────────────────────

                if (type === "peer-joined") {
                    console.log(`[WebRTC] peer-joined from ${senderName} (${senderId})`);
                    if (!mediaReadyRef.current) return;

                    if (shouldBeOfferer(senderId)) {
                        const pc = createPeerConnection(senderId, senderName);
                        setIsConnecting(true);
                        try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            sendSignal("offer", senderId, offer);
                        } catch (err) {
                            console.error("[WebRTC] Error creating offer:", err);
                            setIsConnecting(false);
                        }
                    }
                } else if (type === "offer") {
                    console.log(`[WebRTC] offer received from ${senderName} (${senderId})`);
                    let pc = peersRef.current.get(senderId);
                    if (!pc) {
                        pc = createPeerConnection(senderId, senderName);
                    }
                    setIsConnecting(true);
                    try {
                        await pc.setRemoteDescription(
                            new RTCSessionDescription(data as RTCSessionDescriptionInit)
                        );
                        hasRemoteDescRef.current.set(senderId, true);
                        await flushPendingCandidates(senderId, pc);

                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        sendSignal("answer", senderId, answer);
                    } catch (err) {
                        console.error("[WebRTC] Error handling offer:", err);
                        setIsConnecting(false);
                    }
                } else if (type === "answer") {
                    console.log(`[WebRTC] answer received from ${senderName} (${senderId})`);
                    const pc = peersRef.current.get(senderId);
                    if (!pc) return;
                    try {
                        await pc.setRemoteDescription(
                            new RTCSessionDescription(data as RTCSessionDescriptionInit)
                        );
                        hasRemoteDescRef.current.set(senderId, true);
                        await flushPendingCandidates(senderId, pc);
                    } catch (err) {
                        console.error("[WebRTC] Error setting answer:", err);
                    }
                } else if (type === "ice-candidate") {
                    const pc = peersRef.current.get(senderId);
                    const candidate = data as RTCIceCandidateInit;

                    if (!pc || !hasRemoteDescRef.current.get(senderId)) {
                        const queue = pendingCandidatesRef.current.get(senderId) ?? [];
                        queue.push(candidate);
                        pendingCandidatesRef.current.set(senderId, queue);
                        return;
                    }
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.warn("[WebRTC] Error adding ICE candidate:", err);
                    }
                } else if (type === "peer-left") {
                    console.log(`[WebRTC] peer-left from ${senderName} (${senderId})`);
                    const pc = peersRef.current.get(senderId);
                    if (pc) {
                        pc.close();
                        peersRef.current.delete(senderId);
                        hasRemoteDescRef.current.delete(senderId);
                        pendingCandidatesRef.current.delete(senderId);
                    }
                    if (mountedRef.current) {
                        setRemoteUsers((prev) => prev.filter((u) => u.userId !== senderId));
                        if (peersRef.current.size === 0) setIsWaiting(true);
                    }
                }
            });
        };

        initSocket();

        return () => {
            mountedRef.current = false;
            peersRef.current.forEach((pc) => pc.close());
            peersRef.current.clear();
            hasRemoteDescRef.current.clear();
            pendingCandidatesRef.current.clear();

            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, userId, userName, createPeerConnection, flushPendingCandidates, sendSignal]);

    // ─────────────────────────────────────────────────────────────────────────
    // Return public API
    // ─────────────────────────────────────────────────────────────────────────
    return {
        localStream,
        remoteUsers,
        error,
        isMuted,
        isVideoOn,
        isWaiting,
        isConnecting,
        startMedia,
        stopMedia,
        toggleMute,
        toggleVideo,
    };
}
