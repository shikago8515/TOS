import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import system_config_api


class FakeObjectResponse:
    def __init__(self, content: bytes) -> None:
        self.content = content
        self.closed = False

    def stream(self, chunk_size: int):
        for index in range(0, len(self.content), chunk_size):
            yield self.content[index:index + chunk_size]

    def close(self) -> None:
        self.closed = True


class SystemConfigApiTest(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(system_config_api.router, prefix="/api")
        self.client = TestClient(app)

    def test_tos_desktop_download_streams_installer(self) -> None:
        requested_keys: list[str] = []

        def fake_get_object(_bucket: str, object_key: str) -> FakeObjectResponse:
            requested_keys.append(object_key)
            if object_key == "tos-desktop/TOS-Desktop-Setup.exe":
                return FakeObjectResponse(b"MZ installer bytes")
            raise FileNotFoundError(object_key)

        with patch.object(system_config_api, "get_minio_bucket", return_value="tos-downloads"), \
             patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "get_object_response", side_effect=fake_get_object):
            response = self.client.get("/api/system/config/tos-desktop/download")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"MZ installer bytes")
        self.assertIn("TOS-Desktop-Setup.exe", response.headers["content-disposition"])
        self.assertEqual(requested_keys, ["tos-desktop/TOS-Desktop-Setup.exe"])

    def test_tos_desktop_payload_streams_latest_payload(self) -> None:
        def fake_get_object(_bucket: str, object_key: str) -> FakeObjectResponse:
            if object_key == "tos-desktop/TOS-Desktop-Payload.zip":
                return FakeObjectResponse(b"PK payload bytes")
            raise FileNotFoundError(object_key)

        with patch.object(system_config_api, "get_minio_bucket", return_value="tos-downloads"), \
             patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "get_object_response", side_effect=fake_get_object):
            response = self.client.get("/api/system/config/tos-desktop/payload")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"PK payload bytes")
        self.assertEqual(response.headers["content-type"].split(";")[0], "application/zip")

    def test_tos_desktop_versioned_payload_rejects_unsafe_sha(self) -> None:
        with patch.object(system_config_api, "get_object_response") as get_object_response:
            response = self.client.get("/api/system/config/tos-desktop/payload/not-a-sha")

        self.assertEqual(response.status_code, 400)
        get_object_response.assert_not_called()

    def test_tos_desktop_versioned_payload_streams_sha_payload(self) -> None:
        sha = "a" * 64

        def fake_get_object(_bucket: str, object_key: str) -> FakeObjectResponse:
            expected_key = f"tos-desktop/payloads/{sha}/TOS-Desktop-Payload.zip"
            if object_key == expected_key:
                return FakeObjectResponse(b"PK versioned payload bytes")
            raise FileNotFoundError(object_key)

        with patch.object(system_config_api, "get_minio_bucket", return_value="tos-downloads"), \
             patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "get_object_response", side_effect=fake_get_object):
            response = self.client.get(f"/api/system/config/tos-desktop/payload/{sha}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"PK versioned payload bytes")


if __name__ == "__main__":
    unittest.main()
