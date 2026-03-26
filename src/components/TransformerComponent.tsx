"use client";

import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";
import Konva from "konva";
import { useBoardStore } from "@/store/boardStore";

// Now supports MULTI-SELECT — attaches to all selected nodes

interface Props {
  stageRef: React.RefObject<Konva.Stage | null>;
}

export default function TransformerComponent({ stageRef }: Props) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedIds = useBoardStore((s) => s.selectedElementIds);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (selectedIds.length > 0) {
      const nodes = selectedIds
        .map((id) => stage.findOne(`#${id}`))
        .filter(Boolean) as Konva.Node[];

      if (nodes.length > 0) {
        transformer.nodes(nodes);
        transformer.getLayer()?.batchDraw();
        return;
      }
    }

    transformer.nodes([]);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, stageRef]);

  return (
    <Transformer
      ref={transformerRef}
      borderStroke="#0096FF"
      borderStrokeWidth={1.5}
      anchorStroke="#0096FF"
      anchorFill="#fff"
      anchorSize={8}
      anchorCornerRadius={2}
      rotateEnabled={true}
      keepRatio={false}
      boundBoxFunc={(oldBox, newBox) => {
        if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
        return newBox;
      }}
    />
  );
}
