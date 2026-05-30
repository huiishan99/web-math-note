from fastapi import APIRouter
import base64
import binascii
from io import BytesIO
import logging
import re
from fastapi import HTTPException
from PIL import Image
from PIL import UnidentifiedImageError

from apps.calculator.parser import SolverResponseError
from apps.calculator.service import (
    SolverConfigurationError,
    SolverProviderError,
    analyze_image,
    get_solver_status,
)
from constants import MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS
from schema import CalculateRequest, CalculateResponse, SolverStatusResponse

router = APIRouter()
logger = logging.getLogger(__name__)
IMAGE_DATA_URL_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,", re.IGNORECASE)


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

    try:
        image = Image.open(BytesIO(image_data))
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="Invalid image payload.") from exc

    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=413, detail="Image dimensions are too large.")

    return image.convert("RGB")


@router.get("/status", response_model=SolverStatusResponse)
async def status():
    return get_solver_status()


@router.post("", response_model=CalculateResponse)
async def run(data: CalculateRequest):
    image = _decode_image_payload(data.image)

    try:
        responses = analyze_image(image, dict_of_vars=data.dict_of_vars, mode=data.mode)
    except SolverConfigurationError as exc:
        logger.warning("Solver is not configured")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SolverProviderError as exc:
        logger.warning("Solver provider failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except SolverResponseError as exc:
        logger.warning("Solver returned an unusable response")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return CalculateResponse(data=responses)
