export function resolveApiUrl(configured: string | undefined, isDevelopment: boolean): string {
  const base = configured?.trim() || (isDevelopment ? "http://127.0.0.1:8900" : "/api");
  return base.replace(/\/+$/, "");
}

// Leaves room for base64 encoding and the JSON envelope under Vercel's 4.5 MB limit.
export const MAX_IMAGE_DATA_URL_LENGTH = 4 * 1024 * 1024 + 64;
export const CALCULATION_TIMEOUT_MS = 45_000;
