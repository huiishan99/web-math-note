import { ColorSwatch, Group } from "@mantine/core";
import {
  Download,
  Eraser,
  ListTree,
  type LucideIcon,
  LoaderCircle,
  MousePointer2,
  PenLine,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SWATCHES } from "@/constants";
import type { DrawingTool } from "@/hooks/useDrawingCanvas";
import { cn } from "@/lib/utils";
import type { SolverMode } from "@/types/calculator";

interface ToolbarProps {
  color: string;
  tool: DrawingTool;
  solutionMode: SolverMode;
  strokeWidth: number;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  isLoading: boolean;
  onColorChange: (color: string) => void;
  onToolChange: (tool: DrawingTool) => void;
  onSolutionModeChange: (mode: SolverMode) => void;
  onStrokeWidthChange: (width: number) => void;
  onRun: () => void;
  onExport: () => void;
  onRedo: () => void;
  onReset: () => void;
  onUndo: () => void;
}

const TOOL_OPTIONS: Array<{ value: DrawingTool; label: string; icon: LucideIcon }> = [
  { value: "pen", label: "Pen", icon: PenLine },
  { value: "eraser", label: "Eraser", icon: Eraser },
  { value: "select", label: "Select", icon: MousePointer2 },
];

const SOLVER_MODE_OPTIONS: Array<{ value: SolverMode; label: string; icon: LucideIcon }> = [
  { value: "quick", label: "Quick answer", icon: Zap },
  { value: "explain", label: "Explain answer", icon: ListTree },
];

export function Toolbar({
  color,
  tool,
  solutionMode,
  strokeWidth,
  canUndo,
  canRedo,
  canExport,
  isLoading,
  onColorChange,
  onToolChange,
  onSolutionModeChange,
  onStrokeWidthChange,
  onRun,
  onExport,
  onRedo,
  onReset,
  onUndo,
}: ToolbarProps) {
  const toolButtonClass = "!h-8 !w-8 bg-white/[0.07] text-white transition hover:bg-white/[0.13] active:scale-95 disabled:text-white/30 sm:!h-9 sm:!w-9";
  const panelClass = "pointer-events-auto flex items-center rounded-md border border-white/10 bg-neutral-950/70 shadow-2xl shadow-black/35 backdrop-blur-2xl";

  const renderToolPanel = () => (
    <div className={cn(panelClass, "gap-1 p-1")}>
      {TOOL_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = tool === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              toolButtonClass,
              isActive && "bg-white/[0.16] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]",
            )}
            onClick={() => onToolChange(option.value)}
            aria-label={option.label}
            aria-pressed={isActive}
            title={option.label}
          >
            <Icon />
            <span className="sr-only">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );

  const renderWidthControl = () => (
    <label className={cn(panelClass, "h-10 shrink-0 gap-2 px-2 sm:h-[2.75rem]")} title="Stroke width">
      <span className="sr-only">Stroke width</span>
      <input
        type="range"
        min={2}
        max={8}
        step={1}
        value={strokeWidth}
        onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
        className="h-2 w-12 accent-white sm:w-24"
        aria-label="Stroke width"
      />
      <span
        className="rounded-full bg-white"
        style={{
          width: strokeWidth + 4,
          height: strokeWidth + 4,
        }}
      />
    </label>
  );

  const renderModePanel = () => (
    <div className={cn(panelClass, "gap-1 p-1")}>
      {SOLVER_MODE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = solutionMode === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              toolButtonClass,
              isActive && "bg-white/[0.16] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]",
            )}
            onClick={() => onSolutionModeChange(option.value)}
            aria-label={option.label}
            aria-pressed={isActive}
            title={option.label}
          >
            <Icon />
            <span className="sr-only">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );

  const renderActionPanel = () => (
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
        onClick={onRedo}
        disabled={!canRedo || isLoading}
        aria-label="Redo"
        title="Redo"
      >
        <Redo2 />
        <span className="sr-only">Redo</span>
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
        className={toolButtonClass}
        onClick={onExport}
        disabled={!canExport || isLoading}
        aria-label="Export PNG"
        title="Export PNG"
      >
        <Download />
        <span className="sr-only">Export PNG</span>
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRun}
        disabled={isLoading}
        className="!h-8 !w-8 shrink-0 bg-white text-black transition hover:bg-white/90 active:scale-95 disabled:bg-white/60 sm:!h-9 sm:!w-9"
        aria-label="Solve"
        title="Solve"
      >
        {isLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
        <span className="sr-only">Solve</span>
      </Button>
    </div>
  );

  const renderColorPanel = () => (
      <Group
        gap={6}
        className={cn(
          panelClass,
          "max-w-full min-w-0 !flex-nowrap justify-start overflow-x-auto p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:min-w-max sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden",
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
  );

  return (
    <>
      <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+4rem)] left-3 right-3 z-30 text-white xl:hidden">
        <div className="mb-2 flex justify-center gap-2">
          {renderWidthControl()}
          {renderModePanel()}
        </div>
        <div className="flex items-center justify-between gap-2">
          {renderToolPanel()}
          {renderActionPanel()}
        </div>
      </div>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 right-3 z-30 text-white xl:hidden">
        {renderColorPanel()}
      </div>
      <div className="pointer-events-none fixed left-[23rem] right-4 top-4 z-30 hidden items-center gap-2 overflow-x-auto text-white [-ms-overflow-style:none] [scrollbar-width:none] xl:flex [&::-webkit-scrollbar]:hidden">
        {renderToolPanel()}
        {renderWidthControl()}
        {renderModePanel()}
        {renderActionPanel()}
        {renderColorPanel()}
      </div>
    </>
  );
}
