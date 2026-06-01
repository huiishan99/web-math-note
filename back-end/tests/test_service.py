from types import SimpleNamespace
import unittest
from unittest.mock import patch

from PIL import Image

from apps.calculator.service import VisionSolverService, _solver_thinking_config, get_solver_status


class FakeModels:
    def __init__(self):
        self.request = None

    def generate_content(self, **kwargs):
        self.request = kwargs
        return SimpleNamespace(
            text='{"items":[{"expr":"1 + 1","result":"2","assign":false,"steps":[]}]}'
        )


class FakeClient:
    def __init__(self):
        self.models = FakeModels()
        self.closed = False

    def close(self):
        self.closed = True


class VisionSolverServiceTest(unittest.TestCase):
    def test_reports_google_genai_provider(self):
        status = get_solver_status()

        self.assertEqual(status.provider, "google-genai")

    def test_disables_thinking_for_flash_models(self):
        config = _solver_thinking_config("gemini-2.5-flash")

        self.assertIsNotNone(config)
        self.assertEqual(config.thinking_budget, 0)
        self.assertIsNone(_solver_thinking_config("gemini-2.5-pro"))

    def test_builds_google_genai_generate_content_request(self):
        fake_client = FakeClient()
        image = Image.new("RGB", (8, 8), "white")

        with patch("apps.calculator.service.genai.Client", return_value=fake_client):
            with patch("apps.calculator.service.SOLVER_TIMEOUT_SECONDS", 12):
                service = VisionSolverService(api_key="test-key", model_name="gemini-2.5-flash")
                items = service.analyze_image(image, {}, mode="quick")

        request = fake_client.models.request
        config = request["config"]

        self.assertEqual(items[0].result, "2")
        self.assertEqual(request["model"], "gemini-2.5-flash")
        self.assertEqual(len(request["contents"]), 2)
        self.assertEqual(config.response_mime_type, "application/json")
        self.assertEqual(config.http_options.timeout, 12000)
        self.assertEqual(config.thinking_config.thinking_budget, 0)

        service.close()
        self.assertTrue(fake_client.closed)


if __name__ == "__main__":
    unittest.main()
