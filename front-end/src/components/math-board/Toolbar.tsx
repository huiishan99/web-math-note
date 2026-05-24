import { ColorSwatch, Group } from "@mantine/core";
import { Play, RotateCcw, Undo2 } from "lucide-react";

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
  return (
    <div className="fixed left-4 right-4 top-4 z-30 flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-zinc-950/85 p-3 text-white shadow-lg backdrop-blur">
      <Button
        type="button"
        size="icon"
        variant="secondary"
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
        variant="secondary"
        onClick={onReset}
        disabled={isLoading}
        title="Reset"
      >
        <RotateCcw />
        <span className="sr-only">Reset</span>
      </Button>

      <Group gap="xs" className="min-w-0 flex-1">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition",
              color === swatch ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : "hover:border-white/40",
            )}
            onClick={() => onColorChange(swatch)}
            title={`Ink ${swatch}`}
          >
            <ColorSwatch color={swatch} size={20} />
          </button>
        ))}
      </Group>

      <Button
        type="button"
        onClick={onRun}
        disabled={isLoading}
        className="min-w-28 bg-white text-black hover:bg-white/90"
        title="Run"
      >
        <Play />
        {isLoading ? "Solving" : "Run"}
      </Button>
    </div>
  );
}
