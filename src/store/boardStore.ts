import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { BoardElement, HistoryEntry, Tool } from "@/types";

const MAX_HISTORY = 50;
const GRID_SIZE = 20;

interface BoardState {
  // ---- Core State ----
  elements: BoardElement[];
  selectedElementIds: string[]; // Multi-select support
  tool: Tool;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  isDrawing: boolean;

  // Viewport
  stageScale: number;
  stageX: number;
  stageY: number;

  // Settings
  gridSnap: boolean;
  darkMode: boolean;

  // Clipboard for copy/paste
  clipboard: BoardElement[];

  // ---- Actions ----
  setTool: (tool: Tool) => void;
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setIsDrawing: (drawing: boolean) => void;
  setStageScale: (scale: number) => void;
  setStagePosition: (x: number, y: number) => void;
  zoomTo: (scale: number, pointerX: number, pointerY: number) => void;
  resetView: () => void;
  toggleGridSnap: () => void;
  toggleDarkMode: () => void;

  // Selection (multi-select)
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;

  // Element CRUD
  addElement: (element: BoardElement) => void;
  updateElement: (id: string, updates: Partial<BoardElement>) => void;
  deleteElement: (id: string) => void;
  deleteSelectedElements: () => void;

  // Layer ordering
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // Copy/Paste
  copySelected: () => void;
  paste: (offsetX?: number, offsetY?: number) => void;
  duplicateSelected: () => void;

  // Grid snap helper
  snapToGrid: (value: number) => number;

  // History
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Backward compat
  selectedElementId: string | null;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  elements: [],
  selectedElementIds: [],
  tool: "select",
  fillColor: "#4A90D9",
  strokeColor: "#000000",
  strokeWidth: 2,
  undoStack: [],
  redoStack: [],
  isDrawing: false,
  stageScale: 1,
  stageX: 0,
  stageY: 0,
  gridSnap: false,
  darkMode: false,
  clipboard: [],

  // Backward compat — returns first selected ID or null
  get selectedElementId() {
    const state = get();
    return state.selectedElementIds.length > 0 ? state.selectedElementIds[0] : null;
  },

  // ---- Setters ----
  setTool: (tool) => set({ tool, selectedElementIds: [] }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),
  setStageScale: (stageScale) => set({ stageScale }),
  setStagePosition: (stageX, stageY) => set({ stageX, stageY }),
  toggleGridSnap: () => set((s) => ({ gridSnap: !s.gridSnap })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  zoomTo: (newScale, pointerX, pointerY) =>
    set((state) => {
      const clampedScale = Math.min(Math.max(newScale, 0.1), 5);
      const mousePointTo = {
        x: (pointerX - state.stageX) / state.stageScale,
        y: (pointerY - state.stageY) / state.stageScale,
      };
      return {
        stageScale: clampedScale,
        stageX: pointerX - mousePointTo.x * clampedScale,
        stageY: pointerY - mousePointTo.y * clampedScale,
      };
    }),

  resetView: () => set({ stageScale: 1, stageX: 0, stageY: 0 }),

  // ---- Selection ----
  setSelectedElementId: (id) => set({ selectedElementIds: id ? [id] : [] }),
  setSelectedElementIds: (selectedElementIds) => set({ selectedElementIds }),
  addToSelection: (id) =>
    set((s) =>
      s.selectedElementIds.includes(id)
        ? s
        : { selectedElementIds: [...s.selectedElementIds, id] }
    ),
  removeFromSelection: (id) =>
    set((s) => ({
      selectedElementIds: s.selectedElementIds.filter((i) => i !== id),
    })),

  // ---- Element CRUD ----
  addElement: (element) =>
    set((state) => ({ elements: [...state.elements, element], redoStack: [] })),

  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? ({ ...el, ...updates } as BoardElement) : el
      ),
    })),

  deleteElement: (id) =>
    set((state) => {
      get().saveToHistory();
      return {
        elements: state.elements.filter((el) => el.id !== id),
        selectedElementIds: state.selectedElementIds.filter((i) => i !== id),
        redoStack: [],
      };
    }),

  deleteSelectedElements: () =>
    set((state) => {
      if (state.selectedElementIds.length === 0) return state;
      get().saveToHistory();
      const ids = new Set(state.selectedElementIds);
      return {
        elements: state.elements.filter((el) => !ids.has(el.id)),
        selectedElementIds: [],
        redoStack: [],
      };
    }),

  // ---- Layer Ordering ----
  // Elements render in array order: index 0 = bottom, last = top
  bringToFront: (id) =>
    set((state) => {
      const el = state.elements.find((e) => e.id === id);
      if (!el) return state;
      return { elements: [...state.elements.filter((e) => e.id !== id), el] };
    }),

  sendToBack: (id) =>
    set((state) => {
      const el = state.elements.find((e) => e.id === id);
      if (!el) return state;
      return { elements: [el, ...state.elements.filter((e) => e.id !== id)] };
    }),

  bringForward: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx === -1 || idx === state.elements.length - 1) return state;
      const next = [...state.elements];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return { elements: next };
    }),

  sendBackward: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx <= 0) return state;
      const next = [...state.elements];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return { elements: next };
    }),

  // ---- Copy / Paste / Duplicate ----
  copySelected: () =>
    set((state) => ({
      clipboard: structuredClone(
        state.elements.filter((el) => state.selectedElementIds.includes(el.id))
      ),
    })),

  paste: (offsetX = 20, offsetY = 20) =>
    set((state) => {
      if (state.clipboard.length === 0) return state;
      get().saveToHistory();
      const newElements = state.clipboard.map((el) => ({
        ...el,
        id: uuidv4(),
        x: el.x + offsetX,
        y: el.y + offsetY,
      })) as BoardElement[];
      return {
        elements: [...state.elements, ...newElements],
        selectedElementIds: newElements.map((e) => e.id),
        redoStack: [],
      };
    }),

  duplicateSelected: () => {
    get().copySelected();
    get().paste(30, 30);
  },

  // ---- Grid Snap ----
  snapToGrid: (value) => {
    if (!get().gridSnap) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  },

  // ---- History ----
  saveToHistory: () =>
    set((state) => ({
      undoStack: [
        ...state.undoStack.slice(-MAX_HISTORY),
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
        selectedElementIds: [],
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
        selectedElementIds: [],
      };
    }),
}));
