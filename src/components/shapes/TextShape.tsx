"use client";

import { Text } from "react-konva";
import { TextElement } from "@/types";
import { useBoardStore } from "@/store/boardStore";

// =============================================================
// TEXT ELEMENT
// =============================================================
//
// THE CANVAS TEXT EDITING PROBLEM:
// HTML Canvas cannot render editable text fields natively.
// Canvas only draws pixels — there's no cursor, no selection, no typing.
//
// SOLUTION — The "HTML Overlay" technique:
// 1. Display text normally on canvas using <Text>
// 2. When user double-clicks: hide canvas text, show an HTML <textarea>
//    positioned exactly over the canvas text
// 3. User types in the HTML textarea (native editing!)
// 4. When done (blur/Enter): hide textarea, update canvas text
//
// This is what Figma, Canva, and Excalidraw all do.
// The editing logic is in Canvas.tsx (parent component).

interface Props {
  element: TextElement;
}

export default function TextShape({ element }: Props) {
  const selectedIds = useBoardStore((s) => s.selectedElementIds);
  const setSelectedId = useBoardStore((s) => s.setSelectedElementId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const saveToHistory = useBoardStore((s) => s.saveToHistory);
  const tool = useBoardStore((s) => s.tool);

  const isSelected = selectedIds.includes(element.id);

  return (
    <Text
      id={element.id}
      x={element.x}
      y={element.y}
      text={element.text}
      fontSize={element.fontSize}
      fill={element.fill}
      width={element.width}
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
        saveToHistory();
        updateElement(element.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(20, node.width() * node.scaleX()),
          rotation: node.rotation(),
        });
        node.scaleX(1);
        node.scaleY(1);
      }}
      // Visual feedback for selection
      stroke={isSelected ? "#0096FF" : undefined}
      strokeWidth={isSelected ? 0.5 : 0}
    />
  );
}
