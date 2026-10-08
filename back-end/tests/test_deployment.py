import asyncio
import base64
from io import BytesIO
import unittest
import tomllib
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from apps.calculator.body_limit import RequestBodyLimitMiddleware
from apps.calculator.service import SolverProviderError
from apps.calculator.security import _client_key
from main import app
from schema import CalculationItem
from test_route import make_image_data_url
from test_security import make_request


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_hosted_dependencies_match_local_backend(self):
        root = Path(__file__).resolve().parents[2]
        project = tomllib.loads((root / "pyproject.toml").read_text())["project"]
        requirements = (root / "back-end/requirements.txt").read_text().splitlines()
        self.assertEqual(sorted(project["dependencies"]), sorted(requirements))

    def test_health_and_solver_status_are_same_origin_api_routes(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        status = self.client.get("/api/calculate/status")
        self.assertEqual(status.status_code, 200)
        self.assertIn("configured", status.json())
        self.assertNotIn("GEMINI_API_KEY", status.text)

    def test_same_origin_and_legacy_calculation_routes(self):
        for path in ["/api/calculate", "/calculate"]:
            with self.subTest(path=path):
                with patch("apps.calculator.route.analyze_image", return_value=[CalculationItem(expr="1+1", result=2)]):
                    response = self.client.post(path, json={"image": make_image_data_url()})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["data"][0]["result"], 2)

    def test_bot_rejected_before_model_is_called(self):
        with patch("apps.calculator.route.verify_human", side_effect=HTTPException(403, "Rejected")):
            with patch("apps.calculator.route.analyze_image") as model:
                response = self.client.post("/api/calculate", json={"image": make_image_data_url()})
        self.assertEqual(response.status_code, 403)
        model.assert_not_called()

    def test_free_provider_quota_exhaustion_is_429(self):
        with patch("apps.calculator.route.analyze_image", side_effect=SolverProviderError("Free quota exhausted", 429)):
            response = self.client.post("/api/calculate", json={"image": make_image_data_url()})
        self.assertEqual(response.status_code, 429)

    def test_rejects_oversized_json_before_model_call(self):
        with patch("apps.calculator.route.analyze_image") as model:
            response = self.client.post("/api/calculate", content=b"x" * 4_300_001)
        self.assertEqual(response.status_code, 413)
        model.assert_not_called()

    def test_rejects_excessive_variable_context(self):
        response = self.client.post("/api/calculate", json={"image": make_image_data_url(), "dict_of_vars": {str(i): i for i in range(33)}})
        self.assertEqual(response.status_code, 422)

    def test_nonfinite_json_is_rejected_without_echoing_input(self):
        with patch("apps.calculator.route.analyze_image") as model:
            response = self.client.post(
                "/api/calculate",
                content='{"image":"private-drawing","dict_of_vars":{"x":NaN},"turnstile_token":"private-token"}',
                headers={"Content-Type": "application/json"},
            )
        self.assertEqual(response.status_code, 422)
        self.assertNotIn("private-drawing", response.text)
        self.assertNotIn("private-token", response.text)
        model.assert_not_called()

    def test_vercel_uses_edge_overwritten_client_header(self):
        with patch("apps.calculator.security.VERCEL_DEPLOYMENT", True):
            request = make_request(headers={"x-vercel-forwarded-for": "203.0.113.4", "x-forwarded-for": "spoofed"})
            self.assertEqual(_client_key(request), "203.0.113.4")

    def test_chunked_body_cannot_bypass_request_limit(self):
        calls = []
        async def inner(*args):
            calls.append("inner")
        messages = iter([
            {"type": "http.request", "body": b"123", "more_body": True},
            {"type": "http.request", "body": b"456", "more_body": False},
        ])
        sent = []
        async def receive():
            return next(messages)
        async def send(message):
            sent.append(message)
        asyncio.run(RequestBodyLimitMiddleware(inner, 5)({"type": "http", "method": "POST", "headers": []}, receive, send))
        self.assertEqual(sent[0]["status"], 413)
        self.assertEqual(calls, [])
