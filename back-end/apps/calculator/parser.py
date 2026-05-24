from __future__ import annotations

import ast
import json
from typing import Any

from schema import CalculationItem


class SolverResponseError(ValueError):
    pass


def parse_solver_response(raw_text: str) -> list[CalculationItem]:
    payload = _decode_payload(_strip_code_fences(raw_text))
    entries = _extract_entries(payload)
    items = [_normalize_entry(entry) for entry in entries]
    items = [item for item in items if item is not None]

    if not items:
        raise SolverResponseError("The solver response did not contain any usable results.")

    return items


def _decode_payload(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    try:
        return ast.literal_eval(text)
    except (ValueError, SyntaxError) as exc:
        raise SolverResponseError("Could not parse the solver response as JSON.") from exc


def _extract_entries(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        for key in ("items", "data", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
        return [payload]

    raise SolverResponseError("The solver response must be a JSON object or list.")


def _normalize_entry(entry: Any) -> CalculationItem | None:
    if not isinstance(entry, dict):
        return None

    expr = entry.get("expr", entry.get("expression"))
    result = entry.get("result", entry.get("answer"))

    if expr is None or result is None:
        return None

    steps = entry.get("steps", [])
    if isinstance(steps, str):
        steps = [steps]
    if not isinstance(steps, list):
        steps = []

    return CalculationItem(
        expr=str(expr),
        result=result,
        assign=bool(entry.get("assign", False)),
        steps=[str(step) for step in steps],
    )


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if not text.startswith("```"):
        return text

    lines = text.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]

    return "\n".join(lines).strip()
