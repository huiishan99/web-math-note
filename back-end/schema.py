from typing import Any

from pydantic import BaseModel, Field


class CalculateRequest(BaseModel):
    image: str
    dict_of_vars: dict[str, Any] = Field(default_factory=dict)


class CalculationItem(BaseModel):
    expr: str
    result: Any
    assign: bool = False
    steps: list[str] = Field(default_factory=list)


class CalculateResponse(BaseModel):
    message: str = "Image processed"
    data: list[CalculationItem]
    status: str = "success"


class SolverStatusResponse(BaseModel):
    provider: str
    model: str
    configured: bool


ImageData = CalculateRequest
