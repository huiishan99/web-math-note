from unittest import TestCase
from unittest.mock import Mock, patch

import httpx
from fastapi import HTTPException

from apps.calculator.turnstile import verify_human


class TurnstileTest(TestCase):
    def setUp(self):
        self.settings = patch.multiple(
            "apps.calculator.turnstile",
            TURNSTILE_REQUIRED=True,
            TURNSTILE_SECRET_KEY="test-only-secret",
            TURNSTILE_ALLOWED_HOSTNAMES=["math-notes-clone.vercel.app"],
        )
        self.settings.start()
        self.addCleanup(self.settings.stop)

    def response(self, **overrides):
        response = Mock()
        response.json.return_value = {
            "success": True, "action": "solve", "hostname": "math-notes-clone.vercel.app", **overrides,
        }
        return response

    def test_accepts_valid_bound_token(self):
        with patch("apps.calculator.turnstile.httpx.post", return_value=self.response()) as post:
            verify_human("one-use-token")
        self.assertEqual(post.call_args.kwargs["data"]["response"], "one-use-token")
        self.assertFalse(post.call_args.kwargs["follow_redirects"])
        self.assertNotIn("remoteip", post.call_args.kwargs["data"])

    def test_rejects_missing_token_without_outbound_request(self):
        with patch("apps.calculator.turnstile.httpx.post") as post:
            with self.assertRaises(HTTPException) as error:
                verify_human(None)
        self.assertEqual(error.exception.status_code, 403)
        post.assert_not_called()

    def test_fails_closed_without_secret(self):
        with patch("apps.calculator.turnstile.TURNSTILE_SECRET_KEY", ""):
            with self.assertRaises(HTTPException) as error:
                verify_human("token")
        self.assertEqual(error.exception.status_code, 503)

    def test_fails_closed_without_hostname(self):
        with patch("apps.calculator.turnstile.TURNSTILE_ALLOWED_HOSTNAMES", []):
            with self.assertRaises(HTTPException) as error:
                verify_human("token")
        self.assertEqual(error.exception.status_code, 503)

    def test_rejects_replayed_expired_wrong_action_and_wrong_hostname(self):
        for overrides in [
            {"success": False, "error-codes": ["timeout-or-duplicate"]},
            {"action": "login"},
            {"hostname": "attacker.example"},
            {"success": "true"},
        ]:
            with self.subTest(overrides=overrides):
                with patch("apps.calculator.turnstile.httpx.post", return_value=self.response(**overrides)):
                    with self.assertRaises(HTTPException) as error:
                        verify_human("token")
                self.assertEqual(error.exception.status_code, 403)

    def test_fails_closed_when_cloudflare_is_unavailable(self):
        with patch("apps.calculator.turnstile.httpx.post", side_effect=httpx.TimeoutException("timeout")):
            with self.assertRaises(HTTPException) as error:
                verify_human("token")
        self.assertEqual(error.exception.status_code, 503)

    def test_development_without_credentials_needs_no_challenge(self):
        with patch.multiple("apps.calculator.turnstile", TURNSTILE_REQUIRED=False, TURNSTILE_SECRET_KEY=""):
            verify_human(None)
