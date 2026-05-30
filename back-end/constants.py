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
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", "5242880"))
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "4194304"))
SOLVER_TIMEOUT_SECONDS = int(os.getenv("SOLVER_TIMEOUT_SECONDS", "30"))
