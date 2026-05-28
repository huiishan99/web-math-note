import type { PointerEventHandler, RefObject } from "react";

import type { DrawingTool } from "@/hooks/useDrawingCanvas";
import { cn } from "@/lib/utils";

interface CanvasBoardProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  tool: DrawingTool;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerEnter?: PointerEventHandler<HTMLCanvasElement>;
  onPointerLeave?: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
}

export function CanvasBoard({
  canvasRef,
  tool,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
}: CanvasBoardProps) {
  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute inset-0 h-full w-full touch-none bg-[#08090b]",
        tool === "pen" && "cursor-crosshair",
        tool === "eraser" && "cursor-cell",
        tool === "select" && "cursor-default",
      )}
      style={{
        backgroundImage: [
          "linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,255,0.026) 1px, transparent 1px)",
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
        ].join(", "),
        backgroundPosition: "-1px -1px, -1px -1px, 0 0",
        backgroundSize: "96px 96px, 96px 96px, 24px 24px",
      }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave ?? onPointerUp}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
