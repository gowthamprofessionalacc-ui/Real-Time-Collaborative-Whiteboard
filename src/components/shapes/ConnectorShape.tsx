"use client";

import { Arrow } from "react-konva";
import { ConnectorElement, BoardElement } from "@/types";
import { useBoardStore } from "@/store/boardStore";

// =============================================================
// CONNECTOR — Arrow connecting two elements
// =============================================================
//
// HOW CONNECTORS WORK:
// A connector stores fromId and toId (the shapes it connects).
// On every render, we calculate the actual positions by finding
// those shapes and computing their center points.
//
// WHEN A SHAPE MOVES:
// The connector doesn't store positions — it recalculates.
// So when User A drags a rectangle, the arrow follows automatically.
//
// WHEN A SHAPE IS DELETED:
// We fall back to fromX/fromY and toX/toY (stored at creation time).
// The arrow stays in place but is no longer "attached".
//
// WHY <Arrow> INSTEAD OF <Line>?
// Konva's <Arrow> automatically draws an arrowhead at the end.
// With <Line>, you'd need to calculate triangle points manually.

interface Props {
  element: ConnectorElement;
}

function getElementCenter(el: BoardElement): { x: number; y: number } {
  switch (el.type) {
    case "rectangle":
    case "sticky-note":
      return { x: el.x + (el.width ?? 0) / 2, y: el.y + (el.height ?? 0) / 2 };
    case "circle":
      return { x: el.x, y: el.y }; // Circle center is already x, y
    case "text":
      return { x: el.x + (el.width ?? 100) / 2, y: el.y + 10 };
    default:
      return { x: el.x, y: el.y };
  }
}

export default function ConnectorShape({ element }: Props) {
  const elements = useBoardStore((s) => s.elements);
  const selectedIds = useBoardStore((s) => s.selectedElementIds);
  const setSelectedId = useBoardStore((s) => s.setSelectedElementId);
  const tool = useBoardStore((s) => s.tool);

  const isSelected = selectedIds.includes(element.id);

  // Find connected elements and get their centers
  const fromEl = elements.find((el) => el.id === element.fromId);
  const toEl = elements.find((el) => el.id === element.toId);

  const from = fromEl ? getElementCenter(fromEl) : { x: element.fromX, y: element.fromY };
  const to = toEl ? getElementCenter(toEl) : { x: element.toX, y: element.toY };

  return (
    <Arrow
      id={element.id}
      points={[from.x, from.y, to.x, to.y]}
      stroke={isSelected ? "#0096FF" : element.stroke}
      strokeWidth={element.strokeWidth || 2}
      fill={isSelected ? "#0096FF" : element.stroke}
      pointerLength={10}
      pointerWidth={8}
      opacity={element.opacity}
      hitStrokeWidth={15} // Easier to click on thin lines
      onClick={() => {
        if (tool === "select") setSelectedId(element.id);
      }}
      onTap={() => {
        if (tool === "select") setSelectedId(element.id);
      }}
    />
  );
}
