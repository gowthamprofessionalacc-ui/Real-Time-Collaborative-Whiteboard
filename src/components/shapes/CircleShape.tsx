"use client";

import { Circle } from "react-konva";
import { CircleElement } from "@/types";
import { useBoardStore } from "@/store/boardStore";

// =============================================================
// CIRCLE SHAPE
// =============================================================
// Same pattern as Rectangle but renders <Circle> with radius.
// Konva circles are positioned from their CENTER (x, y = center),
// unlike rectangles which position from top-left corner.

interface Props {
  element: CircleElement;
}

export default function CircleShape({ element }: Props) {
  const selectedId = useBoardStore((s) => s.selectedElementId);
  const setSelectedId = useBoardStore((s) => s.setSelectedElementId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const saveToHistory = useBoardStore((s) => s.saveToHistory);
  const tool = useBoardStore((s) => s.tool);

  const isSelected = selectedId === element.id;

  return (
    <Circle
      id={element.id}
      x={element.x}
      y={element.y}
      radius={element.radius}
      fill={element.fill}
      stroke={isSelected ? "#0096FF" : element.stroke}
      strokeWidth={isSelected ? 2 : element.strokeWidth}
      rotation={element.rotation}
      opacity={element.opacity}
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
      onTransformEnd={(e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        saveToHistory();
        // For circles, we scale the radius instead of width/height
        node.scaleX(1);
        node.scaleY(1);
        updateElement(element.id, {
          x: node.x(),
          y: node.y(),
          radius: Math.max(5, element.radius * scaleX),
          rotation: node.rotation(),
        });
      }}
    />
  );
}
