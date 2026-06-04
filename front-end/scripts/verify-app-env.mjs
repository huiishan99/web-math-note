import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const mode = process.argv[2] || "app";
const envFiles = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];

for (const envFile of envFiles) {
  loadEnvFile(resolve(process.cwd(), envFile));
}

const apiUrl = process.env.VITE_API_URL;
const accessToken = process.env.VITE_API_ACCESS_TOKEN;

if (!apiUrl) {
  fail(`Missing VITE_API_URL. Create front-end/.env.${mode}.local or export it before building.`);
}

let parsedUrl;
try {
  parsedUrl = new URL(apiUrl);
} catch {
  fail(`VITE_API_URL must be a valid absolute URL. Received: ${apiUrl}`);
}

const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
if (parsedUrl.protocol !== "https:" && !isLocalhost) {
  fail("Packaged app builds must use an HTTPS backend URL unless they target localhost.");
}

if (!accessToken) {
  warn("VITE_API_ACCESS_TOKEN is empty. That is fine for public auth, but private builds should pair it with BACKEND_ACCESS_TOKEN.");
}

console.log(`App build environment OK: ${parsedUrl.origin}`);

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const contents = readFileSync(path, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquote(trimmed.slice(separatorIndex + 1).trim());
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function warn(message) {
  console.warn(message);
}
