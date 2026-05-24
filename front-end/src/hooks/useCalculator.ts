import { useCallback, useMemo, useState } from "react";
import axios from "axios";

import type {
  CalculationItem,
  CalculatorApiResponse,
  Position,
  VariableMap,
} from "@/types/calculator";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8900";

function createResultId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeResult(result: unknown) {
  if (
    typeof result === "string"
    || typeof result === "number"
    || typeof result === "boolean"
    || result === null
  ) {
    return result;
  }

  return JSON.stringify(result);
}

export function useCalculator() {
  const [variables, setVariables] = useState<VariableMap>({});
  const [results, setResults] = useState<CalculationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVariables = useMemo(() => Object.keys(variables).length > 0, [variables]);

  const calculate = useCallback(async (image: string, position: Position) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post<CalculatorApiResponse>(`${API_URL}/calculate`, {
        image,
        dict_of_vars: variables,
      });

      const nextResults = response.data.data.map((item, index) => ({
        id: createResultId(),
        expr: item.expr,
        result: normalizeResult(item.result),
        assign: Boolean(item.assign),
        steps: item.steps ?? [],
        position: {
          x: position.x,
          y: position.y + index * 72,
        },
      }));

      setResults((currentResults) => [...currentResults, ...nextResults]);
      setVariables((currentVariables) => {
        const nextVariables = { ...currentVariables };
        nextResults.forEach((item) => {
          if (item.assign) {
            nextVariables[item.expr] = item.result;
          }
        });
        return nextVariables;
      });

      return nextResults;
    } catch (requestError) {
      let detail = "Calculation failed.";
      if (axios.isAxiosError(requestError)) {
        detail = requestError.response?.data?.detail
          || (requestError.message === "Network Error"
            ? `Cannot reach backend at ${API_URL}.`
            : requestError.message);
      }
      setError(String(detail));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [variables]);

  const moveResult = useCallback((id: string, position: Position) => {
    setResults((currentResults) => currentResults.map((result) => (
      result.id === id ? { ...result, position } : result
    )));
  }, []);

  const removeVariable = useCallback((name: string) => {
    setVariables((currentVariables) => {
      const nextVariables = { ...currentVariables };
      delete nextVariables[name];
      return nextVariables;
    });
  }, []);

  const clearAll = useCallback(() => {
    setVariables({});
    setResults([]);
    setError(null);
  }, []);

  return {
    variables,
    results,
    hasVariables,
    isLoading,
    error,
    setError,
    calculate,
    moveResult,
    removeVariable,
    clearAll,
  };
}
