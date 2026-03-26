"use client";

import { Group, Rect, Text } from "react-konva";
import { StickyNoteElement } from "@/types";
import { useBoardStore } from "@/store/boardStore";

// =============================================================
// STICKY NOTE
// =============================================================
//
// WHY <Group>?
// A sticky note is TWO Konva elements: a Rect (background) + Text (content).
// <Group> bundles them so they move, scale, and rotate together.
// Without Group, you'd have to manually sync their positions.
//
// Think of it like a <div> in HTML — it wraps child elements together.
//
// ALTERNATIVE: You could use a single <Rect> and draw text with
// Konva's sceneFunc (custom drawing). But <Group> is cleaner and
// each child gets its own event handling.

interface Props {
  element: StickyNoteElement;
}

export default function StickyNoteShape({ element }: Props) {
  const selectedId = useBoardStore((s) => s.selectedElementId);
  const setSelectedId = useBoardStore((s) => s.setSelectedElementId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const saveToHistory = useBoardStore((s) => s.saveToHistory);
  const tool = useBoardStore((s) => s.tool);

  const isSelected = selectedId === element.id;

  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
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
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        saveToHistory();
        updateElement(element.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(50, element.width * scaleX),
          height: Math.max(50, element.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    >
      {/* Background — the yellow sticky note look */}
      <Rect
        width={element.width}
        height={element.height}
        fill={element.fill}
        stroke={isSelected ? "#0096FF" : "#E0C200"}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={4}
        // Shadow gives the "paper" feel
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={8}
        shadowOffsetY={2}
      />
      {/* Text content — padded inside the note */}
      <Text
        x={10}
        y={10}
        width={element.width - 20}
        height={element.height - 20}
        text={element.text}
        fontSize={14}
        fill="#333"
        wrap="word"
        ellipsis={true}
      />
    </Group>
  );
}
