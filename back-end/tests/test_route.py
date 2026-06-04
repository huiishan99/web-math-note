import base64
import asyncio
from io import BytesIO
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from PIL import Image

from apps.calculator.route import _decode_image_payload, router, run
from schema import CalculateRequest, CalculationItem


def make_test_client():
    app = FastAPI()
    app.include_router(router, prefix="/calculate")
    return TestClient(app)


def make_image_data_url(size=(4, 4)):
    image = Image.new("RGB", size, "white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


class CalculateRouteTest(unittest.TestCase):
    def test_rejects_non_data_url_images(self):
        with self.assertRaises(HTTPException) as error:
            _decode_image_payload("not-an-image")

        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("data URL", error.exception.detail)

    def test_rejects_oversized_images(self):
        with patch("apps.calculator.route.MAX_IMAGE_BYTES", 8):
            with self.assertRaises(HTTPException) as error:
                _decode_image_payload(make_image_data_url())

        self.assertEqual(error.exception.status_code, 413)

    def test_rejects_unknown_solver_modes(self):
        with self.assertRaises(ValidationError):
            CalculateRequest(image=make_image_data_url(), mode="verbose")

    def test_calls_solver_for_valid_images(self):
        solver_response = [CalculationItem(expr="1 + 1", result="2", assign=False, steps=[])]
        with patch("apps.calculator.route.analyze_image", return_value=solver_response) as analyze_image:
            response = asyncio.run(run(CalculateRequest(image=make_image_data_url(), mode="quick")))

        self.assertEqual(response.data[0].result, "2")
        analyze_image.assert_called_once()

    def test_endpoint_rejects_missing_access_token_when_configured(self):
        client = make_test_client()

        with patch("apps.calculator.security.BACKEND_ACCESS_TOKEN", "secret"):
            response = client.post(
                "/calculate",
                json={"image": make_image_data_url(), "dict_of_vars": {}, "mode": "quick"},
            )

        self.assertEqual(response.status_code, 401)

    def test_endpoint_accepts_configured_access_token(self):
        client = make_test_client()
        solver_response = [CalculationItem(expr="1 + 1", result="2", assign=False, steps=[])]

        with patch("apps.calculator.security.BACKEND_ACCESS_TOKEN", "secret"):
            with patch("apps.calculator.security.RATE_LIMIT_MAX_REQUESTS", 0):
                with patch("apps.calculator.route.analyze_image", return_value=solver_response):
                    response = client.post(
                        "/calculate",
                        json={"image": make_image_data_url(), "dict_of_vars": {}, "mode": "quick"},
                        headers={"Authorization": "Bearer secret"},
                    )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"][0]["result"], "2")


if __name__ == "__main__":
    unittest.main()
