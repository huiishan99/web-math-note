from fastapi import APIRouter
import base64
import binascii
from io import BytesIO
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
from schema import CalculateRequest, CalculateResponse, SolverStatusResponse

router = APIRouter()


@router.get("/status", response_model=SolverStatusResponse)
async def status():
    return get_solver_status()


@router.post("", response_model=CalculateResponse)
async def run(data: CalculateRequest):
    try:
        _, encoded_image = data.image.split(",", 1)
        image_data = base64.b64decode(encoded_image)
        image = Image.open(BytesIO(image_data))
    except (ValueError, binascii.Error, UnidentifiedImageError) as exc:
        raise HTTPException(status_code=400, detail="Invalid image payload.") from exc

    try:
        responses = analyze_image(image, dict_of_vars=data.dict_of_vars)
    except SolverConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SolverProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except SolverResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return CalculateResponse(data=responses)
