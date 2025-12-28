"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:3000", "http://192.168.29.89:5173", "https://abc123.ngrok-free.app/"],
        methods: ["GET", "POST"]
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const rooms = {};
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('join-room', (data) => {
        const { roomId, userName } = data;
        // Store user data on socket
        socket.data.userName = userName;
        socket.data.roomId = roomId;
        // Track room users
        if (!rooms[roomId])
            rooms[roomId] = [];
        rooms[roomId].push({ id: socket.id, name: userName, roomId });
        socket.join(roomId);
        // Notify others
        socket.to(roomId).emit('user-joined', {
            id: socket.id,
            name: userName
        });
        // Update room user count
        io.to(roomId).emit('room-update', {
            roomId,
            users: rooms[roomId].length
        });
        console.log(`${userName} joined room ${roomId} (${rooms[roomId].length} users)`);
    });
    socket.on('stroke', ({ roomId, stroke }) => {
        // Only broadcast to room (not sender)
        socket.to(roomId).emit('stroke', {
            userId: socket.id,
            stroke
        });
    });
    socket.on('cursor-move', ({ roomId, x, y }) => {
        const actualRoomId = socket.data.roomId;
        if (actualRoomId) {
            socket.to(actualRoomId).emit('cursor-move', {
                userId: socket.id,
                name: socket.data.userName,
                x,
                y
            });
        }
    });
    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;
        const userName = socket.data.userName;
        if (roomId && rooms[roomId]) {
            // Remove user from room
            rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
            // Notify room
            socket.to(roomId).emit('user-left', socket.id);
            io.to(roomId).emit('room-update', {
                roomId,
                users: rooms[roomId].length
            });
            console.log(`${userName} left room ${roomId}`);
        }
        console.log('User disconnected:', socket.id);
    });
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', connectedSockets: io.engine.clientsCount });
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
