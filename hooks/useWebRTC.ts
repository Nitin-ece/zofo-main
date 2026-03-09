"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

// Global socket connection to Railway
const SIGNALING_SERVER_URL = "https://zofo-main-production.up.railway.app";
export const socket = io(SIGNALING_SERVER_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

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
            if (!socket.connected || !userId || !userName || !roomId) return;
            socket.emit("webrtc-signal", {
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
            if (!stream) {
                console.warn(`[WebRTC] Received track from ${peerName} but no stream was found.`);
                return;
            }

            console.log(`[WebRTC] Received remote track (${event.track.kind}) from ${peerName}. Stream ID: ${stream.id}`);

            setRemoteUsers((prev) => {
                const existing = prev.find((u) => u.userId === peerId);

                // We want to combine all tracks (audio+video) from this peer into one MediaStream
                // If the peer already exists in state, we update their stream.
                if (existing) {
                    // Important: Instead of just replacing the stream, we add the new track to the existing stream
                    // However, to trigger a React re-render, it's often safer to create a new MediaStream instance
                    // containing all tracks from the remote peer.
                    const tracks = stream.getTracks();
                    const existingTracks = existing.stream.getTracks();
                    
                    // Filter out any duplicates
                    const allTracks = [...existingTracks];
                    tracks.forEach(t => {
                        if (!allTracks.find(et => et.id === t.id)) {
                            allTracks.push(t);
                        }
                    });

                    console.log(`[WebRTC] Updating existing user ${peerName} with ${allTracks.length} tracks.`);
                    return prev.map((u) =>
                        u.userId === peerId ? { ...u, stream: new MediaStream(allTracks) } : u
                    );
                }

                console.log(`[WebRTC] Adding new remote user: ${peerName}`);
                return [...prev, { userId: peerId, username: peerName, stream: new MediaStream(stream.getTracks()) }];
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
                console.log(`[WebRTC] Adding ${localStreamRef.current.getTracks().length} local tracks to peer ${peerName}`);
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current!);
                });
            } else {
                console.warn(`[WebRTC] Local media not ready yet for peer ${peerName}. Tracks will be added later in startMedia.`);
            }

            // ICE candidate → send to the specific peer
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.debug(`[WebRTC] Generated ICE candidate for ${peerName}`);
                    sendSignal("ice-candidate", peerId, event.candidate.toJSON());
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log(
                    `[WebRTC] ICE state with ${peerName}: ${pc.iceConnectionState}`
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
                    `[WebRTC] Connection state with ${peerName}: ${pc.connectionState}`
                );
                if (
                    pc.connectionState === "disconnected" ||
                    pc.connectionState === "failed" ||
                    pc.connectionState === "closed"
                ) {
                    console.log(`[WebRTC] Peer ${peerName} disconnected/failed. Cleaning up.`);
                    peersRef.current.delete(peerId);
                    hasRemoteDescRef.current.delete(peerId);
                    pendingCandidatesRef.current.delete(peerId);
                    if (mountedRef.current) {
                        setRemoteUsers((prev) => prev.filter((u) => u.userId !== peerId));
                        setIsWaiting(() => peersRef.current.size === 0);
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
        if (startingMediaRef.current || localStreamRef.current) {
             console.log("[WebRTC] startMedia called but already starting or local stream exists.");
             return;
        }
        startingMediaRef.current = true;

        try {
            setError(null);

            // Check if WebRTC media devices API is supported/available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera and microphone access is blocked or unavailable in this environment (Ensure HTTPS/Localhost).");
            }

            console.log("[WebRTC] Requesting user media...");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: { echoCancellation: true, noiseSuppression: true },
            });

            if (!mountedRef.current) {
                console.log("[WebRTC] Hook unmounted during getUserMedia. Stopping tracks.");
                stream.getTracks().forEach((t) => t.stop());
                return;
            }

            console.log(`[WebRTC] User media acquired. Tracks: ${stream.getTracks().length}`);

            // Apply initial mute/video state
            stream.getVideoTracks().forEach((t) => (t.enabled = isVideoOnRef.current));
            stream.getAudioTracks().forEach((t) => (t.enabled = !isMutedRef.current));

            localStreamRef.current = stream;
            setLocalStream(stream);
            mediaReadyRef.current = true;

            // CRITICAL FIX: Add this new stream to any existing peer connections
            // This happens if a peer joined BEFORE we turned on our camera
            if (peersRef.current.size > 0) {
                console.log(`[WebRTC] Adding new local tracks to ${peersRef.current.size} existing peers.`);
                peersRef.current.forEach(async (pc, peerId) => {
                    stream.getTracks().forEach((track) => {
                        pc.addTrack(track, stream);
                    });
                    
                    // We need to re-negotiate (send a new offer) because we added tracks
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        sendSignal("offer", peerId, offer);
                        console.log(`[WebRTC] Sent re-negotiation offer to ${peerId}`);
                    } catch (e) {
                        console.error(`[WebRTC] Failed re-negotiation with ${peerId}:`, e);
                    }
                });
            }

            // Now safe to announce presence — existing peers will initiate offers
            if (socket.connected) {
                console.log("[WebRTC] Announcing peer-joined with media ready.");
                sendSignal("peer-joined", null, { userName });
            }
        } catch (err: any) {
            console.error("[WebRTC] getUserMedia error:", err);
            if (mountedRef.current) {
                setError(err.message || "Could not access camera/microphone.");
            }
        } finally {
            startingMediaRef.current = false;
        }
    }, [sendSignal, userName]);

    // ─────────────────────────────────────────────────────────────────────────
    // stopMedia: Stop tracks, close peers, clean up channel
    // ─────────────────────────────────────────────────────────────────────────
    const stopMedia = useCallback(() => {
        console.log("[WebRTC] stopMedia called. Cleaning up...");
        // Announce departure to room peers
        if (socket.connected && userId) {
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

        // We DO NOT disconnect the global socket connection
        socket.emit("leave-room", roomId);

        if (mountedRef.current) {
            setLocalStream(null);
            setRemoteUsers([]);
            setIsWaiting(true);
            setIsConnecting(false);
        }
    }, [roomId, sendSignal, userId]);

    // ─────────────────────────────────────────────────────────────────────────
    // Controls
    // ─────────────────────────────────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        const newMuted = !isMutedRef.current;
        isMutedRef.current = newMuted;
        console.log(`[WebRTC] Toggling mute: ${newMuted}`);
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
        console.log(`[WebRTC] Toggling video: ${newVideoOn}`);
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

        const initSocket = async () => {
            if (!mountedRef.current) return;

            // Ensure the socket is connected
            if (!socket.connected) {
                console.log("[WebRTC] Connecting global socket...");
                socket.connect();
            }

            console.log(`[WebRTC] Joining room: ${roomId} as ${userName} (${userId})`);
            socket.emit("join-room", roomId);

            if (mediaReadyRef.current) {
                console.log("[WebRTC] Media already ready, announcing presence.");
                sendSignal("peer-joined", null, { userName });
            }

            const onConnectError = (err: Error) => {
                console.error("[WebRTC] Socket signaling connection error:", err);
                if (mountedRef.current) {
                    setError("Signaling connection lost. Please check your internet.");
                }
            };

            const onSignal = async (payload: any) => {
                if (!mountedRef.current) return;

                const { type, senderId, senderName, targetId, data } = payload;

                // Ignore our own signals
                if (senderId === userId) return;

                // If this signal has a specific target and it's not us, ignore it
                if (targetId && targetId !== userId) return;

                // ── Handle each signal type ──────────────────────────────────────

                if (type === "peer-joined") {
                    console.log(`[WebRTC] signal: peer-joined from ${senderName}`);
                    if (!mediaReadyRef.current) {
                        console.log("[WebRTC] Peer joined but our media isn't ready. Waiting.");
                        return;
                    }

                    if (shouldBeOfferer(senderId)) {
                        console.log(`[WebRTC] We are the offerer for ${senderName}. Sending offer.`);
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
                    } else {
                        console.log(`[WebRTC] We are the answerer for ${senderName}. Waiting for offer.`);
                    }
                } else if (type === "offer") {
                    console.log(`[WebRTC] signal: offer received from ${senderName}`);
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
                        console.log(`[WebRTC] Answer sent to ${senderName}`);
                    } catch (err) {
                        console.error("[WebRTC] Error handling offer:", err);
                        setIsConnecting(false);
                    }
                } else if (type === "answer") {
                    console.log(`[WebRTC] signal: answer received from ${senderName}`);
                    const pc = peersRef.current.get(senderId);
                    if (!pc) {
                        console.warn("[WebRTC] Received answer but no peer connection exists.");
                        return;
                    }
                    try {
                        await pc.setRemoteDescription(
                            new RTCSessionDescription(data as RTCSessionDescriptionInit)
                        );
                        hasRemoteDescRef.current.set(senderId, true);
                        await flushPendingCandidates(senderId, pc);
                        console.log(`[WebRTC] Remote description set for ${senderName}`);
                    } catch (err) {
                        console.error("[WebRTC] Error setting answer:", err);
                    }
                } else if (type === "ice-candidate") {
                    const pc = peersRef.current.get(senderId);
                    const candidate = data as RTCIceCandidateInit;

                    if (!pc || !hasRemoteDescRef.current.get(senderId)) {
                        // console.debug(`[WebRTC] Queueing ICE candidate for ${senderId}`);
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
                    console.log(`[WebRTC] signal: peer-left from ${senderName}`);
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
            };

            // Register event listeners on the global socket
            socket.on("connect_error", onConnectError);
            socket.on("webrtc-signal", onSignal);

            // Return a cleanup function for the event listeners specifically
            return () => {
                console.log("[WebRTC] Removing signal listeners.");
                socket.off("connect_error", onConnectError);
                socket.off("webrtc-signal", onSignal);
            };
        };

        let cleanupSocketHandlers: (() => void) | undefined;
        initSocket().then(cleanup => cleanupSocketHandlers = cleanup);

        return () => {
            console.log("[WebRTC] Effect cleanup. Closing peers.");
            mountedRef.current = false;
            peersRef.current.forEach((pc) => pc.close());
            peersRef.current.clear();
            hasRemoteDescRef.current.clear();
            pendingCandidatesRef.current.clear();

            // Only remove the event handlers, do not disconnect the global socket connection
            if (cleanupSocketHandlers) cleanupSocketHandlers();
            socket.emit("leave-room", roomId);
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
