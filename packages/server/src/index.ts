// ============================================
//   index.ts
//   Boot the socket.io server.
//   Delegates all message logic to router.ts.
// ============================================

import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerHandlers, logHealth } from './router.js';
import type {
  ClientToServerEvents, ServerToClientEvents,
  InterServerEvents, SocketData,
} from './socketTypes.js';

const PORT = Number(process.env.PORT) || 8080;

const httpServer = createServer();

const io = new Server
  <ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? '*',
      methods: ['GET', 'POST'],
    },
  });

console.log(`[Server] VOID SECTOR starting on port ${PORT}`);
console.log(`[Server] ${new Date().toISOString()}`);

io.on('connection', (socket) => {
  const ip = (
    (socket.handshake.headers['x-forwarded-for'] as string | undefined) ??
    socket.handshake.address
  ).split(',')[0]?.trim();

  console.log(`[Connect] ${ip} — total: ${io.sockets.sockets.size}`);

  registerHandlers(socket);

  socket.on('disconnect', () => {
    console.log(`[Disconnect] ${ip} — total: ${io.sockets.sockets.size}`);
  });
});

// Health check log every 60s
setInterval(logHealth, 60_000);

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`[Server] ${signal} — shutting down`);
  io.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

httpServer.listen(PORT);
