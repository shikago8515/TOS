from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from utils.settings import BACKEND_ROOT, get_settings


CREDENTIAL_KEY_FILE_ENV = "TOS_CREDENTIAL_KEY_FILE"
CREDENTIAL_KEY_ENV = "TOS_CREDENTIAL_KEY"
DEFAULT_CREDENTIAL_KEY_PATH = BACKEND_ROOT / "config" / "credential.key"


def encrypt_secret(value: str) -> str:
    return _get_fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    try:
        return _get_fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Automation credential cannot be decrypted with the current credential key.") from exc


def _get_fernet() -> Fernet:
    return Fernet(_resolve_credential_key())


def _resolve_credential_key() -> bytes:
    env_key = os.environ.get(CREDENTIAL_KEY_ENV)
    if env_key:
        return _normalize_key(env_key)

    if os.environ.get(CREDENTIAL_KEY_FILE_ENV):
        return _read_or_create_key_file(_resolve_key_path())

    settings = get_settings()
    configured_key = (
        settings.get("security", {})
        .get("credential_key", "")
    )
    if configured_key:
        return _normalize_key(str(configured_key))

    return _read_or_create_key_file(_resolve_key_path())


def _read_or_create_key_file(key_path: Path) -> bytes:
    if key_path.exists():
        return _normalize_key(key_path.read_text(encoding="utf-8").strip())

    key = Fernet.generate_key()
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.write_text(key.decode("ascii") + "\n", encoding="utf-8")
    return key


def _resolve_key_path() -> Path:
    configured_path = os.environ.get(CREDENTIAL_KEY_FILE_ENV)
    if not configured_path:
        return DEFAULT_CREDENTIAL_KEY_PATH

    path = Path(configured_path)
    if not path.is_absolute():
        path = BACKEND_ROOT / path
    return path


def _normalize_key(value: str) -> bytes:
    raw = value.strip()
    if not raw:
        raise ValueError("Automation credential key is empty.")
    return raw.encode("ascii")
