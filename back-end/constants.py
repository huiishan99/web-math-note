from dotenv import load_dotenv
import os

load_dotenv()


def _parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


SERVER_URL = os.getenv("SERVER_URL", "localhost")
PORT = os.getenv("PORT", "8900")
ENV = os.getenv("ENV", "dev")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
CORS_ORIGINS = _parse_csv(os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"))
BACKEND_ACCESS_TOKEN = os.getenv("BACKEND_ACCESS_TOKEN")
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "20"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "false").lower() in {"1", "true", "yes", "on"}
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", "3145728"))
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "4194304"))
SOLVER_TIMEOUT_SECONDS = int(os.getenv("SOLVER_TIMEOUT_SECONDS", "30"))
VERCEL_DEPLOYMENT = os.getenv("VERCEL") == "1"
TURNSTILE_REQUIRED = VERCEL_DEPLOYMENT or ENV == "production"
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY", "")
TURNSTILE_ALLOWED_HOSTNAMES = _parse_csv(os.getenv("TURNSTILE_ALLOWED_HOSTNAMES", ""))
for _vercel_host in (os.getenv("VERCEL_URL"), os.getenv("VERCEL_PROJECT_PRODUCTION_URL")):
    if _vercel_host and _vercel_host not in TURNSTILE_ALLOWED_HOSTNAMES:
        TURNSTILE_ALLOWED_HOSTNAMES.append(_vercel_host)
MAX_REQUEST_BYTES = 4_300_000
