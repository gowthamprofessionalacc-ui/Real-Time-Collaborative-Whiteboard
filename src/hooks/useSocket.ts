"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useBoardStore } from "@/store/boardStore";
import { BoardElement } from "@/types";

// =============================================================
// useSocket HOOK — Manages the WebSocket connection
// =============================================================
//
// HOW THIS HOOK CONNECTS EVERYTHING:
//
//   Component mounts
//   → useSocket(roomId, userName) called
//   → Creates Socket.io connection to server
//   → Joins the room → receives current board state
//   → Listens for events from other users
//   → Returns { emit, cursors, users, isConnected }
//   → Component unmounts → socket disconnects automatically
//
// WHY A SINGLETON SOCKET?
// We use useRef to keep ONE socket connection per component lifecycle.
// Without this, React's StrictMode (dev only) would create TWO connections
// because it mounts components twice.
//
// WHY useRef INSTEAD OF useState FOR SOCKET?
// useState triggers re-renders when set. We don't want the entire
// component tree to re-render just because the socket object changed.
// useRef holds a value without triggering re-renders.

interface CursorData {
  socketId: string;
  cursor: {
    x: number;
    y: number;
    userName: string;
    color: string;
  };
}

interface UserInfo {
  socketId: string;
  userName: string;
  color: string;
}

export function useSocket(roomId: string | null, userName: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cursors, setCursors] = useState<Map<string, CursorData["cursor"]>>(
    new Map()
  );
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [myColor, setMyColor] = useState("#FF6B6B");

  // Get store actions — we'll call these when receiving events
  const addElement = useBoardStore((s) => s.addElement);
  const updateElement = useBoardStore((s) => s.updateElement);
  const deleteElement = useBoardStore((s) => s.deleteElement);

  useEffect(() => {
    if (!roomId) return;

    // ---- CONNECT ----
    // io() creates a Socket.io client that connects to the server.
    // By default, it connects to the same host the page was loaded from.
    // In production, you might point this to a different server.
    const socket = io({
      // Transports: try WebSocket first, fall back to HTTP polling
      // WHY? Some corporate firewalls block WebSockets.
      // Polling works everywhere but is slower.
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to server:", socket.id);

      // ---- JOIN ROOM ----
      // Send a join request with a callback to receive initial state.
      // This is like calling an API endpoint but over WebSocket.
      socket.emit(
        "room:join",
        { roomId, userName },
        (response: {
          elements: BoardElement[];
          users: UserInfo[];
          yourColor: string;
        }) => {
          // Load the board's current state
          // WHY set elements directly?
          // When joining, we want to replace whatever's in the store
          // with the server's truth. Other users may have been drawing
          // before we connected.
          useBoardStore.setState({ elements: response.elements });
          setUsers(response.users);
          setMyColor(response.yourColor);
        }
      );
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from server");
    });

    // ---- LISTEN FOR EVENTS FROM OTHER USERS ----

    socket.on("element:add", (element: BoardElement) => {
      // Another user added an element — add it to our canvas
      addElement(element);
    });

    socket.on(
      "element:update",
      (data: { elementId: string; updates: Partial<BoardElement> }) => {
        updateElement(data.elementId, data.updates);
      }
    );

    socket.on("element:delete", (data: { elementId: string }) => {
      // Use setState directly to avoid triggering our own saveToHistory
      useBoardStore.setState((state) => ({
        elements: state.elements.filter((el) => el.id !== data.elementId),
      }));
    });

    socket.on("elements:sync", (elements: BoardElement[]) => {
      // Full state replacement (from another user's undo/redo)
      useBoardStore.setState({ elements });
    });

    // ---- CURSOR EVENTS ----
    socket.on("cursor:move", (data: CursorData) => {
      setCursors((prev) => {
        const next = new Map(prev);
        next.set(data.socketId, data.cursor);
        return next;
      });
    });

    // ---- USER EVENTS ----
    socket.on("user:joined", (user: UserInfo) => {
      setUsers((prev) => [...prev, user]);
    });

    socket.on(
      "user:left",
      (data: { socketId: string; userName: string }) => {
        setUsers((prev) => prev.filter((u) => u.socketId !== data.socketId));
        // Remove their cursor
        setCursors((prev) => {
          const next = new Map(prev);
          next.delete(data.socketId);
          return next;
        });
      }
    );

    // ---- CLEANUP ON UNMOUNT ----
    // When the component unmounts (user navigates away), disconnect.
    // This triggers the server's "disconnect" handler which cleans up rooms.
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, userName, addElement, updateElement, deleteElement]);

  // ---- EMIT FUNCTIONS ----
  // These are the functions components call to send events to the server.
  // useCallback ensures stable references (won't cause re-renders).

  const emitAddElement = useCallback(
    (element: BoardElement) => {
      socketRef.current?.emit("element:add", { roomId, element });
    },
    [roomId]
  );

  const emitUpdateElement = useCallback(
    (elementId: string, updates: Partial<BoardElement>) => {
      socketRef.current?.emit("element:update", { roomId, elementId, updates });
    },
    [roomId]
  );

  const emitDeleteElement = useCallback(
    (elementId: string) => {
      socketRef.current?.emit("element:delete", { roomId, elementId });
    },
    [roomId]
  );

  const emitSyncElements = useCallback(
    (elements: BoardElement[]) => {
      socketRef.current?.emit("elements:sync", { roomId, elements });
    },
    [roomId]
  );

  // Cursor movement — throttled in the Canvas component, not here
  const emitCursorMove = useCallback(
    (x: number, y: number) => {
      socketRef.current?.emit("cursor:move", {
        roomId,
        cursor: { x, y, userName, color: myColor },
      });
    },
    [roomId, userName, myColor]
  );

  return {
    isConnected,
    cursors,
    users,
    myColor,
    emitAddElement,
    emitUpdateElement,
    emitDeleteElement,
    emitSyncElements,
    emitCursorMove,
  };
}
