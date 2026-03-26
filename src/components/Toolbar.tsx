"use client";

import { useBoardStore } from "@/store/boardStore";
import { Tool } from "@/types";

// =============================================================
// TOOLBAR — Tool selection, colors, actions
// =============================================================
//
// HOW TOOLBAR CONNECTS TO CANVAS:
// Both read from the same Zustand store.
//
//   Toolbar → useBoardStore → setTool("rectangle")
//                                      ↓
//   Canvas  → useBoardStore → tool === "rectangle"
//                                      ↓
//                              mouseDown creates rectangle
//
// No prop drilling, no context providers, no Redux boilerplate.
// Zustand makes this trivially simple.

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "rectangle", label: "Rectangle", icon: "□" },
  { id: "circle", label: "Circle", icon: "○" },
  { id: "freehand", label: "Draw", icon: "✎" },
  { id: "text", label: "Text", icon: "T" },
  { id: "sticky-note", label: "Note", icon: "📋" },
];

export default function Toolbar() {
  const tool = useBoardStore((s) => s.tool);
  const setTool = useBoardStore((s) => s.setTool);
  const fillColor = useBoardStore((s) => s.fillColor);
  const setFillColor = useBoardStore((s) => s.setFillColor);
  const strokeColor = useBoardStore((s) => s.strokeColor);
  const setStrokeColor = useBoardStore((s) => s.setStrokeColor);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const setStrokeWidth = useBoardStore((s) => s.setStrokeWidth);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const undoStack = useBoardStore((s) => s.undoStack);
  const redoStack = useBoardStore((s) => s.redoStack);
  const selectedElementId = useBoardStore((s) => s.selectedElementId);
  const deleteElement = useBoardStore((s) => s.deleteElement);

  return (
    <div className="w-60 bg-white border-r border-gray-200 flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">Whiteboard</h1>
        <p className="text-xs text-gray-400 mt-1">Collaborative Canvas</p>
      </div>

      {/* Tools */}
      <div className="p-4 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Tools
        </p>
        <div className="grid grid-cols-3 gap-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all text-sm
                ${
                  tool === t.id
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100"
                }`}
              title={t.label}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span className="text-[10px] mt-1">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="p-4 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Colors
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600 w-12">Fill</label>
            <input
              type="color"
              value={fillColor}
              onChange={(e) => setFillColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300"
            />
            <span className="text-xs text-gray-400 font-mono">{fillColor}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600 w-12">Stroke</label>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300"
            />
            <span className="text-xs text-gray-400 font-mono">
              {strokeColor}
            </span>
          </div>
        </div>

        {/* Quick color palette */}
        <div className="flex gap-1.5 mt-3">
          {[
            "#000000",
            "#FF3B30",
            "#FF9500",
            "#FFCC00",
            "#34C759",
            "#007AFF",
            "#AF52DE",
            "#FFFFFF",
          ].map((color) => (
            <button
              key={color}
              onClick={() => setFillColor(color)}
              className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div className="p-4 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Stroke Width
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={20}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs text-gray-600 w-6 text-center">
            {strokeWidth}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Actions
        </p>
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Ctrl+Z"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Ctrl+Shift+Z"
          >
            Redo
          </button>
        </div>
        {selectedElementId && (
          <button
            onClick={() => deleteElement(selectedElementId)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            Delete Selected
          </button>
        )}
      </div>

      {/* Keyboard shortcuts reference */}
      <div className="mt-auto p-4 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
          Shortcuts
        </p>
        <div className="text-[10px] text-gray-400 space-y-0.5">
          <p>Ctrl+Z — Undo</p>
          <p>Ctrl+Shift+Z — Redo</p>
          <p>Delete — Remove selected</p>
          <p>Double-click — Edit text</p>
        </div>
      </div>
    </div>
  );
}
