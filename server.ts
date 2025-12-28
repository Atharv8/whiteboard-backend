import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { 
    origin: ["http://localhost:5173", "http://localhost:3000","https://whiteboard-backend-ngem.onrender.com","https://whiteboard-frontend-cyan.vercel.app/"], 
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

interface Point { x: number; y: number; }
interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  userId: string;
}

interface User {
  id: string;
  name: string;
  roomId: string;
}

const rooms: Record<string, User[]> = {};

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (data: { roomId: string; userName: string }) => {
    const { roomId, userName } = data;
    
    // Store user data on socket
    socket.data.userName = userName;
    socket.data.roomId = roomId;
    
    // Track room users
    if (!rooms[roomId]) rooms[roomId] = [];
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
  
  socket.on('stroke', ({ roomId, stroke }: { roomId: string; stroke: Stroke }) => {
    // Only broadcast to room (not sender)
    socket.to(roomId).emit('stroke', { 
      userId: socket.id, 
      stroke 
    });
  });
  
  socket.on('cursor-move', ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
    const actualRoomId = socket.data.roomId as string;
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
    const roomId = socket.data.roomId as string;
    const userName = socket.data.userName as string;
    
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
