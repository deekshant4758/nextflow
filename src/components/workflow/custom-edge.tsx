"use client";

import { useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { useWorkflowStudioStore } from "./workflow-store";

export function CustomDeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  const onEdgesChange = useWorkflowStudioStore((state) => state.onEdgesChange);

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgesChange([{ id, type: "remove" }]);
  };

  return (
    <>
      {/* Group hit area and edge for hover detection */}
      <g
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: "pointer" }}
      >
        {/* Invisible wider hit area */}
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
        />
        <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      </g>
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.15s ease",
            zIndex: 1000,
          }}
          className="nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            type="button"
            onClick={onDelete}
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-[#ef4444] text-white shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-transform hover:scale-115 active:scale-90"
            style={{ border: "1.5px solid white" }}
            title="Delete connection"
          >
            <span className="text-[10px] font-extrabold leading-none">✕</span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
