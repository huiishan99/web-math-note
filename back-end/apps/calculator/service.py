from __future__ import annotations

from functools import lru_cache
import logging

from PIL import Image
import google.generativeai as genai

from apps.calculator.parser import SolverResponseError, parse_solver_response
from apps.calculator.prompts import build_solver_prompt
from constants import GEMINI_API_KEY, GEMINI_MODEL, SOLVER_TIMEOUT_SECONDS
from schema import CalculationItem, SolverStatusResponse

logger = logging.getLogger(__name__)


class SolverConfigurationError(RuntimeError):
    pass


class SolverProviderError(RuntimeError):
    pass


def get_solver_status() -> SolverStatusResponse:
    return SolverStatusResponse(
        provider="gemini",
        model=GEMINI_MODEL,
        configured=bool(GEMINI_API_KEY),
    )


class VisionSolverService:
    def __init__(self, api_key: str | None = GEMINI_API_KEY, model_name: str = GEMINI_MODEL):
        if not api_key:
            raise SolverConfigurationError(
                "AI solver is not configured. Add GEMINI_API_KEY to back-end/.env before running calculations."
            )

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name=model_name)

    def analyze_image(self, img: Image.Image, dict_of_vars: dict, mode: str = "quick") -> list[CalculationItem]:
        try:
            response = self.model.generate_content(
                [build_solver_prompt(dict_of_vars, mode), img],
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0,
                    "max_output_tokens": 1024,
                },
                request_options={"timeout": SOLVER_TIMEOUT_SECONDS},
            )
        except Exception as exc:
            logger.exception("AI solver request failed")
            raise SolverProviderError(
                "AI solver request failed. Check whether GEMINI_API_KEY is present, valid, and allowed to call this model."
            ) from exc

        raw_text = getattr(response, "text", "")

        if not raw_text:
            raise SolverResponseError("The solver returned an empty response.")

        return parse_solver_response(raw_text)


@lru_cache(maxsize=1)
def get_solver_service() -> VisionSolverService:
    return VisionSolverService()


def analyze_image(img: Image.Image, dict_of_vars: dict, mode: str = "quick") -> list[CalculationItem]:
    return get_solver_service().analyze_image(img, dict_of_vars, mode)
