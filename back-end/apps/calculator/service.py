from __future__ import annotations

from functools import lru_cache
from io import BytesIO
import logging

from google import genai
from google.genai import types
from PIL import Image

from apps.calculator.parser import SolverResponseError, parse_solver_response
from apps.calculator.prompts import build_solver_prompt
from constants import (
    GEMINI_API_KEY, GEMINI_MODEL, SOLVER_TIMEOUT_SECONDS,
    TURNSTILE_REQUIRED, TURNSTILE_SECRET_KEY, TURNSTILE_ALLOWED_HOSTNAMES,
)
from schema import CalculationItem, SolverStatusResponse

logger = logging.getLogger(__name__)


class SolverConfigurationError(RuntimeError):
    pass


class SolverProviderError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def get_solver_status() -> SolverStatusResponse:
    return SolverStatusResponse(
        provider="google-genai",
        model=GEMINI_MODEL,
        configured=bool(GEMINI_API_KEY),
        human_verification_required=TURNSTILE_REQUIRED or bool(TURNSTILE_SECRET_KEY),
        human_verification_configured=bool(TURNSTILE_SECRET_KEY and TURNSTILE_ALLOWED_HOSTNAMES),
    )


class VisionSolverService:
    def __init__(self, api_key: str | None = GEMINI_API_KEY, model_name: str = GEMINI_MODEL):
        if not api_key:
            raise SolverConfigurationError(
                "AI solver is not configured. Set GEMINI_API_KEY in the backend environment before running calculations."
            )

        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    def analyze_image(self, img: Image.Image, dict_of_vars: dict, mode: str = "quick") -> list[CalculationItem]:
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[
                    types.Part.from_text(text=build_solver_prompt(dict_of_vars, mode)),
                    _image_to_part(img),
                ],
                config=types.GenerateContentConfig(
                    http_options=types.HttpOptions(
                        timeout=SOLVER_TIMEOUT_SECONDS * 1000,
                        retry_options=types.HttpRetryOptions(attempts=1),
                    ),
                    response_mime_type="application/json",
                    temperature=0,
                    max_output_tokens=2048,
                    thinking_config=_solver_thinking_config(self.model_name),
                ),
            )
        except Exception as exc:
            # Never log raw provider responses, drawings or credential details.
            logger.warning("AI solver request failed (%s)", type(exc).__name__)
            if getattr(exc, "code", None) == 429:
                raise SolverProviderError(
                    "The free AI service is currently busy or its quota is exhausted. Please try again later.",
                    status_code=429,
                ) from exc
            raise SolverProviderError(
                "AI solver request failed. Check whether GEMINI_API_KEY is present, valid, and allowed to call this model."
            ) from exc

        raw_text = getattr(response, "text", "")

        if not raw_text:
            raise SolverResponseError("The solver returned an empty response.")

        return parse_solver_response(raw_text)

    def close(self) -> None:
        self.client.close()


def _image_to_part(img: Image.Image) -> types.Part:
    image_buffer = BytesIO()
    img.save(image_buffer, format="PNG")
    return types.Part.from_bytes(data=image_buffer.getvalue(), mime_type="image/png")


def _solver_thinking_config(model_name: str) -> types.ThinkingConfig | None:
    normalized_model = model_name.lower()
    if normalized_model.startswith(("gemini-2.5-flash", "gemini-2.5-flash-lite")):
        return types.ThinkingConfig(thinking_budget=0)

    return None


@lru_cache(maxsize=1)
def get_solver_service() -> VisionSolverService:
    return VisionSolverService()


def close_solver_service() -> None:
    if get_solver_service.cache_info().currsize == 0:
        return

    get_solver_service().close()
    get_solver_service.cache_clear()


def analyze_image(img: Image.Image, dict_of_vars: dict, mode: str = "quick") -> list[CalculationItem]:
    return get_solver_service().analyze_image(img, dict_of_vars, mode)
