import math
import unittest
from pydantic import ValidationError
from schema import CalculateRequest


class RequestSchemaTest(unittest.TestCase):
    def test_rejects_numeric_strings_over_string_limit(self):
        with self.assertRaises(ValidationError):
            CalculateRequest(image="test", dict_of_vars={"x": "1" * 1000})

    def test_rejects_huge_and_nonfinite_numbers(self):
        for value in [10**3999, 10**16, float("inf"), float("-inf"), float("nan")]:
            with self.subTest(value_type=type(value).__name__):
                with self.assertRaises(ValidationError):
                    CalculateRequest(image="test", dict_of_vars={"x": value})

    def test_limits_total_utf8_variable_context(self):
        with self.assertRaises(ValidationError):
            CalculateRequest(image="test", dict_of_vars={str(i): "字" * 256 for i in range(32)})

    def test_preserves_ordinary_typed_values(self):
        values = {"text": "x+1", "integer": 2, "decimal": 3.14, "boolean": True, "empty": None}
        request = CalculateRequest(image="test", dict_of_vars=values)
        self.assertEqual(request.dict_of_vars, values)
