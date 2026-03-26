import { create } from "zustand";
import { BoardElement, HistoryEntry, Tool } from "@/types";

// =============================================================
// ZUSTAND STORE — The "brain" of the whiteboard
// =============================================================
//
// HOW IT WORKS:
// 1. `create()` defines state + actions in one place
// 2. `set()` updates state immutably (creates new objects, never mutates)
// 3. Components subscribe to slices: useBoardStore(s => s.elements)
// 4. Only components using changed data re-render
//
// WHY ZUSTAND OVER REDUX?
// - Redux: create action types, action creators, reducers, middleware,
//   wrap app in Provider, connect components... lots of boilerplate
// - Zustand: one file, one `create()` call, done
// - Performance is equal or better (Zustand uses subscriptions)
//
// WHY ZUSTAND OVER REACT CONTEXT?
// - Context re-renders ALL consumers when ANY value changes
// - In a whiteboard, cursor moves 60x/sec — Context would re-render
//   the entire app 60 times per second. Zustand only re-renders
//   the cursor component.

const MAX_HISTORY = 50; // Limit memory usage

interface BoardState {
  // ---- State ----
  elements: BoardElement[];
  selectedElementId: string | null;
  tool: Tool;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;

  // Undo/Redo history
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // Drawing state (for shapes being drawn right now)
  isDrawing: boolean;

  // ---- Actions ----
  setTool: (tool: Tool) => void;
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setSelectedElementId: (id: string | null) => void;
  setIsDrawing: (drawing: boolean) => void;

  // Element CRUD
  addElement: (element: BoardElement) => void;
  updateElement: (id: string, updates: Partial<BoardElement>) => void;
  deleteElement: (id: string) => void;

  // History
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  // ---- Initial State ----
  elements: [],
  selectedElementId: null,
  tool: "select",
  fillColor: "#4A90D9",
  strokeColor: "#000000",
  strokeWidth: 2,
  undoStack: [],
  redoStack: [],
  isDrawing: false,

  // ---- Simple Setters ----
  setTool: (tool) => set({ tool, selectedElementId: null }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setSelectedElementId: (selectedElementId) => set({ selectedElementId }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),

  // ---- Element Operations ----

  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
      // Clear redo when new action happens (standard behavior)
      redoStack: [],
    })),

  // WHY Partial<BoardElement>?
  // When dragging a shape, we only want to update x and y,
  // not pass the entire object. Partial<T> makes all fields optional.
  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? ({ ...el, ...updates } as BoardElement) : el
      ),
    })),

  deleteElement: (id) =>
    set((state) => {
      // Save current state before deleting
      get().saveToHistory();
      return {
        elements: state.elements.filter((el) => el.id !== id),
        selectedElementId:
          state.selectedElementId === id ? null : state.selectedElementId,
        redoStack: [],
      };
    }),

  // ---- History (Undo/Redo) ----
  //
  // HOW THIS WORKS:
  //   Action flow:  saveToHistory() → make change → (user can undo later)
  //
  //   undoStack: [ [state1], [state2], [state3] ]  ← push before each change
  //   current:   [state4]
  //   redoStack: []
  //
  //   User presses Ctrl+Z:
  //   undoStack: [ [state1], [state2] ]
  //   current:   [state3]  ← restored from undoStack
  //   redoStack: [ [state4] ]  ← moved current here
  //
  // WHY SNAPSHOT APPROACH?
  // - Simple: just copy the array
  // - Works for all operations (add, move, delete, edit)
  // - Downside: memory usage grows with history size (hence MAX_HISTORY cap)
  //
  // ALTERNATIVE — Command Pattern:
  // - Store {execute(), undo()} objects instead of full state copies
  // - Pro: uses less memory
  // - Con: every operation needs custom undo logic (error-prone)
  // - Best when: you have collaborative editing and need to replay operations

  saveToHistory: () =>
    set((state) => ({
      undoStack: [
        ...state.undoStack.slice(-MAX_HISTORY),
        // structuredClone creates a deep copy — prevents reference issues
        structuredClone(state.elements),
      ],
      redoStack: [],
    })),

  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state;

      const previousState = state.undoStack[state.undoStack.length - 1];
      return {
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, structuredClone(state.elements)],
        elements: previousState,
        selectedElementId: null,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;

      const nextState = state.redoStack[state.redoStack.length - 1];
      return {
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, structuredClone(state.elements)],
        elements: nextState,
        selectedElementId: null,
      };
    }),
}));
