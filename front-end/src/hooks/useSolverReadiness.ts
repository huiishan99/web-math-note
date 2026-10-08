import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { resolveApiUrl } from "@/lib/api-config";
import { evaluateSolverReadiness, type SolverReadiness, type SolverStatus } from "@/lib/solver-readiness";

const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV);

export function useSolverReadiness() {
  const [readiness, setReadiness] = useState<SolverReadiness>({ state: "checking", message: "Checking AI availability…", needsVerification: true });
  const controllerRef = useRef<AbortController>();
  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setReadiness({ state: "checking", message: "Checking AI availability…", needsVerification: true });
    try {
      const response = await axios.get<SolverStatus>(`${API_URL}/calculate/status`, { signal: controller.signal, timeout: 8000 });
      if (!controller.signal.aborted) setReadiness(evaluateSolverReadiness(response.data, Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY), import.meta.env.DEV));
    } catch {
      if (!controller.signal.aborted) setReadiness({ state: "unavailable", message: "Can't reach the AI service. Drawing and export still work.", needsVerification: true });
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => controllerRef.current?.abort();
  }, [refresh]);
  return { ...readiness, refresh };
}
