"""Offline decoder regressions; no network, model calls, or DoS payloads."""

import base64
import asyncio
from io import BytesIO
import unittest
from unittest.mock import MagicMock, patch
import warnings

from fastapi import HTTPException
from PIL import Image, features

from apps.calculator.route import _decode_image_payload, run
from schema import CalculateRequest


def encode_image(image_format="PNG", size=(8, 8)):
    with Image.new("RGB", size, "white") as image:
        output = BytesIO()
        image.save(output, format=image_format)
        return output.getvalue()


def data_url(data: bytes, mime="png"):
    return f"data:image/{mime};base64,{base64.b64encode(data).decode('ascii')}"


class ImageValidationTest(unittest.TestCase):
    def assert_rejected(self, payload, status=400):
        with self.assertRaises(HTTPException) as error:
            _decode_image_payload(payload)
        self.assertEqual(error.exception.status_code, status)

    def test_valid_png_jpeg_jpg_alias_and_webp(self):
        for image_format, mime in [("PNG", "png"), ("JPEG", "jpeg"), ("JPEG", "jpg"), ("WEBP", "webp"), ("PNG", "PNG")]:
            with self.subTest(image_format=image_format, mime=mime):
                with _decode_image_payload(data_url(encode_image(image_format), mime)) as image:
                    self.assertEqual(image.mode, "RGB")
                    self.assertEqual(image.size, (8, 8))
                    self.assertEqual(image.getpixel((0, 0)), (255, 255, 255))

    def test_all_supported_format_mislabels_are_rejected_before_pillow(self):
        for image_format, actual_mime in [("PNG", "png"), ("JPEG", "jpeg"), ("WEBP", "webp")]:
            image_data = encode_image(image_format)
            for declared_mime in {"png", "jpeg", "webp"} - {actual_mime}:
                with self.subTest(actual=image_format, declared=declared_mime):
                    with patch("apps.calculator.route.Image.open") as image_open:
                        self.assert_rejected(data_url(image_data, declared_mime))
                    image_open.assert_not_called()

    def test_gif_and_eps_labeled_png_are_rejected_before_pillow(self):
        for image_format in ["GIF", "EPS"]:
            image_data = encode_image(image_format)
            with self.subTest(image_format=image_format):
                with patch("apps.calculator.route.Image.open") as image_open:
                    self.assert_rejected(data_url(image_data))
                image_open.assert_not_called()

    @unittest.skipUnless(features.check("jpg_2000"), "Pillow wheel has no JPEG2000 encoder")
    def test_valid_jpeg2000_labeled_png_is_rejected_before_pillow(self):
        image_data = encode_image("JPEG2000")
        with patch("apps.calculator.route.Image.open") as image_open:
            self.assert_rejected(data_url(image_data))
        image_open.assert_not_called()

    def test_jpeg2000_signature_is_rejected_even_without_optional_codec(self):
        # Box signature only, not an exploit or oversized image.
        with patch("apps.calculator.route.Image.open") as image_open:
            self.assert_rejected(data_url(b"\x00\x00\x00\x0cjP  \r\n\x87\n"))
        image_open.assert_not_called()

    def test_unsupported_data_url_type_is_rejected_before_pillow(self):
        with patch("apps.calculator.route.Image.open") as image_open:
            self.assert_rejected(data_url(b"GIF89a", "gif"))
        image_open.assert_not_called()

    def test_invalid_base64_is_rejected_before_pillow(self):
        with patch("apps.calculator.route.Image.open") as image_open:
            self.assert_rejected("data:image/png;base64,%%%not-base64%%")
        image_open.assert_not_called()

    def test_truncated_png_jpeg_and_webp_are_rejected(self):
        for image_format, mime in [("PNG", "png"), ("JPEG", "jpeg"), ("WEBP", "webp")]:
            image_data = encode_image(image_format)
            with self.subTest(image_format=image_format):
                self.assert_rejected(data_url(image_data[:-16], mime))

    def test_bytes_limit_is_enforced_before_pillow(self):
        image_data = encode_image()
        with patch("apps.calculator.route.MAX_IMAGE_BYTES", 8):
            with patch("apps.calculator.route.Image.open") as image_open:
                self.assert_rejected(data_url(image_data), 413)
        image_open.assert_not_called()

    def test_pixel_limit_is_enforced_before_verify_or_load(self):
        image_data = encode_image(size=(8, 8))
        with patch("apps.calculator.route.MAX_IMAGE_PIXELS", 63):
            with patch("PIL.PngImagePlugin.PngImageFile.load") as image_load:
                with patch("PIL.PngImagePlugin.PngImageFile.verify") as image_verify:
                    self.assert_rejected(data_url(image_data), 413)
        image_load.assert_not_called()
        image_verify.assert_not_called()

    def test_invalid_images_never_reach_solver(self):
        payloads = [data_url(encode_image("GIF")), data_url(encode_image("PNG")[:-16])]
        for payload in payloads:
            with patch("apps.calculator.route.verify_human"):
                with patch("apps.calculator.route.analyze_image") as solver:
                    with self.assertRaises(HTTPException) as error:
                        asyncio.run(run(CalculateRequest(image=payload)))
            self.assertEqual(error.exception.status_code, 400)
            solver.assert_not_called()

    def test_exact_pixel_limit_is_accepted(self):
        with patch("apps.calculator.route.MAX_IMAGE_PIXELS", 64):
            with _decode_image_payload(data_url(encode_image())) as image:
                self.assertEqual(image.size, (8, 8))

    def test_each_open_uses_only_the_expected_parser(self):
        image_data = encode_image()
        original_open = Image.open
        with patch("apps.calculator.route.Image.open", wraps=original_open) as image_open:
            with _decode_image_payload(data_url(image_data)):
                pass
        self.assertEqual(image_open.call_count, 2)
        for call in image_open.call_args_list:
            self.assertEqual(call.kwargs["formats"], ["PNG"])

    def test_actual_pillow_format_is_checked_before_decode(self):
        image = MagicMock()
        image.format = "GIF"
        image.__enter__.return_value = image
        with patch("apps.calculator.route.Image.open", return_value=image):
            self.assert_rejected(data_url(b"\x89PNG\r\n\x1a\n"))
        image.load.assert_not_called()
        image.verify.assert_not_called()

    def test_decompression_warning_fails_closed_without_decode(self):
        def warned_open(*args, **kwargs):
            warnings.warn("test oversized dimensions", Image.DecompressionBombWarning)
        with patch("apps.calculator.route.Image.open", side_effect=warned_open):
            self.assert_rejected(data_url(b"\x89PNG\r\n\x1a\n"), 413)
