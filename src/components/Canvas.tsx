"use client";

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { Stage, Layer, Rect as SelectionRect } from "react-konva";
import Konva from "konva";
import { v4 as uuidv4 } from "uuid";
import { useBoardStore } from "@/store/boardStore";
import { BoardElement } from "@/types";
import RectangleShape from "./shapes/RectangleShape";
import CircleShape from "./shapes/CircleShape";
import FreeDrawShape from "./shapes/FreeDrawShape";
import TextShape from "./shapes/TextShape";
import StickyNoteShape from "./shapes/StickyNoteShape";
import ConnectorShape from "./shapes/ConnectorShape";
import ImageShape from "./shapes/ImageShape";
import TransformerComponent from "./TransformerComponent";
import CursorPresence from "./CursorPresence";
import Minimap from "./Minimap";

interface CanvasProps {
  onElementAdd?: (element: BoardElement) => void;
  onElementUpdate?: (elementId: string, updates: Partial<BoardElement>) => void;
  onElementDelete?: (elementId: string) => void;
  onElementsSync?: (elements: BoardElement[]) => void;
  onCursorMove?: (x: number, y: number) => void;
  cursors?: Map<string, { x: number; y: number; userName: string; color: string }>;
  onStageReady?: (stage: Konva.Stage) => void;
}

function getElementBounds(el: BoardElement) {
  switch (el.type) {
    case "rectangle": case "sticky-note": case "image":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "circle":
      return { x: el.x - el.radius, y: el.y - el.radius, w: el.radius * 2, h: el.radius * 2 };
    case "text":
      return { x: el.x, y: el.y, w: el.width || 200, h: 30 };
    case "freehand": {
      if (el.points.length < 2) return { x: el.x, y: el.y, w: 1, h: 1 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < el.points.length; i += 2) {
        minX = Math.min(minX, el.points[i]); minY = Math.min(minY, el.points[i + 1]);
        maxX = Math.max(maxX, el.points[i]); maxY = Math.max(maxY, el.points[i + 1]);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case "connector":
      return { x: Math.min(el.fromX, el.toX) - 20, y: Math.min(el.fromY, el.toY) - 20, w: Math.abs(el.toX - el.fromX) + 40, h: Math.abs(el.toY - el.fromY) + 40 };
  }
}

export default function Canvas({ onElementAdd, onElementUpdate, onElementDelete, onElementsSync, onCursorMove, cursors, onStageReady }: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [drawingElementId, setDrawingElementId] = useState<string | null>(null);
  const [drawStartPos, setDrawStartPos] = useState<{ x: number; y: number } | null>(null);
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [connectorFromId, setConnectorFromId] = useState<string | null>(null);
  // Selection box state
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const lastCursorEmit = useRef(0);

  useEffect(() => { if (stageRef.current && onStageReady) onStageReady(stageRef.current); }, [onStageReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => setStageSize({ width: container.offsetWidth, height: container.offsetHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const elements = useBoardStore((s) => s.elements);
  const tool = useBoardStore((s) => s.tool);
  const fillColor = useBoardStore((s) => s.fillColor);
  const strokeColor = useBoardStore((s) => s.strokeColor);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const isDrawing = useBoardStore((s) => s.isDrawing);
  const setIsDrawing = useBoardStore((s) => s.setIsDrawing);
  const addElement = useBoardStore((s) => s.addElement);
  const updateElement = useBoardStore((s) => s.updateElement);
  const deleteElement = useBoardStore((s) => s.deleteElement);
  const setSelectedElementId = useBoardStore((s) => s.setSelectedElementId);
  const setSelectedElementIds = useBoardStore((s) => s.setSelectedElementIds);
  const addToSelection = useBoardStore((s) => s.addToSelection);
  const selectedIds = useBoardStore((s) => s.selectedElementIds);
  const saveToHistory = useBoardStore((s) => s.saveToHistory);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const deleteSelectedElements = useBoardStore((s) => s.deleteSelectedElements);
  const stageScale = useBoardStore((s) => s.stageScale);
  const stageX = useBoardStore((s) => s.stageX);
  const stageY = useBoardStore((s) => s.stageY);
  const zoomTo = useBoardStore((s) => s.zoomTo);
  const setStagePosition = useBoardStore((s) => s.setStagePosition);
  const resetView = useBoardStore((s) => s.resetView);
  const darkMode = useBoardStore((s) => s.darkMode);
  const gridSnap = useBoardStore((s) => s.gridSnap);
  const snapToGrid = useBoardStore((s) => s.snapToGrid);
  const copySelected = useBoardStore((s) => s.copySelected);
  const paste = useBoardStore((s) => s.paste);
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected);

  // Virtual rendering
  const visibleElements = useMemo(() => {
    const padding = 200;
    const viewLeft = -stageX / stageScale - padding;
    const viewTop = -stageY / stageScale - padding;
    const viewRight = (stageSize.width - stageX) / stageScale + padding;
    const viewBottom = (stageSize.height - stageY) / stageScale + padding;
    return elements.filter((el) => {
      if (el.type === "connector") return true;
      const b = getElementBounds(el);
      return b.x + b.w >= viewLeft && b.x <= viewRight && b.y + b.h >= viewTop && b.y <= viewBottom;
    });
  }, [elements, stageX, stageY, stageScale, stageSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingText) return;
      if (e.code === "Space" && !e.repeat) { e.preventDefault(); setSpaceHeld(true); }
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); onElementsSync?.(useBoardStore.getState().elements); }
      if (ctrl && ((e.key === "z" && e.shiftKey) || e.key === "y")) { e.preventDefault(); redo(); onElementsSync?.(useBoardStore.getState().elements); }
      if (ctrl && e.key === "c") { e.preventDefault(); copySelected(); }
      if (ctrl && e.key === "v") { e.preventDefault(); paste(); }
      if (ctrl && e.key === "d") { e.preventDefault(); duplicateSelected(); }
      if (ctrl && e.key === "0") { e.preventDefault(); resetView(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        e.preventDefault();
        selectedIds.forEach((id) => onElementDelete?.(id));
        deleteSelectedElements();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceHeld(false); };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, [undo, redo, selectedIds, editingText, onElementsSync, onElementDelete, resetView, copySelected, paste, duplicateSelected, deleteSelectedElements]);

  const getWorldPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return { x: (pointer.x - stageX) / stageScale, y: (pointer.y - stageY) / stageScale };
  }, [stageX, stageY, stageScale]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.08;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    zoomTo(direction > 0 ? stageScale * scaleBy : stageScale / scaleBy, pointer.x, pointer.y);
  }, [stageScale, zoomTo]);

  // ---- MOUSE DOWN ----
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (("button" in e.evt && e.evt.button === 1) || spaceHeld) { setIsPanning(true); return; }

    const pos = getWorldPos();
    if (!pos) return;
    const snappedPos = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };

    // ---- ERASER TOOL ----
    if (tool === "eraser") {
      const stage = stageRef.current;
      if (!stage) return;
      const screenPointer = stage.getPointerPosition();
      if (!screenPointer) return;
      const target = stage.getIntersection(screenPointer);
      if (!target) return;
      let node: Konva.Node | null = target;
      while (node) {
        const id = node.id();
        if (id && elements.find((el) => el.id === id)) {
          saveToHistory();
          deleteElement(id);
          onElementDelete?.(id);
          return;
        }
        node = node.parent;
      }
      return;
    }

    // ---- CONNECTOR TOOL ----
    if (tool === "connector") {
      const stage = stageRef.current;
      if (!stage) return;
      const screenPointer = stage.getPointerPosition();
      if (!screenPointer) return;
      const target = stage.getIntersection(screenPointer);
      if (!target) return;
      let node: Konva.Node | null = target;
      let clickedId: string | null = null;
      while (node) {
        const id = node.id();
        if (id && elements.find((el) => el.id === id && el.type !== "connector")) { clickedId = id; break; }
        node = node.parent;
      }
      if (!clickedId) return;
      if (!connectorFromId) { setConnectorFromId(clickedId); return; }
      if (clickedId !== connectorFromId) {
        saveToHistory();
        const fromEl = elements.find((el) => el.id === connectorFromId);
        const toEl = elements.find((el) => el.id === clickedId);
        const conn: BoardElement = {
          id: uuidv4(), type: "connector", x: 0, y: 0,
          fromId: connectorFromId, toId: clickedId,
          fromX: fromEl?.x ?? 0, fromY: fromEl?.y ?? 0, toX: toEl?.x ?? 0, toY: toEl?.y ?? 0,
          fill: "transparent", stroke: strokeColor, strokeWidth: 2, rotation: 0, opacity: 1,
        };
        addElement(conn);
        onElementAdd?.(conn);
      }
      setConnectorFromId(null);
      return;
    }

    // ---- SELECT TOOL ----
    if (tool === "select") {
      const stage = stageRef.current;
      if (!stage) return;
      const screenPointer = stage.getPointerPosition();
      if (!screenPointer) return;
      const clickedShape = stage.getIntersection(screenPointer);

      if (!clickedShape) {
        // Clicked on empty space — start selection box
        if (!("shiftKey" in e.evt && e.evt.shiftKey)) {
          setSelectedElementIds([]);
        }
        setSelectionStart(pos);
        setSelectionBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
        return;
      }

      // Clicked on a shape — handle shift+click for multi-select
      let node: Konva.Node | null = clickedShape;
      let clickedId: string | null = null;
      while (node) {
        const id = node.id();
        if (id && elements.find((el) => el.id === id)) { clickedId = id; break; }
        node = node.parent;
      }
      if (clickedId) {
        if ("shiftKey" in e.evt && e.evt.shiftKey) {
          addToSelection(clickedId);
        } else if (!selectedIds.includes(clickedId)) {
          setSelectedElementId(clickedId);
        }
      }
      return;
    }

    // ---- DRAWING TOOLS ----
    saveToHistory();
    const id = uuidv4();
    setDrawStartPos(snappedPos);

    let newElement: BoardElement;
    switch (tool) {
      case "rectangle":
        newElement = { id, type: "rectangle", x: snappedPos.x, y: snappedPos.y, width: 0, height: 0, fill: fillColor, stroke: strokeColor, strokeWidth, rotation: 0, opacity: 1 };
        break;
      case "circle":
        newElement = { id, type: "circle", x: snappedPos.x, y: snappedPos.y, radius: 0, fill: fillColor, stroke: strokeColor, strokeWidth, rotation: 0, opacity: 1 };
        break;
      case "freehand":
        newElement = { id, type: "freehand", x: 0, y: 0, points: [pos.x, pos.y], fill: "transparent", stroke: strokeColor, strokeWidth, rotation: 0, opacity: 1 };
        break;
      case "text":
        newElement = { id, type: "text", x: snappedPos.x, y: snappedPos.y, text: "Double-click to edit", fontSize: 20, fill: strokeColor, stroke: "transparent", strokeWidth: 0, rotation: 0, opacity: 1, width: 200 };
        addElement(newElement); onElementAdd?.(newElement); setSelectedElementId(id);
        setEditingText({ id, x: snappedPos.x * stageScale + stageX, y: snappedPos.y * stageScale + stageY });
        return;
      case "sticky-note":
        newElement = { id, type: "sticky-note", x: snappedPos.x - 75, y: snappedPos.y - 75, width: 150, height: 150, text: "New note", fill: "#FFD966", stroke: "#E0C200", strokeWidth: 1, rotation: 0, opacity: 1 };
        addElement(newElement); onElementAdd?.(newElement); setSelectedElementId(id);
        return;
      default: return;
    }
    addElement(newElement);
    setDrawingElementId(id);
    setIsDrawing(true);
  }, [tool, fillColor, strokeColor, strokeWidth, getWorldPos, addElement, setIsDrawing, saveToHistory, setSelectedElementId, setSelectedElementIds, addToSelection, selectedIds, onElementAdd, onElementDelete, spaceHeld, connectorFromId, elements, stageScale, stageX, stageY, deleteElement, snapToGrid]);

  // ---- MOUSE MOVE ----
  const handleMouseMove = useCallback(() => {
    const worldPos = getWorldPos();
    if (worldPos && onCursorMove) {
      const now = Date.now();
      if (now - lastCursorEmit.current > 50) { onCursorMove(worldPos.x, worldPos.y); lastCursorEmit.current = now; }
    }
    if (isPanning) return;

    // Selection box drag
    if (selectionStart && worldPos) {
      const x = Math.min(selectionStart.x, worldPos.x);
      const y = Math.min(selectionStart.y, worldPos.y);
      const w = Math.abs(worldPos.x - selectionStart.x);
      const h = Math.abs(worldPos.y - selectionStart.y);
      setSelectionBox({ x, y, w, h });
      return;
    }

    if (!isDrawing || !drawingElementId || !drawStartPos) return;
    const pos = getWorldPos();
    if (!pos) return;

    switch (tool) {
      case "rectangle":
        updateElement(drawingElementId, {
          x: snapToGrid(Math.min(pos.x, drawStartPos.x)), y: snapToGrid(Math.min(pos.y, drawStartPos.y)),
          width: Math.abs(pos.x - drawStartPos.x), height: Math.abs(pos.y - drawStartPos.y),
        });
        break;
      case "circle": {
        const dx = pos.x - drawStartPos.x, dy = pos.y - drawStartPos.y;
        updateElement(drawingElementId, { radius: Math.sqrt(dx * dx + dy * dy) });
        break;
      }
      case "freehand": {
        const el = elements.find((e) => e.id === drawingElementId);
        if (el && el.type === "freehand") updateElement(drawingElementId, { points: [...el.points, pos.x, pos.y] });
        break;
      }
    }
  }, [isDrawing, drawingElementId, tool, getWorldPos, drawStartPos, updateElement, elements, onCursorMove, isPanning, selectionStart, snapToGrid]);

  // ---- MOUSE UP ----
  const handleMouseUp = useCallback(() => {
    if (isPanning) { setIsPanning(false); return; }

    // Finish selection box
    if (selectionBox && selectionBox.w > 5 && selectionBox.h > 5) {
      const selected = elements.filter((el) => {
        if (el.type === "connector") return false;
        const b = getElementBounds(el);
        return b.x >= selectionBox.x && b.y >= selectionBox.y && b.x + b.w <= selectionBox.x + selectionBox.w && b.y + b.h <= selectionBox.y + selectionBox.h;
      }).map((el) => el.id);
      if (selected.length > 0) setSelectedElementIds(selected);
    }
    setSelectionBox(null);
    setSelectionStart(null);

    if (!isDrawing || !drawingElementId) return;
    const finalElement = useBoardStore.getState().elements.find((el) => el.id === drawingElementId);
    if (finalElement) onElementAdd?.(finalElement);
    setIsDrawing(false);
    setDrawingElementId(null);
    setDrawStartPos(null);
  }, [isDrawing, drawingElementId, setIsDrawing, onElementAdd, isPanning, selectionBox, elements, setSelectedElementIds]);

  // ---- DOUBLE CLICK ----
  const handleDblClick = useCallback(() => {
    const pos = getWorldPos();
    if (!pos || tool !== "select") return;
    const stage = stageRef.current;
    if (!stage) return;
    const screenPointer = stage.getPointerPosition();
    if (!screenPointer) return;
    const target = stage.getIntersection(screenPointer);
    if (!target) return;
    let node: Konva.Node | null = target;
    let elementId: string | null = null;
    while (node) { const id = node.id(); if (id && elements.find((el) => el.id === id)) { elementId = id; break; } node = node.parent; }
    if (!elementId) return;
    const element = elements.find((el) => el.id === elementId);
    if (!element) return;
    if (element.type === "text" || element.type === "sticky-note") {
      setEditingText({ id: element.id, x: element.x * stageScale + stageX, y: element.y * stageScale + stageY });
    }
  }, [tool, elements, getWorldPos, stageScale, stageX, stageY]);

  const handleTextEdit = useCallback((value: string) => {
    if (!editingText) return;
    updateElement(editingText.id, { text: value });
    onElementUpdate?.(editingText.id, { text: value });
  }, [editingText, updateElement, onElementUpdate]);

  const finishTextEditing = useCallback(() => { setEditingText(null); }, []);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === stageRef.current) setStagePosition(e.target.x(), e.target.y());
  }, [setStagePosition]);

  const renderElement = (element: BoardElement) => {
    switch (element.type) {
      case "rectangle": return <RectangleShape key={element.id} element={element} />;
      case "circle": return <CircleShape key={element.id} element={element} />;
      case "freehand": return <FreeDrawShape key={element.id} element={element} />;
      case "text": return <TextShape key={element.id} element={element} />;
      case "sticky-note": return <StickyNoteShape key={element.id} element={element} />;
      case "connector": return <ConnectorShape key={element.id} element={element} />;
      case "image": return <ImageShape key={element.id} element={element} />;
    }
  };

  const editingElement = editingText ? elements.find((el) => el.id === editingText.id) : null;
  const shouldPan = isPanning || spaceHeld;
  const bgColor = darkMode ? "#1a1a2e" : "#f3f4f6";
  const gridColor = darkMode ? "#333" : "#ccc";

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `radial-gradient(circle, ${gridColor} 1px, transparent 1px)`,
        backgroundSize: `${20 * stageScale}px ${20 * stageScale}px`,
        backgroundPosition: `${stageX % (20 * stageScale)}px ${stageY % (20 * stageScale)}px`,
      }} />

      {/* Zoom indicator */}
      <div className={`absolute top-3 right-3 z-10 flex items-center gap-2 rounded-lg px-3 py-1.5 shadow-sm border ${darkMode ? "bg-gray-800/90 border-gray-600 text-gray-300" : "bg-white/90 border-gray-200"}`}>
        <button onClick={() => zoomTo(stageScale / 1.2, stageSize.width / 2, stageSize.height / 2)} className="text-sm font-bold hover:opacity-70">-</button>
        <span className="text-xs w-12 text-center font-mono">{Math.round(stageScale * 100)}%</span>
        <button onClick={() => zoomTo(stageScale * 1.2, stageSize.width / 2, stageSize.height / 2)} className="text-sm font-bold hover:opacity-70">+</button>
        <button onClick={resetView} className="text-xs text-blue-500 hover:text-blue-700 ml-1">Reset</button>
      </div>

      {tool === "connector" && (
        <div className="absolute top-3 left-3 z-10 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-sm">
          {connectorFromId ? "Click target element" : "Click source element"}
        </div>
      )}

      <Stage
        ref={stageRef}
        width={stageSize.width} height={stageSize.height}
        scaleX={stageScale} scaleY={stageScale}
        x={stageX} y={stageY}
        draggable={shouldPan}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
        onDblClick={handleDblClick} onDblTap={handleDblClick}
        onDragEnd={handleDragEnd}
        style={{ cursor: shouldPan ? "grab" : tool === "select" ? "default" : tool === "eraser" ? "not-allowed" : tool === "connector" ? "pointer" : "crosshair" }}
      >
        <Layer>
          {visibleElements.map(renderElement)}
          <TransformerComponent stageRef={stageRef} />
          {/* Selection box rectangle */}
          {selectionBox && selectionBox.w > 2 && (
            <SelectionRect
              x={selectionBox.x} y={selectionBox.y}
              width={selectionBox.w} height={selectionBox.h}
              fill="rgba(0, 150, 255, 0.1)" stroke="#0096FF"
              strokeWidth={1 / stageScale} dash={[6 / stageScale, 3 / stageScale]}
            />
          )}
        </Layer>
        {cursors && cursors.size > 0 && (
          <Layer listening={false}><CursorPresence cursors={cursors} /></Layer>
        )}
      </Stage>

      {/* Minimap */}
      <Minimap stageWidth={stageSize.width} stageHeight={stageSize.height} />

      {/* Text editing overlay */}
      {editingText && editingElement && (
        <textarea
          autoFocus
          className="absolute border-2 border-blue-500 bg-transparent p-1 outline-none resize-none z-20"
          style={{
            left: editingText.x, top: editingText.y,
            width: editingElement.type === "sticky-note" ? ((editingElement as {width:number}).width - 20) * stageScale : editingElement.type === "text" ? ((editingElement as {width:number}).width) * stageScale : 200,
            minHeight: 30,
            fontSize: editingElement.type === "text" ? `${(editingElement as {fontSize:number}).fontSize * stageScale}px` : `${14 * stageScale}px`,
            color: editingElement.type === "text" ? editingElement.fill : "#333",
          }}
          defaultValue={editingElement.type === "text" || editingElement.type === "sticky-note" ? (editingElement as {text:string}).text : ""}
          onChange={(e) => handleTextEdit(e.target.value)}
          onBlur={finishTextEditing}
          onKeyDown={(e) => { if (e.key === "Escape") finishTextEditing(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finishTextEditing(); } }}
        />
      )}
    </div>
  );
}
