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
      className="absolute inset-0 h-full w-full touch-none cursor-crosshair bg-[#090a0c]"
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
