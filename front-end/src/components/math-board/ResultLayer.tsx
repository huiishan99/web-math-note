import { useMemo, useState } from "react";
import Draggable from "react-draggable";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMathJax } from "@/hooks/useMathJax";
import type { CalculationItem, Position, VariableValue } from "@/types/calculator";
import { cn } from "@/lib/utils";

interface ResultLayerProps {
  results: CalculationItem[];
  onMove: (id: string, position: Position) => void;
  onCopy?: (message: string) => void;
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

function getResultText(result: CalculationItem, cardText = false) {
  const answer = formatResult(result.result);
  if (cardText && !result.assign && result.steps.length === 0) {
    return answer;
  }

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

export function ResultLayer({ results, onMove, onCopy }: ResultLayerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const mathJaxKey = useMemo(
    () => results.map((result) => `${result.id}:${result.expr}:${formatResult(result.result)}`).join("|"),
    [results],
  );

  useMathJax(mathJaxKey);

  if (results.length === 0) {
    return null;
  }

  const copyResult = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      onCopy?.("Copied result.");
      window.setTimeout(() => setCopiedId((currentId) => (currentId === id ? null : currentId)), 1300);
    } catch {
      onCopy?.("Could not copy result.");
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {results.map((result) => {
        const resultText = getResultText(result);
        const shouldUseLatex = isMathLike(resultText);
        const shouldUseCard = result.assign
          || result.steps.length > 0
          || (!shouldUseLatex && formatResult(result.result).length > 28);
        const isInlineAnswer = !shouldUseCard;
        const plainText = getResultText(result, shouldUseCard && !shouldUseLatex);
        const displayContent = shouldUseLatex ? getResultLatex(result) : plainText;
        const contentClassName = shouldUseLatex
          ? (isInlineAnswer ? "latex-content text-[2rem] font-medium leading-none" : "latex-content text-lg")
          : (isInlineAnswer
            ? "max-w-[min(26rem,calc(100vw-2rem))] whitespace-pre-wrap text-[1.8rem] leading-tight"
            : "max-w-sm whitespace-pre-wrap pr-8 text-base leading-relaxed");
        const copyText = shouldUseLatex ? resultText : plainText;

        return (
          <Draggable
            key={result.id}
            bounds="parent"
            position={result.position}
            cancel="button"
            onStop={(_, data) => onMove(result.id, { x: data.x, y: data.y })}
          >
            <div
              className={cn(
                "answer-pop",
                isInlineAnswer
                  ? "pointer-events-auto absolute cursor-grab px-1 py-0 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] active:cursor-grabbing"
                  : "pointer-events-auto absolute max-w-[min(24rem,calc(100vw-2rem))] cursor-grab rounded-md border border-white/10 bg-neutral-950/72 px-3 py-2 text-white shadow-xl shadow-black/30 backdrop-blur-2xl active:cursor-grabbing",
              )}
              onDoubleClick={() => copyResult(result.id, copyText)}
              title="Double-click to copy"
            >
              <div className={contentClassName} style={shouldUseLatex ? undefined : textAnswerStyle}>
                {displayContent}
              </div>
              {shouldUseCard && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1.5 top-1.5 !h-7 !w-7 text-white/55 hover:bg-white/10 hover:text-white"
                  onClick={() => copyResult(result.id, copyText)}
                  aria-label="Copy result"
                  title="Copy result"
                >
                  {copiedId === result.id ? <Check /> : <Copy />}
                  <span className="sr-only">Copy result</span>
                </Button>
              )}
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
