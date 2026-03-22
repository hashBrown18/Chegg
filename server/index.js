require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const registerRoomHandlers = require('./socket/roomHandlers');
const registerGameHandlers = require('./socket/gameHandlers');
const registerReconnectHandlers = require('./socket/reconnectHandlers');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// In-memory store for active games (fast access, Room model for persistence)
const activeGames = new Map();
// In-memory store for disconnect timers
const disconnectTimers = new Map();

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  registerRoomHandlers(io, socket, activeGames);
  registerGameHandlers(io, socket, activeGames);
  registerReconnectHandlers(io, socket, activeGames, disconnectTimers);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // Reconnect handler's onDisconnect is registered inside registerReconnectHandlers
  });
});

// Connect to MongoDB then start server
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chegg';

mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`CHEGG server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    // Start server anyway so health check works
    server.listen(PORT, () => {
      console.log(`CHEGG server running on port ${PORT} (no DB)`);
    });
  });

module.exports = { app, server, io };
