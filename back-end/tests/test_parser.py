import unittest

from apps.calculator.parser import SolverResponseError, parse_solver_response


class SolverResponseParserTest(unittest.TestCase):
    def test_parses_wrapped_items_payload(self):
        items = parse_solver_response(
            '{"items":[{"expr":"1 + 1","result":"2","assign":false,"steps":[]}]}'
        )

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].expr, "1 + 1")
        self.assertEqual(items[0].result, "2")
        self.assertFalse(items[0].assign)

    def test_strips_markdown_code_fences(self):
        items = parse_solver_response(
            '```json\n{"items":[{"expr":"x","result":"4","assign":true,"steps":"Given"}]}\n```'
        )

        self.assertEqual(items[0].expr, "x")
        self.assertEqual(items[0].steps, ["Given"])
        self.assertTrue(items[0].assign)

    def test_rejects_unusable_payloads(self):
        with self.assertRaises(SolverResponseError):
            parse_solver_response('{"items":[{"expr":"1 + 1"}]}')


if __name__ == "__main__":
    unittest.main()
