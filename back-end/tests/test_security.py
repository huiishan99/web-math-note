from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from apps.calculator.security import (
    InMemoryRateLimiter,
    calculator_rate_limiter,
    enforce_calculate_rate_limit,
    require_access_token,
)


def make_request(host="127.0.0.1", headers=None):
    return SimpleNamespace(
        client=SimpleNamespace(host=host),
        headers=headers or {},
    )


class CalculatorSecurityTest(unittest.TestCase):
    def tearDown(self):
        calculator_rate_limiter.clear()

    def test_access_token_is_optional_for_local_development(self):
        with patch("apps.calculator.security.BACKEND_ACCESS_TOKEN", None):
            require_access_token()

    def test_rejects_missing_access_token_when_configured(self):
        with patch("apps.calculator.security.BACKEND_ACCESS_TOKEN", "secret"):
            with self.assertRaises(HTTPException) as error:
                require_access_token(None)

        self.assertEqual(error.exception.status_code, 401)

    def test_accepts_matching_bearer_access_token(self):
        with patch("apps.calculator.security.BACKEND_ACCESS_TOKEN", "secret"):
            require_access_token("Bearer secret")

    def test_rate_limits_by_client_address(self):
        request = make_request(host="203.0.113.10")

        with patch("apps.calculator.security.RATE_LIMIT_MAX_REQUESTS", 2):
            with patch("apps.calculator.security.RATE_LIMIT_WINDOW_SECONDS", 60):
                enforce_calculate_rate_limit(request)
                enforce_calculate_rate_limit(request)

                with self.assertRaises(HTTPException) as error:
                    enforce_calculate_rate_limit(request)

        self.assertEqual(error.exception.status_code, 429)
        self.assertGreaterEqual(int(error.exception.headers["Retry-After"]), 1)
        self.assertLessEqual(int(error.exception.headers["Retry-After"]), 60)

    def test_rate_limiter_can_be_disabled(self):
        limiter = InMemoryRateLimiter()

        for _ in range(10):
            allowed, retry_after = limiter.allow("client", 0, 60)

        self.assertTrue(allowed)
        self.assertEqual(retry_after, 0)


if __name__ == "__main__":
    unittest.main()
