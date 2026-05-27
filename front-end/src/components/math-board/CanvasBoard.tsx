import type { PointerEventHandler, RefObject } from "react";

interface CanvasBoardProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
}

export function CanvasBoard({
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: CanvasBoardProps) {
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none cursor-crosshair bg-[#08090b]"
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
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
