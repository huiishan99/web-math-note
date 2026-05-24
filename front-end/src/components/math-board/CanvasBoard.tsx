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
      className="absolute inset-0 h-full w-full touch-none bg-black cursor-crosshair"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
