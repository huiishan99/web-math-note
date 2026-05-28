import type { CalculationItem, VariableValue } from "@/types/calculator";

export function formatResultValue(value: VariableValue) {
  if (value === null) {
    return "null";
  }

  return String(value);
}

export function isMathLikeResult(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }

  const hasLetters = /[A-Za-z]/.test(trimmedValue);
  const hasWordSpacing = /[A-Za-z]\s+[A-Za-z]/.test(trimmedValue);
  const hasMathOperators = /[=+\-*/^√(){}[\]<>≤≥≈∞∫∑π]/.test(trimmedValue);

  return !hasWordSpacing && (!hasLetters || hasMathOperators || trimmedValue.length <= 3);
}

export function shouldUseResultCard(result: CalculationItem, resultText = getResultText(result)) {
  return result.assign
    || result.steps.length > 0
    || (!isMathLikeResult(resultText) && formatResultValue(result.result).length > 28);
}

export function getResultText(result: CalculationItem, cardText = false) {
  const answer = formatResultValue(result.result);
  if (cardText && !result.assign && result.steps.length === 0) {
    return answer;
  }

  if (!result.assign && result.steps.length === 0) {
    return `= ${answer}`;
  }

  return `${result.expr} = ${answer}`;
}

export function getResultLatex(result: CalculationItem) {
  const answer = formatResultValue(result.result);
  if (!result.assign && result.steps.length === 0) {
    return `\\(\\LARGE{= ${answer}}\\)`;
  }

  return `\\(\\large{${result.expr} = ${answer}}\\)`;
}
