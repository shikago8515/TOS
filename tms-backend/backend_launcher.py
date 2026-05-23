import os

import uvicorn

from main import app


def main() -> None:
    host = os.environ.get("TOS_BACKEND_HOST", "127.0.0.1")
    port = int(os.environ.get("TOS_BACKEND_PORT", "8000"))

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        access_log=False,
    )


if __name__ == "__main__":
    main()
