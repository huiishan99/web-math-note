import { ColorSwatch, Group } from "@mantine/core";
import { LoaderCircle, RotateCcw, Sparkles, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SWATCHES } from "@/constants";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  color: string;
  canUndo: boolean;
  isLoading: boolean;
  onColorChange: (color: string) => void;
  onRun: () => void;
  onReset: () => void;
  onUndo: () => void;
}

export function Toolbar({
  color,
  canUndo,
  isLoading,
  onColorChange,
  onRun,
  onReset,
  onUndo,
}: ToolbarProps) {
  const toolButtonClass = "h-9 w-9 bg-white/[0.08] text-white hover:bg-white/[0.14] disabled:text-white/35";

  return (
    <div className="fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-md border border-white/10 bg-neutral-950/75 px-2 py-2 text-white shadow-2xl shadow-black/35 backdrop-blur-xl sm:bottom-auto sm:top-4">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={toolButtonClass}
        onClick={onUndo}
        disabled={!canUndo || isLoading}
        title="Undo"
      >
        <Undo2 />
        <span className="sr-only">Undo</span>
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={toolButtonClass}
        onClick={onReset}
        disabled={isLoading}
        title="Reset"
      >
        <RotateCcw />
        <span className="sr-only">Reset</span>
      </Button>

      <div className="mx-1 h-8 w-px shrink-0 bg-white/10" />

      <Group gap={6} className="min-w-max">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] transition",
              color === swatch ? "border-white/70 shadow-[0_0_0_2px_rgba(255,255,255,0.28)]" : "hover:border-white/40",
            )}
            onClick={() => onColorChange(swatch)}
            title={`Ink ${swatch}`}
          >
            <ColorSwatch color={swatch} size={18} radius={4} />
          </button>
        ))}
      </Group>

      <div className="mx-1 h-8 w-px shrink-0 bg-white/10" />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRun}
        disabled={isLoading}
        className="h-9 w-9 shrink-0 bg-white text-black hover:bg-white/90 disabled:bg-white/60"
        title="Solve"
      >
        {isLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
        <span className="sr-only">Solve</span>
      </Button>
    </div>
  );
}
