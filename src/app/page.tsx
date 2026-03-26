"use client";

// =============================================================
// LOBBY PAGE — Dashboard showing user's boards + create/join
// =============================================================
//
// NOW WITH AUTH:
// - Shows the logged-in user's name
// - Lists their saved boards (from Supabase)
// - Create board saves to database
// - Join board by room code
// - Sign out button

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase-browser";
import { getUserBoards, createBoard, deleteBoard, ensureProfile } from "@/lib/database";

interface Board {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export default function LobbyPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Load user session and their boards
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
      const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
      setUserName(displayName);

      try {
        // Ensure profile exists before loading boards
        await ensureProfile(user.id, displayName);
        const userBoards = await getUserBoards(user.id);
        setBoards(userBoards);
      } catch (err) {
        console.error("Failed to load boards:", err);
      }
      setLoading(false);
    }
    loadUser();
  }, [router]);

  const handleCreateBoard = async () => {
    if (!userId) return;
    const boardId = uuidv4().slice(0, 8);
    const title = newBoardTitle.trim() || "Untitled Board";

    try {
      await createBoard(boardId, title, userId);
      // Store userName for socket connection
      sessionStorage.setItem("userName", userName);
      router.push(`/board/${boardId}`);
    } catch (err) {
      console.error("Failed to create board:", err);
    }
  };

  const handleJoinBoard = () => {
    if (!roomCode.trim()) return;
    sessionStorage.setItem("userName", userName);
    router.push(`/board/${roomCode.trim()}`);
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await deleteBoard(boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
    } catch (err) {
      console.error("Failed to delete board:", err);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pt-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Whiteboard</h1>
            <p className="text-gray-500 mt-1">Welcome, {userName}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Create Board */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Create New Board
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              placeholder="Board title (optional)"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBoard();
              }}
            />
            <button
              onClick={handleCreateBoard}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create
            </button>
          </div>
        </div>

        {/* Join Board */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Join Existing Board
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter room code"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoinBoard();
              }}
            />
            <button
              onClick={handleJoinBoard}
              disabled={!roomCode.trim()}
              className="px-6 py-2.5 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Join
            </button>
          </div>
        </div>

        {/* My Boards */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            My Boards
          </h2>
          {boards.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No boards yet. Create one above!
            </p>
          ) : (
            <div className="space-y-2">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <button
                    onClick={() => {
                      sessionStorage.setItem("userName", userName);
                      router.push(`/board/${board.id}`);
                    }}
                    className="flex-1 text-left"
                  >
                    <p className="font-medium text-gray-800">{board.title}</p>
                    <p className="text-xs text-gray-400">
                      Code: {board.id} · Updated{" "}
                      {new Date(board.updated_at).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    onClick={() => handleDeleteBoard(board.id)}
                    className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
