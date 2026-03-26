"use client";

import { useMemo } from "react";
import { useBoardStore } from "@/store/boardStore";
import { BoardElement } from "@/types";

// =============================================================
// MINIMAP — Bird's eye view of the entire board
// =============================================================
// Shows all elements as tiny dots/rectangles in a small corner panel.
// The viewport rectangle shows where you're currently looking.
// Click on the minimap to jump to that area.

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 100;
const PADDING = 50;

function getElementBounds(el: BoardElement) {
  switch (el.type) {
    case "rectangle":
    case "sticky-note":
      return { x: el.x, y: el.y, w: el.width ?? 0, h: el.height ?? 0 };
    case "circle":
      return { x: el.x - el.radius, y: el.y - el.radius, w: el.radius * 2, h: el.radius * 2 };
    case "text":
      return { x: el.x, y: el.y, w: el.width || 200, h: 24 };
    case "image":
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case "connector":
      return { x: Math.min(el.fromX, el.toX), y: Math.min(el.fromY, el.toY), w: Math.abs(el.toX - el.fromX), h: Math.abs(el.toY - el.fromY) };
    case "freehand": {
      if (el.points.length < 2) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < el.points.length; i += 2) {
        minX = Math.min(minX, el.points[i]);
        minY = Math.min(minY, el.points[i + 1]);
        maxX = Math.max(maxX, el.points[i]);
        maxY = Math.max(maxY, el.points[i + 1]);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
}

interface MinimapProps {
  stageWidth: number;
  stageHeight: number;
}

export default function Minimap({ stageWidth, stageHeight }: MinimapProps) {
  const elements = useBoardStore((s) => s.elements);
  const stageScale = useBoardStore((s) => s.stageScale);
  const stageX = useBoardStore((s) => s.stageX);
  const stageY = useBoardStore((s) => s.stageY);
  const setStagePosition = useBoardStore((s) => s.setStagePosition);

  // Calculate the world bounds (bounding box of all elements)
  const worldBounds = useMemo(() => {
    if (elements.length === 0) return { x: 0, y: 0, w: 1000, h: 600 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    return {
      x: minX - PADDING,
      y: minY - PADDING,
      w: maxX - minX + PADDING * 2,
      h: maxY - minY + PADDING * 2,
    };
  }, [elements]);

  // Scale factor to fit world into minimap
  const scale = Math.min(MINIMAP_WIDTH / worldBounds.w, MINIMAP_HEIGHT / worldBounds.h);

  // Viewport rectangle (what's visible on screen)
  const viewLeft = (-stageX / stageScale - worldBounds.x) * scale;
  const viewTop = (-stageY / stageScale - worldBounds.y) * scale;
  const viewW = (stageWidth / stageScale) * scale;
  const viewH = (stageHeight / stageScale) * scale;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Convert minimap coords to world coords
    const worldX = mx / scale + worldBounds.x;
    const worldY = my / scale + worldBounds.y;
    // Center the viewport on that point
    setStagePosition(
      -(worldX - stageWidth / stageScale / 2) * stageScale,
      -(worldY - stageHeight / stageScale / 2) * stageScale
    );
  };

  return (
    <div
      className="absolute bottom-3 right-3 z-10 bg-white/90 dark:bg-gray-800/90 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden cursor-pointer shadow-sm"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      onClick={handleClick}
    >
      {/* Render element dots */}
      {elements.map((el) => {
        const b = getElementBounds(el);
        const x = (b.x - worldBounds.x) * scale;
        const y = (b.y - worldBounds.y) * scale;
        const w = Math.max(2, b.w * scale);
        const h = Math.max(2, b.h * scale);
        return (
          <div
            key={el.id}
            className="absolute bg-blue-400/60 dark:bg-blue-300/60 rounded-[1px]"
            style={{ left: x, top: y, width: w, height: h }}
          />
        );
      })}
      {/* Viewport rectangle */}
      <div
        className="absolute border-2 border-red-500/70 rounded-[2px]"
        style={{
          left: Math.max(0, viewLeft),
          top: Math.max(0, viewTop),
          width: Math.min(viewW, MINIMAP_WIDTH),
          height: Math.min(viewH, MINIMAP_HEIGHT),
        }}
      />
    </div>
  );
}
