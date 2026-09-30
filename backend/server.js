require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const drawingRoutes = require('./routes/drawings');

const app = express();
const server = http.createServer(app);

// Configure CORS for Express and Socket.io
const corsOptions = {
  origin: '*', // Allow all origins for testing/development
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Support large base64 canvas saves
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Connect to MongoDB
connectDB();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/drawings', drawingRoutes);

// Base Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the AirCanvas AI Server API' });
});

// Socket.io Server Setup
const io = socketIo(server, {
  cors: corsOptions
});

// Track active rooms and room members
// Room ID -> Array of User Objects { socketId, username, color, cursorPosition: {x,y} }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle joining a collaboration room
  socket.on('join_room', ({ roomId, username, color }) => {
    socket.join(roomId);
    
    // Track user in memory
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    const roomUsers = rooms.get(roomId);
    
    // Remove if user already present in this room
    const existingIdx = roomUsers.findIndex(u => u.socketId === socket.id);
    if (existingIdx !== -1) {
      roomUsers.splice(existingIdx, 1);
    }

    const newUser = {
      socketId: socket.id,
      username: username || 'Anonymous User',
      color: color || '#FF007A',
      cursorPosition: { x: 0, y: 0 }
    };
    roomUsers.push(newUser);
    socket.roomId = roomId;
    socket.username = username;

    console.log(`${newUser.username} joined room: ${roomId}`);

    // Notify other users in the room
    socket.to(roomId).emit('user_joined', {
      socketId: socket.id,
      username: newUser.username,
      color: newUser.color,
      users: roomUsers
    });

    // Send the current user list back to the newly joined user
    socket.emit('room_users', roomUsers);
  });

  // Handle real-time hand cursor movements
  socket.on('cursor_move', (position) => {
    if (!socket.roomId) return;
    
    const roomUsers = rooms.get(socket.roomId);
    if (roomUsers) {
      const user = roomUsers.find(u => u.socketId === socket.id);
      if (user) {
        user.cursorPosition = position;
      }
    }

    // Broadcast cursor movements to other room members
    socket.to(socket.roomId).emit('cursor_update', {
      socketId: socket.id,
      position
    });
  });

  // Handle real-time drawing paths (for freehand drawing)
  socket.on('draw_stroke', (strokeData) => {
    if (!socket.roomId) return;
    // strokeData: { type, points, color, brushSize, brushType, isFirstPoint, isLastPoint }
    socket.to(socket.roomId).emit('stroke_update', {
      socketId: socket.id,
      strokeData
    });
  });

  // Handle collaborative whiteboard updates (for Fabric.js objects)
  socket.on('whiteboard_update', (whiteboardData) => {
    if (!socket.roomId) return;
    // whiteboardData: { action: 'add' | 'modify' | 'remove', object: objectData }
    socket.to(socket.roomId).emit('whiteboard_sync', whiteboardData);
  });

  // Signaling for Voice Chat / WebRTC Architecture
  socket.on('voice_signal', ({ targetSocketId, signal }) => {
    io.to(targetSocketId).emit('voice_signal_receive', {
      senderSocketId: socket.id,
      signal
    });
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socket.roomId && rooms.has(socket.roomId)) {
      const roomUsers = rooms.get(socket.roomId);
      const index = roomUsers.findIndex(u => u.socketId === socket.id);
      if (index !== -1) {
        const username = roomUsers[index].username;
        roomUsers.splice(index, 1);
        
        // Broadcast disconnection
        socket.to(socket.roomId).emit('user_left', {
          socketId: socket.id,
          username,
          users: roomUsers
        });
      }

      if (roomUsers.length === 0) {
        rooms.delete(socket.roomId);
      }
    }
  });
});

// Port configuration
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`AirCanvas Server running in production mode on port ${PORT}`);
});
