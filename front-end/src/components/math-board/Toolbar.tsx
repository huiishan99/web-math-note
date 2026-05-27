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
  const toolButtonClass = "h-10 w-10 bg-white/[0.07] text-white transition hover:bg-white/[0.13] active:scale-95 disabled:text-white/30 sm:h-9 sm:w-9";
  const panelClass = "pointer-events-auto flex items-center rounded-md border border-white/10 bg-neutral-950/70 shadow-2xl shadow-black/35 backdrop-blur-2xl";

  return (
    <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-0 right-0 z-30 flex flex-col items-center gap-2 px-3 text-white sm:bottom-auto sm:top-4 sm:flex-row sm:justify-center sm:px-4">
      <div className={cn(panelClass, "gap-1 p-1")}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={toolButtonClass}
          onClick={onUndo}
          disabled={!canUndo || isLoading}
          aria-label="Undo"
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
          aria-label="Reset"
          title="Reset"
        >
          <RotateCcw />
          <span className="sr-only">Reset</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onRun}
          disabled={isLoading}
          className="h-10 w-10 shrink-0 bg-white text-black transition hover:bg-white/90 active:scale-95 disabled:bg-white/60 sm:h-9 sm:w-9"
          aria-label="Solve"
          title="Solve"
        >
          {isLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          <span className="sr-only">Solve</span>
        </Button>
      </div>

      <Group
        gap={6}
        className={cn(
          panelClass,
          "max-w-full min-w-0 justify-start overflow-x-auto p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:min-w-max sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden",
        )}
      >
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] transition hover:border-white/40 active:scale-95 sm:h-8 sm:w-8",
              color === swatch ? "border-white/75 bg-white/[0.13] shadow-[0_0_0_2px_rgba(255,255,255,0.26)]" : "",
            )}
            onClick={() => onColorChange(swatch)}
            aria-label={`Ink ${swatch}`}
            aria-pressed={color === swatch}
            title={`Ink ${swatch}`}
          >
            <ColorSwatch color={swatch} size={20} radius={4} />
          </button>
        ))}
      </Group>
    </div>
  );
}
