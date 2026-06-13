from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

import yaml


BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SETTINGS_PATH = BACKEND_ROOT / "config" / "settings.yaml"
EXAMPLE_SETTINGS_PATH = BACKEND_ROOT / "config" / "settings.example.yaml"
SETTINGS_FILE_ENV = "TOS_SETTINGS_FILE"

_settings_cache: dict[str, Any] | None = None


def get_settings(*, reload: bool = False) -> dict[str, Any]:
    global _settings_cache

    if _settings_cache is not None and not reload:
        return copy.deepcopy(_settings_cache)

    path = resolve_settings_path()
    data = read_yaml_file(path)
    apply_environment_overrides(data)
    _settings_cache = data
    return copy.deepcopy(data)


def get_settings_summary() -> dict[str, Any]:
    settings = get_settings()
    return mask_sensitive_values(settings)


def resolve_settings_path() -> Path:
    configured_path = os.environ.get(SETTINGS_FILE_ENV)
    if configured_path:
        path = Path(configured_path)
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        return path

    if DEFAULT_SETTINGS_PATH.exists():
        return DEFAULT_SETTINGS_PATH
    return EXAMPLE_SETTINGS_PATH


def read_yaml_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"TOS settings file not found: {path}")

    with path.open("r", encoding="utf-8") as file:
        payload = yaml.safe_load(file) or {}

    if not isinstance(payload, dict):
        raise ValueError(f"TOS settings file must contain a mapping object: {path}")

    return payload


def apply_environment_overrides(settings: dict[str, Any]) -> None:
    env_map = {
        "TOS_MYSQL_HOST": ("database", "mysql", "host"),
        "TOS_MYSQL_PORT": ("database", "mysql", "port"),
        "TOS_MYSQL_DATABASE": ("database", "mysql", "database"),
        "TOS_MYSQL_USERNAME": ("database", "mysql", "username"),
        "TOS_MYSQL_PASSWORD": ("database", "mysql", "password"),
        "TOS_MINIO_ENDPOINT": ("storage", "minio", "endpoint"),
        "TOS_MINIO_ACCESS_KEY": ("storage", "minio", "access_key"),
        "TOS_MINIO_SECRET_KEY": ("storage", "minio", "secret_key"),
        "TOS_MINIO_SECURE": ("storage", "minio", "secure"),
        "TOS_REDIS_HOST": ("redis", "host"),
        "TOS_REDIS_PORT": ("redis", "port"),
        "TOS_REDIS_DB": ("redis", "db"),
    }

    for env_name, path in env_map.items():
        raw_value = os.environ.get(env_name)
        if raw_value is None:
            continue
        set_nested_value(settings, path, coerce_env_value(raw_value))


def set_nested_value(settings: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    current = settings
    for key in path[:-1]:
        next_value = current.get(key)
        if not isinstance(next_value, dict):
            next_value = {}
            current[key] = next_value
        current = next_value
    current[path[-1]] = value


def coerce_env_value(value: str) -> Any:
    lowered = value.strip().lower()
    if lowered in {"true", "false"}:
        return lowered == "true"
    if lowered.isdigit():
        return int(lowered)
    return value


def mask_sensitive_values(value: Any) -> Any:
    if isinstance(value, dict):
        masked: dict[str, Any] = {}
        for key, nested_value in value.items():
            if is_sensitive_key(key):
                masked[key] = mask_secret(nested_value)
            else:
                masked[key] = mask_sensitive_values(nested_value)
        return masked

    if isinstance(value, list):
        return [mask_sensitive_values(item) for item in value]

    return value


def is_sensitive_key(key: str) -> bool:
    lowered = key.lower()
    return any(token in lowered for token in ("password", "secret", "token", "access_key", "credential_key"))


def mask_secret(value: Any) -> str:
    if value in (None, ""):
        return ""
    text = str(value)
    if len(text) <= 4:
        return "****"
    return f"{text[:2]}****{text[-2:]}"
