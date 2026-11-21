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
const { rearmForfeitTimers, startSweep, stopSweep, clearAllForfeitTimers } = require('./socket/gameOver');
const { clearAllDisconnectTimers } = require('./socket/reconnectHandlers');

const app = express();
const server = http.createServer(app);

// COUNCIL FIX: BUG 6 — CORS origin allows both localhost and 127.0.0.1 in dev
const CLIENT_URL = process.env.CLIENT_URL;
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const corsOrigin = CLIENT_URL || DEV_ORIGINS;

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// In-memory store for active games (fast access, Room model for persistence)
const activeGames = new Map();

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  registerRoomHandlers(io, socket, activeGames);
  registerGameHandlers(io, socket, activeGames);
  registerReconnectHandlers(io, socket, activeGames);

// COUNCIL FIX: BUG 2 — removed duplicate disconnect handler (reconnectHandlers.js owns it)
});

// Graceful shutdown — drop every timer first so the exit is not held open by
// a pending forfeit/cleanup callback, then close the server.
function shutdown(signal) {
  console.log(`${signal} received — clearing timers, stopping sweep and closing server`);
  stopSweep();
  clearAllForfeitTimers();
  clearAllDisconnectTimers();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  // Hard exit if close() hangs on open connections.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Connect to MongoDB then start server
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chegg';

mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('Connected to MongoDB');
    // SINGLE-INSTANCE WARNING: forfeit timers and game state are in-process.
    // Run exactly ONE server instance. Do not scale replicas > 1.
    console.warn('[SINGLE-INSTANCE] CHEGG server MUST run with exactly 1 replica/process. Multiple instances will break forfeit timers and reconnection.');
    server.listen(PORT, () => {
      console.log(`CHEGG server running on port ${PORT}`);
      // Re-arm forfeit timers for rooms that were mid-forfeit on restart
      const { declareForfeit } = require('./socket/reconnectHandlers');
      rearmForfeitTimers(io, activeGames, (io, code, role, username, games) => {
        declareForfeit(io, code, role, username, games);
      }).catch(e => console.error('rearm error:', e));
      // Start periodic sweep for stale rooms
      startSweep(io, activeGames);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    // Start server anyway so health check works
    server.listen(PORT, () => {
      console.log(`CHEGG server running on port ${PORT} (no DB)`);
      // Without DB we can't rearm or sweep
    });
  });

module.exports = { app, server, io };
