"""Vercel entrypoint for the existing FastAPI backend.

The generated React build is bundled with the app and served by StaticFiles.
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "back-end"))

from main import app  # noqa: E402, F401
