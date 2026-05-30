import base64
import asyncio
from io import BytesIO
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from PIL import Image

from apps.calculator.route import _decode_image_payload, run
from schema import CalculateRequest, CalculationItem


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


if __name__ == "__main__":
    unittest.main()
