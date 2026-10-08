from typing import Annotated, Any, Literal, Union
import json

from pydantic import BaseModel, Field, field_validator

VariableValue = Union[
    Annotated[str, Field(strict=True, max_length=256)],
    Annotated[int, Field(strict=True, ge=-10**15, le=10**15)],
    Annotated[float, Field(strict=True, allow_inf_nan=False, ge=-10**15, le=10**15)],
    Annotated[bool, Field(strict=True)],
    None,
]


class CalculateRequest(BaseModel):
    image: str = Field(min_length=1, max_length=4 * 1024 * 1024 + 64)
    dict_of_vars: dict[Annotated[str, Field(max_length=64)], VariableValue] = Field(default_factory=dict, max_length=32)
    mode: Literal["quick", "explain"] = "quick"
    turnstile_token: str | None = Field(default=None, max_length=2048)

    @field_validator("dict_of_vars", mode="before")
    @classmethod
    def bound_variable_context(cls, value):
        if len(json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")) > 16_384:
            raise ValueError("Variable context is too large.")
        return value


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
    human_verification_required: bool = False
    human_verification_configured: bool = False


ImageData = CalculateRequest
