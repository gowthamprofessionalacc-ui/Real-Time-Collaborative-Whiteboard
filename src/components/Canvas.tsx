"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { Stage, Layer } from "react-konva";
import Konva from "konva";
import { v4 as uuidv4 } from "uuid";
import { useBoardStore } from "@/store/boardStore";
import { BoardElement } from "@/types";
import RectangleShape from "./shapes/RectangleShape";
import CircleShape from "./shapes/CircleShape";
import FreeDrawShape from "./shapes/FreeDrawShape";
import TextShape from "./shapes/TextShape";
import StickyNoteShape from "./shapes/StickyNoteShape";
import TransformerComponent from "./TransformerComponent";

// =============================================================
// CANVAS — The main drawing surface
// =============================================================
//
// THIS IS THE CORE OF THE WHITEBOARD.
//
// It orchestrates everything:
// 1. Renders all elements from the store
// 2. Handles mouse/touch events for drawing
// 3. Manages the text editing overlay
// 4. Keyboard shortcuts (undo/redo, delete)
//
// EVENT FLOW FOR DRAWING:
//
//   mousedown (on Stage)
//   → Check which tool is active
//   → Create a new element with initial position
//   → Set isDrawing = true
//
//   mousemove (on Stage)
//   → If isDrawing, update the element being drawn
//   → For rectangle: update width/height based on mouse delta
//   → For freehand: append new point to points array
//
//   mouseup (on Stage)
//   → Finalize the element
//   → Set isDrawing = false
//   → Save to history (for undo)
//
// WHY DO WE TRACK drawingElementId SEPARATELY?
// The element being drawn exists in the store (so it renders on canvas)
// but we need to know WHICH element is currently being drawn to update
// it during mousemove. Once drawing finishes, drawingElementId resets.

export default function Canvas() {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [drawingElementId, setDrawingElementId] = useState<string | null>(null);
  const [drawStartPos, setDrawStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [editingText, setEditingText] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  // ---- RESPONSIVE CANVAS SIZE ----
  // Measure the container and resize the Konva stage to fit.
  // WHY useEffect + ResizeObserver?
  // The canvas needs pixel dimensions (not CSS %). ResizeObserver
  // fires whenever the container size changes (window resize, sidebar toggle).
  // ALTERNATIVE: window.addEventListener("resize") — but that doesn't
  // catch container-only changes (like a sidebar collapsing).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setStageSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Pull values from store using selectors (each re-renders independently)
  const elements = useBoardStore((s) => s.elements);
  const tool = useBoardStore((s) => s.tool);
  const fillColor = useBoardStore((s) => s.fillColor);
  const strokeColor = useBoardStore((s) => s.strokeColor);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const isDrawing = useBoardStore((s) => s.isDrawing);
  const setIsDrawing = useBoardStore((s) => s.setIsDrawing);
  const addElement = useBoardStore((s) => s.addElement);
  const updateElement = useBoardStore((s) => s.updateElement);
  const setSelectedElementId = useBoardStore((s) => s.setSelectedElementId);
  const saveToHistory = useBoardStore((s) => s.saveToHistory);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const deleteElement = useBoardStore((s) => s.deleteElement);
  const selectedElementId = useBoardStore((s) => s.selectedElementId);

  // ---- KEYBOARD SHORTCUTS ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when editing text
      if (editingText) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.key === "z" && e.shiftKey) || e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedElementId &&
        !editingText
      ) {
        e.preventDefault();
        deleteElement(selectedElementId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, deleteElement, selectedElementId, editingText]);

  // ---- GET POINTER POSITION ----
  // Returns cursor position relative to the stage (canvas), not the window.
  // WHY? If the canvas isn't at (0,0) on the page, window coordinates
  // would be offset. Stage coordinates are always correct.
  const getPointerPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.getPointerPosition();
  }, []);

  // ---- MOUSE DOWN ---- Create new element or start selection
  const handleMouseDown = useCallback(() => {
    const pos = getPointerPos();
    if (!pos) return;

    // If using select tool, clicking empty space deselects
    if (tool === "select") {
      // Check if we clicked on empty canvas (not on a shape)
      const stage = stageRef.current;
      if (stage) {
        const clickedOnEmpty = stage.getIntersection(pos) === null;
        if (clickedOnEmpty) {
          setSelectedElementId(null);
        }
      }
      return;
    }

    // Save current state for undo before we start drawing
    saveToHistory();

    const id = uuidv4();
    setDrawStartPos(pos);

    // Create the initial element based on active tool
    let newElement: BoardElement;

    switch (tool) {
      case "rectangle":
        newElement = {
          id,
          type: "rectangle",
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth,
          rotation: 0,
          opacity: 1,
        };
        break;

      case "circle":
        newElement = {
          id,
          type: "circle",
          x: pos.x,
          y: pos.y,
          radius: 0,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth,
          rotation: 0,
          opacity: 1,
        };
        break;

      case "freehand":
        newElement = {
          id,
          type: "freehand",
          x: 0,
          y: 0,
          points: [pos.x, pos.y],
          fill: "transparent",
          stroke: strokeColor,
          strokeWidth,
          rotation: 0,
          opacity: 1,
        };
        break;

      case "text":
        newElement = {
          id,
          type: "text",
          x: pos.x,
          y: pos.y,
          text: "Double-click to edit",
          fontSize: 20,
          fill: strokeColor,
          stroke: "transparent",
          strokeWidth: 0,
          rotation: 0,
          opacity: 1,
          width: 200,
        };
        addElement(newElement);
        setSelectedElementId(id);
        // Immediately open text editor
        setEditingText({ id, x: pos.x, y: pos.y });
        return; // Don't enter drawing mode for text

      case "sticky-note":
        newElement = {
          id,
          type: "sticky-note",
          x: pos.x - 75,
          y: pos.y - 75,
          width: 150,
          height: 150,
          text: "New note",
          fill: "#FFD966",
          stroke: "#E0C200",
          strokeWidth: 1,
          rotation: 0,
          opacity: 1,
        };
        addElement(newElement);
        setSelectedElementId(id);
        return; // Sticky notes are placed instantly, no drag

      default:
        return;
    }

    addElement(newElement);
    setDrawingElementId(id);
    setIsDrawing(true);
  }, [
    tool,
    fillColor,
    strokeColor,
    strokeWidth,
    getPointerPos,
    addElement,
    setIsDrawing,
    saveToHistory,
    setSelectedElementId,
  ]);

  // ---- MOUSE MOVE ---- Update the element being drawn
  const handleMouseMove = useCallback(() => {
    if (!isDrawing || !drawingElementId) return;
    const pos = getPointerPos();
    if (!pos || !drawStartPos) return;

    switch (tool) {
      case "rectangle":
        // Calculate width/height from start position to current position
        // Math.abs handles drawing in any direction (left, up, etc.)
        updateElement(drawingElementId, {
          x: Math.min(pos.x, drawStartPos.x),
          y: Math.min(pos.y, drawStartPos.y),
          width: Math.abs(pos.x - drawStartPos.x),
          height: Math.abs(pos.y - drawStartPos.y),
        });
        break;

      case "circle": {
        // Radius = distance from start to current position
        const dx = pos.x - drawStartPos.x;
        const dy = pos.y - drawStartPos.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        updateElement(drawingElementId, {
          radius,
        });
        break;
      }

      case "freehand": {
        // Append new point to the line
        const element = elements.find((el) => el.id === drawingElementId);
        if (element && element.type === "freehand") {
          updateElement(drawingElementId, {
            points: [...element.points, pos.x, pos.y],
          });
        }
        break;
      }
    }
  }, [
    isDrawing,
    drawingElementId,
    tool,
    getPointerPos,
    drawStartPos,
    updateElement,
    elements,
  ]);

  // ---- MOUSE UP ---- Finalize drawing
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !drawingElementId) return;

    setIsDrawing(false);
    setDrawingElementId(null);
    setDrawStartPos(null);
  }, [isDrawing, drawingElementId, setIsDrawing]);

  // ---- DOUBLE CLICK ---- Edit text / sticky note
  const handleDblClick = useCallback(() => {
    const pos = getPointerPos();
    if (!pos || tool !== "select") return;

    const stage = stageRef.current;
    if (!stage) return;

    const target = stage.getIntersection(pos);
    if (!target) return;

    // Find the element — walk up parents to find the one with our ID
    let node: Konva.Node | null = target;
    let elementId: string | null = null;
    while (node) {
      const id = node.id();
      if (id && elements.find((el) => el.id === id)) {
        elementId = id;
        break;
      }
      node = node.parent;
    }

    if (!elementId) return;
    const element = elements.find((el) => el.id === elementId);
    if (!element) return;

    if (element.type === "text" || element.type === "sticky-note") {
      setEditingText({ id: element.id, x: element.x, y: element.y });
    }
  }, [tool, elements, getPointerPos]);

  // ---- TEXT EDITING OVERLAY ----
  // This renders an HTML textarea on top of the canvas
  const handleTextEdit = useCallback(
    (value: string) => {
      if (!editingText) return;
      updateElement(editingText.id, { text: value });
    },
    [editingText, updateElement]
  );

  const finishTextEditing = useCallback(() => {
    setEditingText(null);
  }, []);

  // ---- RENDER ELEMENTS ----
  // This function maps each element to its React component.
  // The switch statement uses the discriminated union —
  // TypeScript narrows the type automatically.
  const renderElement = (element: BoardElement) => {
    switch (element.type) {
      case "rectangle":
        return <RectangleShape key={element.id} element={element} />;
      case "circle":
        return <CircleShape key={element.id} element={element} />;
      case "freehand":
        return <FreeDrawShape key={element.id} element={element} />;
      case "text":
        return <TextShape key={element.id} element={element} />;
      case "sticky-note":
        return <StickyNoteShape key={element.id} element={element} />;
    }
  };

  // Get the text of the element being edited (for the textarea)
  const editingElement = editingText
    ? elements.find((el) => el.id === editingText.id)
    : null;

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-gray-100">
      {/* Dot grid background — purely visual */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: "radial-gradient(circle, #ccc 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        style={{
          cursor:
            tool === "select"
              ? "default"
              : tool === "freehand"
              ? "crosshair"
              : "crosshair",
        }}
      >
        <Layer>
          {elements.map(renderElement)}
          <TransformerComponent stageRef={stageRef} />
        </Layer>
      </Stage>

      {/* ---- TEXT EDITING OVERLAY ---- */}
      {/* HTML textarea positioned over the canvas element being edited */}
      {editingText && editingElement && (
        <textarea
          autoFocus
          className="absolute border-2 border-blue-500 bg-transparent p-1 outline-none resize-none"
          style={{
            left: editingText.x,
            top: editingText.y,
            width:
              editingElement.type === "sticky-note"
                ? (editingElement as { width: number }).width - 20
                : editingElement.type === "text"
                ? (editingElement as { width: number }).width
                : 200,
            minHeight: 30,
            fontSize:
              editingElement.type === "text"
                ? `${(editingElement as { fontSize: number }).fontSize}px`
                : "14px",
            color:
              editingElement.type === "text" ? editingElement.fill : "#333",
          }}
          defaultValue={
            editingElement.type === "text" || editingElement.type === "sticky-note"
              ? (editingElement as { text: string }).text
              : ""
          }
          onChange={(e) => handleTextEdit(e.target.value)}
          onBlur={finishTextEditing}
          onKeyDown={(e) => {
            if (e.key === "Escape") finishTextEditing();
            // Ctrl/Cmd+Enter to finish (Shift+Enter for newline is default)
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              finishTextEditing();
            }
          }}
        />
      )}
    </div>
  );
}
