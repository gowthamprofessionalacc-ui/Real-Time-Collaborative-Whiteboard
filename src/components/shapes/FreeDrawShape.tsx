"use client";

import { Line } from "react-konva";
import { FreeDrawElement } from "@/types";
import { useBoardStore } from "@/store/boardStore";

// =============================================================
// FREEHAND DRAWING
// =============================================================
//
// HOW FREEHAND DRAWING WORKS:
// 1. User presses mouse down → start collecting points
// 2. Mouse moves → add each (x, y) to the points array
// 3. Mouse up → finalize the line
//
// The points are stored as a flat array: [x1, y1, x2, y2, ...]
// Konva's <Line> connects them all to form a smooth stroke.
//
// WHY <Line> AND NOT <Path>?
// - <Line> is simpler — just pass points array
// - <Path> uses SVG path syntax ("M 0 0 L 100 100") — more complex
// - For freehand drawing, <Line> with tension gives smooth curves
//
// PERFORMANCE NOTE:
// A single freehand stroke can have hundreds of points.
// Flat arrays are faster to process than objects ({x, y}).

interface Props {
  element: FreeDrawElement;
}

export default function FreeDrawShape({ element }: Props) {
  const selectedIds = useBoardStore((s) => s.selectedElementIds);
  const setSelectedId = useBoardStore((s) => s.setSelectedElementId);
  const tool = useBoardStore((s) => s.tool);
  const saveToHistory = useBoardStore((s) => s.saveToHistory);
  const updateElement = useBoardStore((s) => s.updateElement);

  const isSelected = selectedIds.includes(element.id);

  return (
    <Line
      id={element.id}
      points={element.points}
      stroke={isSelected ? "#0096FF" : element.stroke}
      strokeWidth={element.strokeWidth}
      opacity={element.opacity}
      // tension: 0 = straight lines, 0.5 = smooth curves
      // This makes freehand drawing look natural instead of jagged
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      // globalCompositeOperation controls how pixels blend.
      // "source-over" = normal drawing (new pixels on top)
      // Alternative: "destination-out" = eraser mode!
      globalCompositeOperation="source-over"
      draggable={tool === "select"}
      onClick={() => {
        if (tool === "select") setSelectedId(element.id);
      }}
      onTap={() => {
        if (tool === "select") setSelectedId(element.id);
      }}
      onDragStart={() => saveToHistory()}
      onDragEnd={(e) => {
        updateElement(element.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
    />
  );
}
