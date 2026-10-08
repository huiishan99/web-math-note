"""Vercel entrypoint for the existing FastAPI backend.

The React build is served separately from public/ by Vercel's CDN.
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "back-end"))

from main import app  # noqa: E402, F401
