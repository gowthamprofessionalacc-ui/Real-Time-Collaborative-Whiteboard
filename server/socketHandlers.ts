// =============================================================
// SOCKET EVENT HANDLERS — The real-time collaboration engine
// =============================================================
//
// HOW SOCKET.IO ROOMS WORK:
//
// A "room" is a group of connected clients. When User A joins
// room "board-123", they only receive events sent to that room.
//
//   User A ─┐
//   User B ─┤── Room "board-123"  (only these 3 see each other)
//   User C ─┘
//
//   User D ─┐── Room "board-456"  (separate board)
//   User E ─┘
//
// socket.to(roomId).emit(...)  →  sends to EVERYONE in room EXCEPT sender
// io.to(roomId).emit(...)      →  sends to EVERYONE in room INCLUDING sender
//
// WHY "EXCEPT SENDER"?
// The sender already applied the change locally (optimistic update).
// Re-receiving it would cause duplicate actions.
//
// EVENT FLOW:
//   User A draws rectangle
//   → Client sends: socket.emit("element:add", { roomId, element })
//   → Server receives, stores in memory, broadcasts to room
//   → socket.to(roomId).emit("element:add", element)
//   → Users B and C receive and add to their canvas

import { Server, Socket } from "socket.io";

// ---- IN-MEMORY BOARD STATE ----
// WHY IN-MEMORY?
// For MVP, we store board data in a JavaScript Map.
// It's fast and simple. The tradeoff: data is lost when server restarts.
//
// IN PRODUCTION, you would:
// 1. Save to PostgreSQL on every change (or batched every few seconds)
// 2. Load from DB when user joins a room
// 3. Use Redis for cross-server state (if you have multiple servers)
//
// We'll add database persistence in Phase 3.

interface BoardElement {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface CursorPosition {
  x: number;
  y: number;
  userName: string;
  color: string;
}

interface RoomState {
  elements: BoardElement[];
  users: Map<
    string,
    {
      socketId: string;
      userName: string;
      color: string;
    }
  >;
}

// Map of roomId → room state
const rooms = new Map<string, RoomState>();

// Predefined cursor colors — each user gets a unique color
const CURSOR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
];

function getOrCreateRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      elements: [],
      users: new Map(),
    });
  }
  return rooms.get(roomId)!;
}

export function setupSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // ---- JOIN ROOM ----
    // When a user opens a board, they join its room.
    // They receive the current board state so their canvas matches everyone else's.
    socket.on(
      "room:join",
      (data: { roomId: string; userName: string }, callback) => {
        const { roomId, userName } = data;
        const room = getOrCreateRoom(roomId);

        // Assign a cursor color based on how many users are in the room
        const colorIndex = room.users.size % CURSOR_COLORS.length;
        const color = CURSOR_COLORS[colorIndex];

        // Store user info
        room.users.set(socket.id, {
          socketId: socket.id,
          userName,
          color,
        });

        // Join the Socket.io room
        socket.join(roomId);

        // Store roomId on socket for cleanup on disconnect
        (socket as Socket & { roomId?: string }).roomId = roomId;

        // Send current board state to the joining user
        // WHY callback instead of emit?
        // Callbacks are like "request → response". The client
        // waits for the response before rendering. emit() is
        // fire-and-forget — the client wouldn't know when data arrives.
        if (callback) {
          callback({
            elements: room.elements,
            users: Array.from(room.users.values()),
            yourColor: color,
          });
        }

        // Notify others that someone joined
        socket.to(roomId).emit("user:joined", {
          socketId: socket.id,
          userName,
          color,
        });

        console.log(
          `${userName} joined room ${roomId} (${room.users.size} users)`
        );
      }
    );

    // ---- ELEMENT OPERATIONS ----
    // These are the core collaboration events.
    // Pattern: client makes local change → emits to server → server broadcasts

    // Add new element
    socket.on(
      "element:add",
      (data: { roomId: string; element: BoardElement }) => {
        const room = rooms.get(data.roomId);
        if (!room) return;

        room.elements.push(data.element);
        socket.to(data.roomId).emit("element:add", data.element);
      }
    );

    // Update element (move, resize, color change, etc.)
    socket.on(
      "element:update",
      (data: {
        roomId: string;
        elementId: string;
        updates: Partial<BoardElement>;
      }) => {
        const room = rooms.get(data.roomId);
        if (!room) return;

        // Apply update to server's copy
        const index = room.elements.findIndex(
          (el) => el.id === data.elementId
        );
        if (index !== -1) {
          room.elements[index] = { ...room.elements[index], ...data.updates };
        }

        socket.to(data.roomId).emit("element:update", {
          elementId: data.elementId,
          updates: data.updates,
        });
      }
    );

    // Delete element
    socket.on(
      "element:delete",
      (data: { roomId: string; elementId: string }) => {
        const room = rooms.get(data.roomId);
        if (!room) return;

        room.elements = room.elements.filter((el) => el.id !== data.elementId);
        socket.to(data.roomId).emit("element:delete", {
          elementId: data.elementId,
        });
      }
    );

    // Bulk sync — replaces entire board state
    // Used for undo/redo where the whole state changes at once
    socket.on(
      "elements:sync",
      (data: { roomId: string; elements: BoardElement[] }) => {
        const room = rooms.get(data.roomId);
        if (!room) return;

        room.elements = data.elements;
        socket.to(data.roomId).emit("elements:sync", data.elements);
      }
    );

    // ---- CURSOR PRESENCE ----
    // WHY CURSOR PRESENCE?
    // Seeing where other users are looking/working prevents conflicts.
    // "Oh, User B is working on the top-right section, I'll work bottom-left."
    // Figma, Google Docs, and Miro all show live cursors.
    //
    // HOW IT WORKS:
    // Every ~50ms, each client sends their cursor position.
    // Server broadcasts to other users in the room.
    //
    // WHY NOT SAVE CURSORS ON SERVER?
    // Cursors are ephemeral — they only matter right now.
    // No need to persist them. We just relay them.
    socket.on(
      "cursor:move",
      (data: { roomId: string; cursor: CursorPosition }) => {
        socket.to(data.roomId).emit("cursor:move", {
          socketId: socket.id,
          cursor: data.cursor,
        });
      }
    );

    // ---- DISCONNECT ----
    // Clean up when a user leaves (closes tab, loses connection).
    socket.on("disconnect", () => {
      const roomId = (socket as Socket & { roomId?: string }).roomId;
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const user = room.users.get(socket.id);
          room.users.delete(socket.id);

          // Notify others
          socket.to(roomId).emit("user:left", {
            socketId: socket.id,
            userName: user?.userName || "Unknown",
          });

          console.log(
            `${user?.userName || socket.id} left room ${roomId} (${room.users.size} users)`
          );

          // Clean up empty rooms to free memory
          if (room.users.size === 0) {
            // Keep room data for 5 minutes in case someone rejoins
            setTimeout(() => {
              const currentRoom = rooms.get(roomId);
              if (currentRoom && currentRoom.users.size === 0) {
                rooms.delete(roomId);
                console.log(`Room ${roomId} cleaned up (empty)`);
              }
            }, 5 * 60 * 1000);
          }
        }
      }

      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
