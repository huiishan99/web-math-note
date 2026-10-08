from fastapi import APIRouter, Depends
import base64
import binascii
from io import BytesIO
import logging
import re
import warnings
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from PIL import Image
from PIL import UnidentifiedImageError

from apps.calculator.parser import SolverResponseError
from apps.calculator.service import (
    SolverConfigurationError,
    SolverProviderError,
    analyze_image,
    get_solver_status,
)
from apps.calculator.security import enforce_calculate_rate_limit, require_access_token
from apps.calculator.turnstile import verify_human
from constants import MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS
from schema import CalculateRequest, CalculateResponse, SolverStatusResponse

router = APIRouter()
logger = logging.getLogger(__name__)
IMAGE_DATA_URL_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,", re.IGNORECASE)
MIME_IMAGE_FORMATS = {"png": "PNG", "jpeg": "JPEG", "jpg": "JPEG", "webp": "WEBP"}


def _matches_image_signature(image_data: bytes, image_format: str) -> bool:
    if image_format == "PNG":
        return image_data.startswith(b"\x89PNG\r\n\x1a\n")
    if image_format == "JPEG":
        return image_data.startswith(b"\xff\xd8\xff")
    if image_format == "WEBP":
        return image_data.startswith(b"RIFF") and image_data[8:12] == b"WEBP"
    return False


def _decode_image_payload(image_payload: str) -> Image.Image:
    match = IMAGE_DATA_URL_RE.match(image_payload)
    if not match:
        raise HTTPException(status_code=400, detail="Image payload must be a PNG, JPEG, or WebP data URL.")

    encoded_image = image_payload[match.end():]
    estimated_bytes = (len(encoded_image) * 3) // 4
    if estimated_bytes > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image payload is too large.")

    try:
        image_data = base64.b64decode(encoded_image, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Invalid image payload.") from exc

    if len(image_data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image payload is too large.")

    expected_format = MIME_IMAGE_FORMATS[match.group(1).lower()]
    if not _matches_image_signature(image_data, expected_format):
        # Reject unsupported or mislabeled bytes before any Pillow parser runs.
        raise HTTPException(status_code=400, detail="Image content does not match its declared type.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            # Narrow parser selection to the declared, signature-checked format.
            # Image.open() with no formats restriction can invoke EPS/JPEG2000
            # parsers before the application has a chance to reject the file.
            with Image.open(BytesIO(image_data), formats=[expected_format]) as image:
                if image.format != expected_format:
                    raise HTTPException(status_code=400, detail="Image content does not match its declared type.")
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(status_code=413, detail="Image dimensions are too large.")
                image.verify()

            # verify() consumes the input; reopen through the same restricted
            # parser to decode, then return an independent RGB image.
            with Image.open(BytesIO(image_data), formats=[expected_format]) as image:
                image.load()
                return image.convert("RGB")
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(status_code=413, detail="Image dimensions are too large.") from exc
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        raise HTTPException(status_code=400, detail="Invalid image payload.") from exc


@router.get("/status", response_model=SolverStatusResponse)
async def status():
    return get_solver_status()


@router.post(
    "",
    dependencies=[Depends(require_access_token), Depends(enforce_calculate_rate_limit)],
    response_model=CalculateResponse,
)
async def run(data: CalculateRequest):
    await run_in_threadpool(verify_human, data.turnstile_token)
    image = _decode_image_payload(data.image)

    try:
        responses = await run_in_threadpool(analyze_image, image, dict_of_vars=data.dict_of_vars, mode=data.mode)
    except SolverConfigurationError as exc:
        logger.warning("Solver is not configured")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SolverProviderError as exc:
        logger.warning("Solver provider failed")
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except SolverResponseError as exc:
        logger.warning("Solver returned an unusable response")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return CalculateResponse(data=responses)
