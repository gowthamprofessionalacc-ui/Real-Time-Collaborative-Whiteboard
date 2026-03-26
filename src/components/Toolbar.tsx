"use client";

import { useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useBoardStore } from "@/store/boardStore";
import { Tool } from "@/types";

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "rectangle", label: "Rect", icon: "□" },
  { id: "circle", label: "Circle", icon: "○" },
  { id: "freehand", label: "Draw", icon: "✎" },
  { id: "text", label: "Text", icon: "T" },
  { id: "sticky-note", label: "Note", icon: "▥" },
  { id: "connector", label: "Arrow", icon: "→" },
  { id: "eraser", label: "Eraser", icon: "⌫" },
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
  const selectedIds = useBoardStore((s) => s.selectedElementIds);
  const deleteSelectedElements = useBoardStore((s) => s.deleteSelectedElements);
  const gridSnap = useBoardStore((s) => s.gridSnap);
  const toggleGridSnap = useBoardStore((s) => s.toggleGridSnap);
  const darkMode = useBoardStore((s) => s.darkMode);
  const toggleDarkMode = useBoardStore((s) => s.toggleDarkMode);
  const copySelected = useBoardStore((s) => s.copySelected);
  const paste = useBoardStore((s) => s.paste);
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected);
  const bringToFront = useBoardStore((s) => s.bringToFront);
  const sendToBack = useBoardStore((s) => s.sendToBack);
  const addElement = useBoardStore((s) => s.addElement);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxSize = 400;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        addElement({
          id: uuidv4(),
          type: "image",
          x: 100,
          y: 100,
          width: img.width * ratio,
          height: img.height * ratio,
          src: reader.result as string,
          fill: "transparent",
          stroke: "transparent",
          strokeWidth: 0,
          rotation: 0,
          opacity: 1,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const hasSelection = selectedIds.length > 0;
  const singleSelected = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <div className="flex-1 flex flex-col select-none overflow-y-auto">
      {/* Tools */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Tools</p>
        <div className="grid grid-cols-4 gap-1.5">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition-all text-xs
                ${tool === t.id
                  ? "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700"
                  : "bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              title={t.label}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className="text-[9px] mt-0.5">{t.label}</span>
            </button>
          ))}
        </div>
        {/* Image upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 border border-transparent transition-colors"
        >
          Upload Image
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </div>

      {/* Colors */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Colors</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600 dark:text-gray-400 w-10">Fill</label>
            <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-300" />
            <span className="text-[10px] text-gray-400 font-mono">{fillColor}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600 dark:text-gray-400 w-10">Stroke</label>
            <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-300" />
            <span className="text-[10px] text-gray-400 font-mono">{strokeColor}</span>
          </div>
        </div>
        <div className="flex gap-1 mt-2">
          {["#000000", "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE", "#FFFFFF"].map((c) => (
            <button key={c} onClick={() => setFillColor(c)} className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">Width</label>
          <input type="range" min={1} max={20} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="flex-1" />
          <span className="text-xs text-gray-600 dark:text-gray-400 w-5 text-center">{strokeWidth}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Actions</p>
        <div className="flex gap-1.5">
          <button onClick={undo} disabled={undoStack.length === 0} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors" title="Ctrl+Z">Undo</button>
          <button onClick={redo} disabled={redoStack.length === 0} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors" title="Ctrl+Y">Redo</button>
        </div>
        {hasSelection && (
          <>
            <div className="flex gap-1.5">
              <button onClick={copySelected} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors">Copy</button>
              <button onClick={() => paste()} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors">Paste</button>
              <button onClick={duplicateSelected} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors">Dup</button>
            </div>
            <button onClick={deleteSelectedElements} className="w-full px-2 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 transition-colors">Delete ({selectedIds.length})</button>
          </>
        )}
        {singleSelected && (
          <div className="flex gap-1.5">
            <button onClick={() => bringToFront(singleSelected)} className="flex-1 px-1 py-1 text-[10px] rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">Front</button>
            <button onClick={() => sendToBack(singleSelected)} className="flex-1 px-1 py-1 text-[10px] rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">Back</button>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Settings</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={gridSnap} onChange={toggleGridSnap} className="rounded" />
          <span className="text-xs text-gray-600 dark:text-gray-400">Snap to grid</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} className="rounded" />
          <span className="text-xs text-gray-600 dark:text-gray-400">Dark mode</span>
        </label>
      </div>

      {/* Shortcuts */}
      <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Shortcuts</p>
        <div className="text-[9px] text-gray-400 space-y-0.5 columns-2">
          <p>Ctrl+Z Undo</p>
          <p>Ctrl+Y Redo</p>
          <p>Ctrl+C Copy</p>
          <p>Ctrl+V Paste</p>
          <p>Ctrl+D Duplicate</p>
          <p>Del Delete</p>
          <p>Scroll Zoom</p>
          <p>Space Pan</p>
          <p>Ctrl+0 Reset</p>
          <p>Shift+Click Multi</p>
        </div>
      </div>
    </div>
  );
}
