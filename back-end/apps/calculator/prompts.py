import json
from typing import Any


def build_solver_prompt(dict_of_vars: dict[str, Any]) -> str:
    dict_of_vars_str = json.dumps(dict_of_vars, ensure_ascii=False)

    return (
        "You are reading a user-drawn math whiteboard image. Solve the expression, "
        "equation, graph problem, or visual word problem in the image.\n\n"
        "Use standard order of operations: parentheses, exponents, multiplication "
        "and division from left to right, then addition and subtraction from left "
        "to right.\n\n"
        "Exactly one of these cases applies:\n"
        "1. Simple mathematical expressions such as 2 + 2 or 3 * 4.\n"
        "2. One or more equations where variables should be solved.\n"
        "3. Variable assignments such as x = 4 or y = 5.\n"
        "4. Graphical math problems, including geometry, trigonometry, physics-style "
        "drawings, or color-coded visual problems.\n"
        "5. Abstract drawings that represent a concept.\n\n"
        "Use this dictionary of previously assigned variables whenever relevant: "
        f"{dict_of_vars_str}\n\n"
        "Return strict JSON only. Do not include markdown, backticks, comments, or "
        "extra text. The JSON must match this shape:\n"
        "{"
        '"items": ['
        "{"
        '"expr": "the recognized expression, variable, or drawing explanation", '
        '"result": "the final answer", '
        '"assign": false, '
        '"steps": ["short step 1", "short step 2"]'
        "}"
        "]"
        "}\n\n"
        "Set assign to true only when the item stores or solves a variable value. "
        "Keep result concise, but include useful steps when there is a real derivation."
    )
