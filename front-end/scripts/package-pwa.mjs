import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const mode = process.argv[2] || "app";
const projectRoot = resolve(process.cwd(), "..");
const distDir = resolve(process.cwd(), "dist");
const artifactsDir = resolve(projectRoot, "artifacts");
const packagePath = resolve(artifactsDir, "web-math-note-pwa.tar.gz");
const checksumPath = `${packagePath}.sha256`;
const manifestPath = resolve(artifactsDir, "web-math-note-pwa.manifest.json");

for (const envFile of [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`]) {
  loadEnvFile(resolve(process.cwd(), envFile));
}

if (!existsSync(resolve(distDir, "index.html"))) {
  fail("Missing front-end/dist/index.html. Run npm run build:app before packaging.");
}

mkdirSync(artifactsDir, { recursive: true });

const apiOrigin = getApiOrigin(process.env.VITE_API_URL);
const commit = commandOutput("git", ["rev-parse", "--short", "HEAD"], projectRoot) || "unknown";
const createdAt = new Date().toISOString();

writeFileSync(
  resolve(distDir, "app-build.json"),
  `${JSON.stringify({
    app: "web-math-note",
    kind: "pwa",
    createdAt,
    commit,
    apiOrigin,
  }, null, 2)}\n`,
);

run("tar", ["-czf", packagePath, "-C", distDir, "."]);

const checksum = createHash("sha256").update(readFileSync(packagePath)).digest("hex");
writeFileSync(checksumPath, `${checksum}  web-math-note-pwa.tar.gz\n`);
writeFileSync(
  manifestPath,
  `${JSON.stringify({
    package: packagePath,
    checksum,
    checksumFile: checksumPath,
    createdAt,
    commit,
    apiOrigin,
  }, null, 2)}\n`,
);

console.log(`Packaged ${packagePath}`);
console.log(`SHA256 ${checksum}`);

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

function getApiOrigin(apiUrl) {
  if (!apiUrl) {
    return "not-configured";
  }

  try {
    return new URL(apiUrl).origin;
  } catch {
    return "invalid";
  }
}

function commandOutput(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed.`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
