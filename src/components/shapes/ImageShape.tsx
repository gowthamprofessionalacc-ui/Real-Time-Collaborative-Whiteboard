"use client";

import { useEffect, useRef } from "react";
import { Image as KonvaImage } from "react-konva";
import { ImageElement } from "@/types";
import { useBoardStore } from "@/store/boardStore";

interface Props {
  element: ImageElement;
}

export default function ImageShape({ element }: Props) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const selectedIds = useBoardStore((s) => s.selectedElementIds);
  const setSelectedId = useBoardStore((s) => s.setSelectedElementId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const saveToHistory = useBoardStore((s) => s.saveToHistory);
  const tool = useBoardStore((s) => s.tool);

  const isSelected = selectedIds.includes(element.id);

  useEffect(() => {
    const img = new window.Image();
    img.src = element.src;
    img.onload = () => {
      imageRef.current = img;
    };
  }, [element.src]);

  if (!imageRef.current) {
    // Image still loading — render placeholder
    const img = new window.Image();
    img.src = element.src;
    imageRef.current = img;
  }

  return (
    <KonvaImage
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      image={imageRef.current}
      rotation={element.rotation}
      opacity={element.opacity}
      stroke={isSelected ? "#0096FF" : undefined}
      strokeWidth={isSelected ? 2 : 0}
      draggable={tool === "select"}
      onClick={() => { if (tool === "select") setSelectedId(element.id); }}
      onTap={() => { if (tool === "select") setSelectedId(element.id); }}
      onDragStart={() => saveToHistory()}
      onDragEnd={(e) => {
        updateElement(element.id, { x: e.target.x(), y: e.target.y() });
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
          width: Math.max(10, node.width() * scaleX),
          height: Math.max(10, node.height() * scaleY),
          rotation: node.rotation(),
        });
      }}
    />
  );
}
