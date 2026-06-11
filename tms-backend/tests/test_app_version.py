import unittest

from app_version import APP_VERSION
from main import app, root


class AppVersionTest(unittest.IsolatedAsyncioTestCase):
    async def test_root_and_fastapi_metadata_use_shared_app_version(self) -> None:
        self.assertEqual(app.version, APP_VERSION)
        payload = await root()
        self.assertEqual(payload["version"], APP_VERSION)


if __name__ == "__main__":
    unittest.main()
