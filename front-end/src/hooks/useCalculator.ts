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
        status: "pending" as const,
        position: {
          x: position.x,
          y: position.y + index * 72,
        },
      }));

      setResults((currentResults) => [...currentResults, ...nextResults]);

      return nextResults;
    } catch (requestError) {
      let detail = "Calculation failed.";
      if (axios.isAxiosError(requestError)) {
        const status = requestError.response?.status;
        const responseDetail = requestError.response?.data?.detail;
        if (requestError.message === "Network Error") {
          detail = `Cannot reach backend at ${API_URL}.`;
        } else if (status === 401 || status === 403) {
          detail = responseDetail || "Gemini key is missing, invalid, or not allowed for this model.";
        } else if (status === 429) {
          detail = responseDetail || "Gemini quota or rate limit was reached.";
        } else if (status && status >= 500) {
          detail = responseDetail || "Backend or Gemini returned a server error.";
        } else {
          detail = responseDetail || requestError.message;
        }
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

  const deleteResult = useCallback((id: string) => {
    setResults((currentResults) => currentResults.filter((result) => result.id !== id));
    setVariables((currentVariables) => {
      const deletedResult = results.find((result) => result.id === id);
      if (!deletedResult?.assign || !(deletedResult.expr in currentVariables)) {
        return currentVariables;
      }

      const nextVariables = { ...currentVariables };
      delete nextVariables[deletedResult.expr];
      return nextVariables;
    });
  }, [results]);

  const acceptResult = useCallback((id: string) => {
    const acceptedResult = results.find((result) => result.id === id);

    setResults((currentResults) => currentResults.map((result) => (
      result.id === id ? { ...result, status: "accepted" as const } : result
    )));

    if (acceptedResult?.assign) {
      setVariables((currentVariables) => ({
        ...currentVariables,
        [acceptedResult.expr]: acceptedResult.result,
      }));
    }
  }, [results]);

  const removeVariable = useCallback((name: string) => {
    setVariables((currentVariables) => {
      const nextVariables = { ...currentVariables };
      delete nextVariables[name];
      return nextVariables;
    });
  }, []);

  const replaceState = useCallback((nextResults: CalculationItem[], nextVariables: VariableMap) => {
    setResults(nextResults);
    setVariables(nextVariables);
    setError(null);
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
    acceptResult,
    calculate,
    deleteResult,
    moveResult,
    removeVariable,
    replaceState,
    clearAll,
  };
}
