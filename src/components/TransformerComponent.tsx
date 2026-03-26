"use client";

import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";
import Konva from "konva";
import { useBoardStore } from "@/store/boardStore";

// =============================================================
// TRANSFORMER — Selection handles (resize, rotate)
// =============================================================
//
// WHAT IS A TRANSFORMER?
// When you click a shape in Figma, you see blue handles around it
// that let you resize and rotate. That's a Transformer.
//
// Konva has a built-in <Transformer> component that does this.
// You just tell it WHICH node to attach to.
//
// HOW IT WORKS:
// 1. User selects a shape → selectedElementId is set in store
// 2. This component finds the Konva node with that ID
// 3. Attaches the transformer to it → handles appear
// 4. User drags a handle → Konva fires onTransformEnd on the shape
// 5. Shape component saves the new dimensions

interface Props {
  stageRef: React.RefObject<Konva.Stage | null>;
}

export default function TransformerComponent({ stageRef }: Props) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedId = useBoardStore((s) => s.selectedElementId);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (selectedId) {
      // Find the Konva node by ID on the stage
      const selectedNode = stage.findOne(`#${selectedId}`);
      if (selectedNode) {
        transformer.nodes([selectedNode]);
        transformer.getLayer()?.batchDraw();
        return;
      }
    }

    // Nothing selected — detach transformer
    transformer.nodes([]);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, stageRef]);

  return (
    <Transformer
      ref={transformerRef}
      // Visual config for the selection handles
      borderStroke="#0096FF"
      borderStrokeWidth={1.5}
      anchorStroke="#0096FF"
      anchorFill="#fff"
      anchorSize={8}
      anchorCornerRadius={2}
      // Enable rotation handle
      rotateEnabled={true}
      // Keep aspect ratio when shift is held (Figma behavior)
      keepRatio={false}
      // Minimum size — prevent shapes from being resized to 0
      boundBoxFunc={(oldBox, newBox) => {
        if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
          return oldBox;
        }
        return newBox;
      }}
    />
  );
}
