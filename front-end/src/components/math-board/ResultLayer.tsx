import { useMemo } from "react";
import Draggable from "react-draggable";

import { useMathJax } from "@/hooks/useMathJax";
import type { CalculationItem, Position, VariableValue } from "@/types/calculator";

interface ResultLayerProps {
  results: CalculationItem[];
  onMove: (id: string, position: Position) => void;
}

function formatResult(value: VariableValue) {
  if (value === null) {
    return "null";
  }

  return String(value);
}

function getResultLatex(result: CalculationItem) {
  const answer = formatResult(result.result);
  if (!result.assign && result.steps.length === 0) {
    return `\\(\\LARGE{= ${answer}}\\)`;
  }

  return `\\(\\large{${result.expr} = ${answer}}\\)`;
}

export function ResultLayer({ results, onMove }: ResultLayerProps) {
  const mathJaxKey = useMemo(
    () => results.map((result) => `${result.id}:${result.expr}:${formatResult(result.result)}`).join("|"),
    [results],
  );

  useMathJax(mathJaxKey);

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {results.map((result) => {
        const isInlineAnswer = !result.assign && result.steps.length === 0;
        const latex = getResultLatex(result);

        return (
          <Draggable
            key={result.id}
            bounds="parent"
            position={result.position}
            onStop={(_, data) => onMove(result.id, { x: data.x, y: data.y })}
          >
            <div
              className={
                isInlineAnswer
                  ? "pointer-events-auto absolute px-1 py-0 text-sky-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
                  : "pointer-events-auto absolute max-w-sm rounded-md border border-white/10 bg-zinc-950/80 px-3 py-2 text-white shadow-lg backdrop-blur"
              }
            >
              <div className={isInlineAnswer ? "latex-content text-3xl font-medium" : "latex-content text-lg"}>
                {latex}
              </div>
              {result.steps.length > 0 && (
                <ol className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-300">
                  {result.steps.map((step, index) => (
                    <li key={`${result.id}-step-${index}`}>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          </Draggable>
        );
      })}
    </div>
  );
}
