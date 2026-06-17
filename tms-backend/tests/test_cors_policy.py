import os
import sys
import unittest

from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from main import app, resolve_cors_allow_origins


class CorsPolicyTests(unittest.TestCase):
    def test_default_cors_allows_local_frontend_origin(self):
        client = TestClient(app)

        response = client.options(
            "/",
            headers={
                "Origin": "http://127.0.0.1:5174",
                "Access-Control-Request-Method": "GET",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "http://127.0.0.1:5174",
        )
        self.assertEqual(response.headers.get("access-control-allow-credentials"), "true")

    def test_default_cors_rejects_unlisted_browser_origin(self):
        client = TestClient(app)

        response = client.options(
            "/",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )

        self.assertNotEqual(response.headers.get("access-control-allow-origin"), "https://evil.example")

    def test_cors_origins_can_be_overridden_by_environment_value(self):
        self.assertEqual(
            resolve_cors_allow_origins("https://tos.example.com, http://localhost:5174 ,,"),
            ["https://tos.example.com", "http://localhost:5174"],
        )


if __name__ == "__main__":
    unittest.main()
