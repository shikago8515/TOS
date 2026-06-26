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

    def test_config_summary_returns_typed_response(self) -> None:
        with patch.object(
            system_config_api,
            "resolve_settings_path",
            return_value="D:/project/TOS-main/tms-backend/config/settings.yaml",
        ), patch.object(
            system_config_api,
            "get_settings_summary",
            return_value={"downloads": {"tos_desktop": {"bucket": "downloads"}}},
        ):
            response = self.client.get("/api/system/config/summary")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "settingsFile": "D:/project/TOS-main/tms-backend/config/settings.yaml",
                "settings": {"downloads": {"tos_desktop": {"bucket": "downloads"}}},
            },
        )

    def test_openapi_exposes_summary_schema_and_download_media_types(self) -> None:
        paths = self.client.app.openapi()["paths"]

        summary_schema = paths["/api/system/config/summary"]["get"]["responses"]["200"][
            "content"
        ]["application/json"]["schema"]
        self.assertIn("$ref", summary_schema)

        self.assertIn(
            system_config_api.TOS_DESKTOP_CONTENT_TYPE,
            paths["/api/system/config/tos-desktop/download"]["get"]["responses"]["200"]["content"],
        )
        self.assertIn(
            system_config_api.TOS_DESKTOP_FULL_CONTENT_TYPE,
            paths["/api/system/config/tos-desktop-full/download"]["get"]["responses"]["200"]["content"],
        )
        self.assertIn(
            system_config_api.TOS_DESKTOP_PAYLOAD_CONTENT_TYPE,
            paths["/api/system/config/tos-desktop/payload/{payload_sha256}"]["get"][
                "responses"
            ]["200"]["content"],
        )
        self.assertIn(
            system_config_api.HELPER_CONTENT_TYPE,
            paths["/api/system/config/automation-helper/download"]["get"]["responses"]["200"][
                "content"
            ],
        )
        self.assertIn(
            system_config_api.HELPER_PAYLOAD_CONTENT_TYPE,
            paths["/api/system/config/automation-helper/payload/{payload_sha256}"]["get"][
                "responses"
            ]["200"]["content"],
        )
        self.assertIn(
            "$ref",
            paths["/api/system/config/installer-versions"]["get"]["responses"]["200"][
                "content"
            ]["application/json"]["schema"],
        )
        self.assertIn(
            "$ref",
            paths["/api/system/config/automation-modules"]["get"]["responses"]["200"][
                "content"
            ]["application/json"]["schema"],
        )
        self.assertIn(
            system_config_api.AUTOMATION_MODULE_CONTENT_TYPE,
            paths["/api/system/config/automation-modules/{module_id}/download"]["get"][
                "responses"
            ]["200"]["content"],
        )

    def test_installer_versions_returns_minio_manifest_versions(self) -> None:
        manifest = {
            "kind": "tos-installer-manifest",
            "appVersion": "0.9.8-beta.3.20",
            "updatedAt": "2026-06-18T02:00:00Z",
            "packages": {
                "automation-helper": {
                    "label": "TOS Web Automation Helper",
                    "version": "0.9.8-beta.3.20",
                    "filename": "TOS-Automation-Helper-Setup.0.9.8-beta.3.20.exe",
                    "downloadPath": "/api/system/config/automation-helper/download",
                    "bucket": "tos-downloads",
                    "objectKey": "automation-helper/TOS-Automation-Helper-Setup.exe",
                    "contentType": system_config_api.HELPER_CONTENT_TYPE,
                    "fileSize": 90617,
                    "sha256": "a" * 64,
                }
            },
        }

        with patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "get_minio_bucket", return_value="tos-downloads"), \
             patch.object(system_config_api, "read_installer_manifest", return_value=manifest):
            response = self.client.get("/api/system/config/installer-versions")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["manifestUpdatedAt"], "2026-06-18T02:00:00Z")
        packages = {package["id"]: package for package in payload["packages"]}
        self.assertEqual(packages["automation-helper"]["version"], "0.9.8-beta.3.20")
        self.assertEqual(packages["automation-helper"]["source"], "manifest")
        self.assertEqual(packages["automation-helper"]["fileSize"], 90617)

    def test_installer_versions_falls_back_to_current_version_without_manifest(self) -> None:
        with patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "get_minio_bucket", return_value="tos-downloads"), \
             patch.object(
                 system_config_api,
                 "read_installer_manifest",
                 return_value={"packages": {}, "updatedAt": None},
             ):
            response = self.client.get("/api/system/config/installer-versions")

        self.assertEqual(response.status_code, 200)
        packages = {package["id"]: package for package in response.json()["packages"]}
        self.assertEqual(packages["automation-helper"]["version"], system_config_api.APP_VERSION)
        self.assertEqual(packages["tos-desktop"]["version"], system_config_api.APP_VERSION)
        self.assertEqual(packages["tos-desktop-full"]["version"], system_config_api.APP_VERSION)

    def test_automation_modules_returns_minio_manifest_modules(self) -> None:
        manifest = {
            "kind": "tos-automation-module-manifest",
            "version": "0.9.8-beta.3.29",
            "updatedAt": "2026-06-26T02:00:00Z",
            "modules": {
                "shipping-automation-demo": {
                    "name": "Shipping Automation Demo",
                    "provider": "Playwright",
                    "version": "0.9.8-beta.3.29",
                    "requiredHelperVersion": "0.9.8-beta.3.28",
                    "appDir": "shipping-automation-demo",
                    "entry": "bin/start.js",
                    "defaultPort": 3003,
                    "filename": "shipping-automation-demo.0.9.8-beta.3.29.zip",
                    "objectKey": "automation-modules/shipping-automation-demo/shipping.zip",
                    "sha256": "b" * 64,
                }
            },
        }

        with patch.object(system_config_api, "get_minio_bucket", return_value="tos-downloads"), \
             patch.object(system_config_api, "read_automation_module_manifest", return_value=manifest):
            response = self.client.get("/api/system/config/automation-modules")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["manifestUpdatedAt"], "2026-06-26T02:00:00Z")
        modules = {module["id"]: module for module in payload["modules"]}
        module = modules["shipping-automation-demo"]
        self.assertEqual(module["version"], "0.9.8-beta.3.29")
        self.assertEqual(module["requiredHelperVersion"], "0.9.8-beta.3.28")
        self.assertEqual(
            module["downloadPath"],
            "/api/system/config/automation-modules/shipping-automation-demo/download",
        )

    def test_automation_module_download_streams_module_package(self) -> None:
        requested_keys: list[str] = []
        manifest = {
            "modules": {
                "shipping-automation-demo": {
                    "version": "0.9.8-beta.3.29",
                    "filename": "shipping-automation-demo.0.9.8-beta.3.29.zip",
                    "bucket": "tos-downloads",
                    "objectKey": "automation-modules/shipping-automation-demo/shipping.zip",
                }
            }
        }

        def fake_get_object(_bucket: str, object_key: str) -> FakeObjectResponse:
            requested_keys.append(object_key)
            if object_key == "automation-modules/shipping-automation-demo/shipping.zip":
                return FakeObjectResponse(b"PK module bytes")
            raise FileNotFoundError(object_key)

        with patch.object(system_config_api, "read_automation_module_manifest", return_value=manifest), \
             patch.object(system_config_api, "get_object_response", side_effect=fake_get_object):
            response = self.client.get(
                "/api/system/config/automation-modules/shipping-automation-demo/download"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"PK module bytes")
        self.assertEqual(requested_keys, ["automation-modules/shipping-automation-demo/shipping.zip"])

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
        self.assertIn(
            f"TOS-Desktop-Setup.{system_config_api.APP_VERSION}.exe",
            response.headers["content-disposition"],
        )
        self.assertEqual(requested_keys, ["tos-desktop/TOS-Desktop-Setup.exe"])

    def test_automation_helper_download_uses_manifest_filename_for_stable_object(self) -> None:
        requested_keys: list[str] = []
        manifest_filename = "TOS-Automation-Helper-Setup.0.9.8-beta.3.20.exe"

        def fake_get_object(_bucket: str, object_key: str) -> FakeObjectResponse:
            requested_keys.append(object_key)
            if object_key == "automation-helper/TOS-Automation-Helper-Setup.exe":
                return FakeObjectResponse(b"MZ helper installer bytes")
            raise FileNotFoundError(object_key)

        manifest = {
            "packages": {
                "automation-helper": {
                    "version": "0.9.8-beta.3.20",
                    "filename": manifest_filename,
                    "objectKey": "automation-helper/TOS-Automation-Helper-Setup.exe",
                }
            }
        }

        with patch.object(system_config_api, "get_minio_bucket", return_value="tos-downloads"), \
             patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "read_installer_manifest", return_value=manifest), \
             patch.object(system_config_api, "get_object_response", side_effect=fake_get_object):
            response = self.client.get("/api/system/config/automation-helper/download")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"MZ helper installer bytes")
        self.assertIn(manifest_filename, response.headers["content-disposition"])
        self.assertEqual(requested_keys, ["automation-helper/TOS-Automation-Helper-Setup.exe"])

    def test_tos_desktop_full_download_streams_embedded_installer(self) -> None:
        requested_keys: list[str] = []

        def fake_get_object(_bucket: str, object_key: str) -> FakeObjectResponse:
            requested_keys.append(object_key)
            if object_key == "tos-desktop-full/TOS-Desktop-Full-Setup.exe":
                return FakeObjectResponse(b"MZ full installer bytes")
            raise FileNotFoundError(object_key)

        with patch.object(system_config_api, "get_minio_bucket", return_value="tos-downloads"), \
             patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "get_object_response", side_effect=fake_get_object):
            response = self.client.get("/api/system/config/tos-desktop-full/download")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"MZ full installer bytes")
        self.assertIn(
            f"TOS-Desktop-Full-Setup.{system_config_api.APP_VERSION}.exe",
            response.headers["content-disposition"],
        )
        self.assertEqual(requested_keys, ["tos-desktop-full/TOS-Desktop-Full-Setup.exe"])

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

    def test_po_auto_download_template_status_reports_available_object(self) -> None:
        with patch.object(system_config_api, "get_minio_bucket", return_value="tos-templates"), \
             patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "object_exists", return_value=True) as object_exists:
            response = self.client.get("/api/system/config/po-auto-download/template/status")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["available"])
        self.assertEqual(payload["bucket"], "tos-templates")
        self.assertEqual(payload["objectKey"], system_config_api.PO_AUTO_DOWNLOAD_TEMPLATE_DEFAULT_OBJECT_KEY)
        object_exists.assert_called_once_with(
            "tos-templates",
            system_config_api.PO_AUTO_DOWNLOAD_TEMPLATE_DEFAULT_OBJECT_KEY,
        )

    def test_po_auto_download_template_status_reports_missing_object_without_404(self) -> None:
        with patch.object(system_config_api, "get_minio_bucket", return_value="tos-templates"), \
             patch.object(system_config_api, "get_settings", return_value={}), \
             patch.object(system_config_api, "object_exists", return_value=False):
            response = self.client.get("/api/system/config/po-auto-download/template/status")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["available"])
        self.assertIn("MinIO", payload["message"])


if __name__ == "__main__":
    unittest.main()
