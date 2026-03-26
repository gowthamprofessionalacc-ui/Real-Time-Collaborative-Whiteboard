// =============================================================
// CUSTOM SERVER — Next.js + Socket.io running together
// =============================================================
//
// WHY A CUSTOM SERVER?
// Next.js's built-in server only handles HTTP (request → response).
// WebSockets need a persistent connection that "upgrades" from HTTP.
//
// This file creates a Node.js HTTP server that:
// 1. Passes HTTP requests to Next.js (pages, API routes, static files)
// 2. Hands WebSocket connections to Socket.io
//
// ALTERNATIVE ARCHITECTURES:
// 1. Separate WebSocket server (different port)
//    - Pro: simpler, can scale independently
//    - Con: CORS setup, two processes to manage, two deployments
// 2. Third-party service (Pusher, Ably, Liveblocks)
//    - Pro: no server to manage, built-in scaling
//    - Con: costs money, vendor lock-in, less control
// 3. Custom server (what we're doing)
//    - Pro: one process, no CORS, full control
//    - Con: can't use `next start` directly (minor)

import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setupSocketHandlers } from "./socketHandlers";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create a raw HTTP server (Node.js built-in)
  const httpServer = createServer((req, res) => {
    // Let Next.js handle all HTTP requests
    handle(req, res);
  });

  // Attach Socket.io to the same HTTP server
  // WHY same server? The browser makes ONE connection to localhost:3000.
  // Socket.io automatically "upgrades" it from HTTP to WebSocket.
  // No extra ports, no CORS, no proxy needed.
  const io = new SocketIOServer(httpServer, {
    // CORS config — in production, restrict this to your domain
    cors: {
      origin: dev ? "*" : process.env.NEXT_PUBLIC_APP_URL,
      methods: ["GET", "POST"],
    },
    // Connection settings
    pingTimeout: 60000, // How long to wait for a pong before disconnecting
    pingInterval: 25000, // How often to ping clients
  });

  // Set up all the socket event handlers (room join, drawing sync, etc.)
  setupSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server attached`);
  });
});
