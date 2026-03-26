"use client";

// =============================================================
// BOARD PAGE — Collaborative whiteboard with persistence
// =============================================================
//
// NOW WITH DATABASE PERSISTENCE:
// 1. On load: fetch elements from Supabase → populate canvas
// 2. While drawing: real-time sync via Socket.io (fast, in-memory)
// 3. Auto-save: every 5 seconds, persist to Supabase (durable)
// 4. On reload: data is loaded from Supabase → nothing lost
//
// WHY TWO SYSTEMS (Socket.io + Supabase)?
// - Socket.io: instant real-time sync (milliseconds), but in-memory (lost on server restart)
// - Supabase: durable storage (survives restarts), but slower (network round-trip)
// - Combined: best of both — instant collaboration + persistent storage
//
// This is called "WRITE-THROUGH CACHING":
// Socket.io acts as a fast cache, Supabase is the source of truth.
// Similar to how Redis + PostgreSQL work together in production systems.

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Konva from "konva";
import Toolbar from "@/components/Toolbar";
import UserList from "@/components/UserList";
import { useSocket } from "@/hooks/useSocket";
import { useBoardStore } from "@/store/boardStore";
import { createClient } from "@/lib/supabase-browser";
import { exportToPNG, exportToPDF } from "@/utils/export";
import {
  getBoardElements,
  saveBoardElements,
  getBoard,
  createBoard,
  ensureProfile,
} from "@/lib/database";

const Canvas = dynamic(() => import("@/components/Canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100">
      <p className="text-gray-400">Loading canvas...</p>
    </div>
  ),
});

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [boardTitle, setBoardTitle] = useState("Untitled Board");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const stageInstanceRef = useRef<Konva.Stage | null>(null);

  // Load user session
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      setUserId(user.id);
      const name =
        sessionStorage.getItem("userName") ||
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        "User";
      setUserName(name);
      sessionStorage.setItem("userName", name);
    }
    loadUser();
  }, [router]);

  // Load board data from Supabase on mount
  useEffect(() => {
    if (!userId || !userName) return;

    async function loadBoard() {
      try {
        // Ensure profile exists (needed for users who signed up before DB tables)
        await ensureProfile(userId!, userName!);

        // Check if board exists
        let board = await getBoard(roomId);

        if (!board) {
          // Board doesn't exist — create it (for join-by-code flow)
          await createBoard(roomId, "Untitled Board", userId!);
          board = await getBoard(roomId);
        }

        if (board) {
          setBoardTitle(board.title);
        }

        // Load saved elements
        const elements = await getBoardElements(roomId);
        if (elements.length > 0) {
          useBoardStore.setState({ elements });
          lastSavedRef.current = JSON.stringify(elements);
        }
      } catch (err) {
        console.error("Failed to load board:", err);
      }
    }

    loadBoard();
  }, [roomId, userId, userName]);

  // Connect to Socket.io room
  const {
    isConnected,
    cursors,
    users,
    myColor,
    emitAddElement,
    emitUpdateElement,
    emitDeleteElement,
    emitSyncElements,
    emitCursorMove,
  } = useSocket(userName ? roomId : null, userName || "");

  // ---- AUTO-SAVE TO SUPABASE ----
  // Saves every 5 seconds if there are unsaved changes.
  //
  // WHY DEBOUNCED AUTO-SAVE?
  // - Saving on every single mouse move would be 60+ DB writes/sec (terrible)
  // - Saving only on "done drawing" misses intermediate states
  // - Auto-save every 5s is the sweet spot: durable but not excessive
  // - This is what Google Docs and Figma do
  //
  // HOW WE DETECT CHANGES:
  // Compare JSON.stringify of current elements to last saved version.
  // If different → save. If same → skip (no unnecessary DB writes).

  const saveToDatabase = useCallback(async () => {
    const elements = useBoardStore.getState().elements;
    const currentState = JSON.stringify(elements);

    if (currentState === lastSavedRef.current) return; // No changes

    setSaveStatus("saving");
    try {
      await saveBoardElements(roomId, elements);
      lastSavedRef.current = currentState;
      setSaveStatus("saved");
    } catch (err) {
      console.error("Auto-save failed:", err);
      setSaveStatus("unsaved");
    }
  }, [roomId]);

  // Set up auto-save interval
  useEffect(() => {
    const interval = setInterval(() => {
      saveToDatabase();
    }, 5000);

    // Also save when the user leaves the page
    const handleBeforeUnload = () => {
      saveToDatabase();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Final save on unmount
      saveToDatabase();
    };
  }, [saveToDatabase]);

  // Track unsaved changes
  useEffect(() => {
    const unsubscribe = useBoardStore.subscribe(() => {
      setSaveStatus("unsaved");
      // Debounce: reset the save timer on each change
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveToDatabase();
      }, 3000);
    });

    return () => unsubscribe();
  }, [saveToDatabase]);

  const darkMode = useBoardStore((s) => s.darkMode);

  if (!userName) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${darkMode ? "dark" : ""}`}>
      {/* Left sidebar */}
      <div className="w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
        {/* Board info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">
            {boardTitle}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-400 font-mono">Room: {roomId}</p>
            <button
              onClick={() => navigator.clipboard.writeText(roomId)}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Copy
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                saveStatus === "saved"
                  ? "bg-green-500"
                  : saveStatus === "saving"
                  ? "bg-yellow-500"
                  : "bg-orange-500"
              }`}
            />
            <span className="text-[10px] text-gray-400">
              {saveStatus === "saved"
                ? "All changes saved"
                : saveStatus === "saving"
                ? "Saving..."
                : "Unsaved changes"}
            </span>
          </div>
        </div>

        {/* Users in room */}
        <UserList
          users={users}
          isConnected={isConnected}
          myColor={myColor}
          userName={userName}
        />

        {/* Tools */}
        <Toolbar />

        {/* Export */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Export</p>
          <div className="flex gap-2">
            <button onClick={() => stageInstanceRef.current && exportToPNG(stageInstanceRef.current)} className="flex-1 px-3 py-2 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400">PNG</button>
            <button onClick={() => stageInstanceRef.current && exportToPDF(stageInstanceRef.current)} className="flex-1 px-3 py-2 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400">PDF</button>
          </div>
        </div>

        {/* Back to lobby */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => { saveToDatabase(); router.push("/"); }} className="w-full px-3 py-2 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400">Back to Lobby</button>
        </div>
      </div>

      {/* Canvas */}
      <Canvas
        onElementAdd={emitAddElement}
        onElementUpdate={emitUpdateElement}
        onElementDelete={emitDeleteElement}
        onElementsSync={emitSyncElements}
        onCursorMove={emitCursorMove}
        cursors={cursors}
        onStageReady={(stage) => { stageInstanceRef.current = stage; }}
      />
    </div>
  );
}
