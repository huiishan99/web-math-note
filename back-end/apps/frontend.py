"""Serve the built notebook without requiring a second frontend deployment."""

from pathlib import Path
from fastapi import FastAPI
from starlette.staticfiles import StaticFiles


def mount_frontend(app: FastAPI, directory: Path) -> None:
    # Local backend-only development still works before a frontend build exists.
    if not (directory / "index.html").is_file():
        return
    # Called after API registration so static files cannot shadow API routes.
    app.mount("/", StaticFiles(directory=directory, html=True), name="notebook")
