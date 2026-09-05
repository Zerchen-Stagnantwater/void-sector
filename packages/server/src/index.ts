// ============================================
//   index.ts
//   Boot the WebSocket server.
//   Delegates all logic to router.ts.
// ============================================

import { WebSocketServer } from 'ws';
import { route, handleDisconnect, logHealth } from './router.js';

const PORT = Number(process.env.PORT) || 8080;

const wss = new WebSocketServer({ port: PORT });

console.log(`[Server] VOID SECTOR starting on port ${PORT}`);
console.log(`[Server] ${new Date().toISOString()}`);

wss.on('connection', (ws, req) => {
  const ip = (
    req.headers['x-forwarded-for'] as string | undefined ??
    req.socket.remoteAddress ??
    'unknown'
  ).split(',')[0]?.trim();

  console.log(`[Connect] ${ip} — total: ${wss.clients.size}`);

  ws.on('message', (raw) => {
    route(ws, raw.toString());
  });

  ws.on('close', () => {
    console.log(`[Disconnect] ${ip} — total: ${wss.clients.size}`);
    handleDisconnect(ws);
  });

  ws.on('error', (err) => {
    console.warn(`[WS Error] ${ip}:`, err.message);
  });
});

// Health check log every 60s
setInterval(logHealth, 60_000);

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`[Server] ${signal} — shutting down`);
  wss.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
