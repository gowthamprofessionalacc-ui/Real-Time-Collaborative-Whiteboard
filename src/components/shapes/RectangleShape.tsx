"use client";

import { Rect } from "react-konva";
import { RectangleElement } from "@/types";
import { useBoardStore } from "@/store/boardStore";

// =============================================================
// RECTANGLE SHAPE
// =============================================================
// WHY "use client"?
// Next.js App Router defaults to Server Components. But Konva
// uses browser APIs (Canvas, DOM events) that don't exist on the
// server. "use client" tells Next.js: "Run this in the browser."

interface Props {
  element: RectangleElement;
}

export default function RectangleShape({ element }: Props) {
  const selectedIds = useBoardStore((s) => s.selectedElementIds);
  const setSelectedId = useBoardStore((s) => s.setSelectedElementId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const saveToHistory = useBoardStore((s) => s.saveToHistory);
  const tool = useBoardStore((s) => s.tool);

  const isSelected = selectedIds.includes(element.id);

  return (
    <Rect
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      fill={element.fill}
      stroke={isSelected ? "#0096FF" : element.stroke}
      strokeWidth={isSelected ? 2 : element.strokeWidth}
      rotation={element.rotation}
      opacity={element.opacity}
      // Draggable only when using select tool
      draggable={tool === "select"}
      // Click to select
      onClick={() => {
        if (tool === "select") setSelectedId(element.id);
      }}
      onTap={() => {
        if (tool === "select") setSelectedId(element.id);
      }}
      // Save state before drag starts (for undo)
      onDragStart={() => saveToHistory()}
      // Update position when drag ends
      onDragEnd={(e) => {
        updateElement(element.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      // Transform (resize) events
      onTransformEnd={(e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        // Reset scale to 1 and apply it to width/height instead
        // WHY? Konva scales the visual, but we want to store actual dimensions.
        // If we kept scale, the stored width would be wrong.
        node.scaleX(1);
        node.scaleY(1);
        saveToHistory();
        updateElement(element.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(5, node.width() * scaleX),
          height: Math.max(5, node.height() * scaleY),
          rotation: node.rotation(),
        });
      }}
    />
  );
}
