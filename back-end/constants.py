from dotenv import load_dotenv
import os

load_dotenv()

SERVER_URL = os.getenv("SERVER_URL", "localhost")
PORT = os.getenv("PORT", "8900")
ENV = os.getenv("ENV", "dev")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
