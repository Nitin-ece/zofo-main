import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";
// We need to use NextApiResponse from Next.js, but extend it to include the socket server
import { NextApiResponse } from "next";
import { Socket } from "net";

export type NextApiResponseServerIO = NextApiResponse & {
    socket: Socket & {
        server: NetServer & {
            io: ServerIO;
        };
    };
};

export const config = {
    api: {
        bodyParser: false,
    },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
    if (!res.socket.server.io) {
        const path = "/api/socket/io";
        console.log(`*New Socket.io server initializing at ${path}...`);
        // adapt Next's net Server to http Server
        const httpServer: NetServer = res.socket.server as any;
        const io = new ServerIO(httpServer, {
            path: path,
            // allow permissive CORS for development
            addTrailingSlash: false,
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // append SocketIO server to Next.js socket server response
        res.socket.server.io = io;

        io.on("connection", (socket) => {
            console.log(`Socket connected: ${socket.id}`);

            // When a user wants to enter a specific room
            socket.on("join-room", (roomId: string) => {
                socket.join(roomId);
                console.log(`Socket ${socket.id} joined room ${roomId}`);
            });

            // When an RTC peer sends a signaling message
            socket.on("webrtc-signal", (payload) => {
                // payload format: { roomId, type, senderId, senderName, targetId, data }
                // Broadcast to everyone in the room EXCEPT the sender
                socket.to(payload.roomId).emit("webrtc-signal", payload);
            });

            socket.on("disconnect", () => {
                console.log(`Socket disconnected: ${socket.id}`);
            });
        });
    }

    res.end();
};

export default ioHandler;
