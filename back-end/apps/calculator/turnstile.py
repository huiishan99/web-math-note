"""Validate one-use human-verification tokens before any AI request."""

import httpx
from fastapi import HTTPException

from constants import TURNSTILE_ALLOWED_HOSTNAMES, TURNSTILE_REQUIRED, TURNSTILE_SECRET_KEY

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_human(token: str | None) -> None:
    if not TURNSTILE_REQUIRED and not TURNSTILE_SECRET_KEY:
        return
    if not TURNSTILE_SECRET_KEY or not TURNSTILE_ALLOWED_HOSTNAMES:
        raise HTTPException(status_code=503, detail="The solver's bot protection is not configured yet.")
    if not token:
        raise HTTPException(status_code=403, detail="Please complete the browser verification and try again.")

    try:
        response = httpx.post(
            SITEVERIFY_URL,
            data={"secret": TURNSTILE_SECRET_KEY, "response": token},
            timeout=8.0,
            follow_redirects=False,
        )
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError("Invalid verification response")
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Browser verification is temporarily unavailable. Please try again.") from exc

    # Cloudflare rejects expired and reused tokens. Also bind tokens to this
    # action and our approved hostnames; a boolean success alone is insufficient.
    if (
        result.get("success") is not True
        or result.get("action") != "solve"
        or result.get("hostname") not in TURNSTILE_ALLOWED_HOSTNAMES
    ):
        raise HTTPException(status_code=403, detail="Browser verification expired or failed. Please try again.")
