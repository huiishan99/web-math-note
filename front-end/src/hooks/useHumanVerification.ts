import { useCallback, useEffect, useRef, useState } from "react";
import { VerificationAttempts } from "@/lib/verification-attempt";

interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    execution: "execute";
    appearance: "interaction-only";
    callback: (token: string) => void;
    "error-callback": () => void;
    "expired-callback": () => void;
    "timeout-callback": () => void;
  }): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const timer = window.setTimeout(() => fail(), 15_000);
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      script.remove();
      scriptPromise = undefined;
      reject(new Error("Could not load browser verification. Check your connection and try again."));
    };
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (settled) return;
      window.clearTimeout(timer);
      if (window.turnstile) {
        settled = true;
        script.onload = null;
        script.onerror = null;
        resolve(window.turnstile);
      } else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function useHumanVerification() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string>();
  const attemptsRef = useRef(new VerificationAttempts());
  const timerRef = useRef<number>();
  const mountedRef = useRef(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const removeWidget = useCallback(() => {
    const widgetId = widgetRef.current;
    widgetRef.current = undefined;
    if (widgetId) {
      try { window.turnstile?.remove(widgetId); } catch { /* Already removed by the widget. */ }
    }
  }, []);

  const finish = useCallback((id: number, token?: string, message?: string) => {
    if (!attemptsRef.current.settle(id, token, message)) return;
    window.clearTimeout(timerRef.current);
    removeWidget();
    if (mountedRef.current) setIsVerifying(false);
  }, [removeWidget]);

  useEffect(() => {
    mountedRef.current = true;
    const attempts = attemptsRef.current;
    return () => {
      mountedRef.current = false;
      attempts.cancel();
      window.clearTimeout(timerRef.current);
      removeWidget();
    };
  }, [removeWidget]);

  const verify = useCallback((): Promise<string | undefined> => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!sitekey && import.meta.env.DEV) return Promise.resolve(undefined);
    if (!sitekey) return Promise.reject(new Error("The solver's bot protection is not configured yet."));
    const { id, promise } = attemptsRef.current.begin();
    setIsVerifying(true);
    timerRef.current = window.setTimeout(() => finish(id, undefined, "Browser verification timed out. Please try again."), 120_000);
    void loadTurnstile().then((turnstile) => {
      if (!attemptsRef.current.isCurrent(id)) return;
      if (!mountedRef.current || !containerRef.current) {
        finish(id, undefined, "Verification cancelled.");
        return;
      }
      // A fresh widget per Solve keeps callbacks and one-use tokens isolated.
      widgetRef.current = turnstile.render(containerRef.current, {
        sitekey,
        action: "solve",
        execution: "execute",
        appearance: "interaction-only",
        callback: (token) => finish(id, token),
        "error-callback": () => finish(id),
        "expired-callback": () => finish(id, undefined, "Browser verification expired. Please try again."),
        "timeout-callback": () => finish(id, undefined, "Browser verification timed out. Please try again."),
      });
      turnstile.execute(widgetRef.current);
    }).catch((error: unknown) => {
      finish(id, undefined, error instanceof Error ? error.message : undefined);
    });
    return promise;
  }, [finish]);

  return { containerRef, isVerifying, verify };
}
