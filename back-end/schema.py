from typing import Any, Literal, Union

from pydantic import BaseModel, Field

VariableValue = Union[str, int, float, bool, None]


class CalculateRequest(BaseModel):
    image: str = Field(min_length=1)
    dict_of_vars: dict[str, VariableValue] = Field(default_factory=dict)
    mode: Literal["quick", "explain"] = "quick"


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
