import { createClient } from "@/lib/supabase-browser";
import { BoardElement } from "@/types";

// =============================================================
// DATABASE HELPERS — CRUD operations for boards and elements
// =============================================================
//
// WHY A SEPARATE FILE?
// Keeps database logic out of components. Components call these
// functions — they don't need to know about Supabase tables or SQL.
//
// PATTERN: Each function creates a fresh Supabase client.
// WHY? The client reads the current auth cookie on creation.
// If we reused a stale client, it might have an expired token.

// ---- BOARDS ----

export async function createBoard(boardId: string, title: string, ownerId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .insert({ id: boardId, title, owner_id: ownerId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBoard(boardId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
  return data;
}

export async function getUserBoards(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateBoardTimestamp(boardId: string) {
  const supabase = createClient();
  await supabase
    .from("boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", boardId);
}

export async function deleteBoard(boardId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("boards").delete().eq("id", boardId);
  if (error) throw error;
}

// ---- BOARD ELEMENTS ----

export async function getBoardElements(boardId: string): Promise<BoardElement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("board_elements")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Convert from DB format to our BoardElement type
  return (data || []).map((row) => ({
    ...row.element_data,
    id: row.id,
  })) as BoardElement[];
}

// Track in-flight saves to prevent overlapping calls
let saveInProgress = false;

export async function saveBoardElements(
  boardId: string,
  elements: BoardElement[]
) {
  // Skip if another save is already running (prevents race conditions)
  if (saveInProgress) return;
  saveInProgress = true;

  try {
    const supabase = createClient();

    // Check if board exists in DB first
    const { data: board } = await supabase
      .from("boards")
      .select("id")
      .eq("id", boardId)
      .single();

    if (!board) return;

    // Get current element IDs in DB
    const { data: existing } = await supabase
      .from("board_elements")
      .select("id")
      .eq("board_id", boardId);

    const existingIds = new Set((existing || []).map((e) => e.id));
    const currentIds = new Set(elements.map((e) => e.id));

    // Delete elements that no longer exist
    const toDelete = [...existingIds].filter((id) => !currentIds.has(id));
    if (toDelete.length > 0) {
      await supabase
        .from("board_elements")
        .delete()
        .in("id", toDelete);
    }

    // Upsert all current elements (insert or update)
    if (elements.length > 0) {
      const rows = elements.map((el) => ({
        id: el.id,
        board_id: boardId,
        element_type: el.type,
        element_data: el,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("board_elements")
        .upsert(rows, { onConflict: "id" });

      if (error) throw error;
    }

    await updateBoardTimestamp(boardId);
  } finally {
    saveInProgress = false;
  }
}

// ---- PROFILE ----

// Ensures a profile row exists for the user.
// Needed because users who signed up BEFORE tables were created
// won't have a profile (the trigger only fires on new signups).
export async function ensureProfile(userId: string, displayName: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!data) {
    const { error } = await supabase
      .from("profiles")
      .insert({ id: userId, display_name: displayName });
    if (error && error.code !== "23505") throw error; // 23505 = already exists (race condition)
  }
}

export async function getProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  updates: { display_name?: string; avatar_url?: string }
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) throw error;
}
