export interface SolverStatus {
  configured: boolean;
  human_verification_required?: boolean;
  human_verification_configured?: boolean;
}

export type SolverReadiness = {
  state: "checking" | "ready" | "unavailable";
  message: string | null;
  needsVerification: boolean;
};

export function evaluateSolverReadiness(status: SolverStatus, hasSiteKey: boolean, isDevelopment: boolean): SolverReadiness {
  const needsVerification = status.human_verification_required ?? !isDevelopment;
  if (!status.configured) return {
    state: "unavailable", needsVerification,
    message: "AI solving isn't connected yet. Drawing and export still work.",
  };
  if (needsVerification && (!hasSiteKey || status.human_verification_configured !== true)) return {
    state: "unavailable", needsVerification,
    message: "AI solving is waiting for bot-protection setup. Drawing and export still work.",
  };
  return { state: "ready", message: null, needsVerification };
}
