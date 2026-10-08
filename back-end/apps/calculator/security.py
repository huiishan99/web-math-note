from __future__ import annotations

from collections import deque
import hmac
from threading import Lock
import time
from typing import Annotated

from fastapi import Header, HTTPException, Request

from constants import (
    BACKEND_ACCESS_TOKEN,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
    TRUST_PROXY_HEADERS,
    VERCEL_DEPLOYMENT,
)


class InMemoryRateLimiter:
    def __init__(self):
        self._requests: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        if max_requests <= 0 or window_seconds <= 0:
            return True, 0

        now = time.monotonic()
        window_start = now - window_seconds

        with self._lock:
            request_times = self._requests.setdefault(key, deque())
            while request_times and request_times[0] <= window_start:
                request_times.popleft()

            if len(request_times) >= max_requests:
                retry_after = int(max(1, window_seconds - (now - request_times[0])))
                return False, retry_after

            request_times.append(now)
            return True, 0

    def clear(self) -> None:
        with self._lock:
            self._requests.clear()


calculator_rate_limiter = InMemoryRateLimiter()


def require_access_token(authorization: Annotated[str | None, Header()] = None) -> None:
    if not BACKEND_ACCESS_TOKEN:
        return

    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(token, BACKEND_ACCESS_TOKEN):
        raise HTTPException(status_code=401, detail="Missing or invalid access token.")


def enforce_calculate_rate_limit(request: Request) -> None:
    allowed, retry_after = calculator_rate_limiter.allow(
        _client_key(request),
        RATE_LIMIT_MAX_REQUESTS,
        RATE_LIMIT_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many calculation requests. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def _client_key(request: Request) -> str:
    if VERCEL_DEPLOYMENT:
        # Vercel overwrites this header at its trusted edge. Never use a
        # user-controlled forwarded header on a standalone deployment.
        forwarded_for = request.headers.get("x-vercel-forwarded-for", "")
        return forwarded_for.split(",", 1)[0].strip() or "unknown"
    if TRUST_PROXY_HEADERS:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",", 1)[0].strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown"
