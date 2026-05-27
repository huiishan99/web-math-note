import { useMemo } from "react";
import Draggable from "react-draggable";

import { useMathJax } from "@/hooks/useMathJax";
import type { CalculationItem, Position, VariableValue } from "@/types/calculator";

interface ResultLayerProps {
  results: CalculationItem[];
  onMove: (id: string, position: Position) => void;
}

const textAnswerStyle = {
  fontFamily: '"MJXc-TeX-main-R", "MathJax_Main", "STIX Two Text", "Cambria Math", "Times New Roman", serif',
  fontWeight: 400,
  letterSpacing: 0,
};

function formatResult(value: VariableValue) {
  if (value === null) {
    return "null";
  }

  return String(value);
}

function isMathLike(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }

  const hasLetters = /[A-Za-z]/.test(trimmedValue);
  const hasWordSpacing = /[A-Za-z]\s+[A-Za-z]/.test(trimmedValue);
  const hasMathOperators = /[=+\-*/^√(){}[\]<>≤≥≈∞∫∑π]/.test(trimmedValue);

  return !hasWordSpacing && (!hasLetters || hasMathOperators || trimmedValue.length <= 3);
}

function getResultText(result: CalculationItem) {
  const answer = formatResult(result.result);
  if (!result.assign && result.steps.length === 0) {
    return `= ${answer}`;
  }

  return `${result.expr} = ${answer}`;
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
        const resultText = getResultText(result);
        const shouldUseLatex = isMathLike(resultText);
        const displayContent = shouldUseLatex ? getResultLatex(result) : resultText;
        const contentClassName = shouldUseLatex
          ? (isInlineAnswer ? "latex-content text-[2rem] font-medium leading-none" : "latex-content text-lg")
          : (isInlineAnswer
            ? "max-w-[min(26rem,calc(100vw-2rem))] whitespace-pre-wrap text-[1.8rem] leading-tight"
            : "max-w-sm whitespace-pre-wrap text-lg leading-relaxed");

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
                  ? "pointer-events-auto absolute px-1 py-0 text-[#8fdcff] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]"
                  : "pointer-events-auto absolute max-w-sm rounded-md border border-white/10 bg-neutral-950/78 px-3 py-2 text-white shadow-xl shadow-black/30 backdrop-blur-xl"
              }
            >
              <div className={contentClassName} style={shouldUseLatex ? undefined : textAnswerStyle}>
                {displayContent}
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
