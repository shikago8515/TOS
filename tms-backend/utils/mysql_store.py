from __future__ import annotations

import json
import re
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator

from utils.settings import get_settings


_schema_lock = threading.Lock()
_schema_ready = False
_DEFAULT_DATABASE = object()


def ensure_schema() -> None:
    global _schema_ready

    if _schema_ready:
        return

    with _schema_lock:
        if _schema_ready:
            return
        _create_database_if_needed()
        with mysql_connection() as connection:
            with connection.cursor() as cursor:
                for ddl in SCHEMA_DDL:
                    cursor.execute(ddl)
            connection.commit()
        _schema_ready = True


@contextmanager
def mysql_connection(*, database: str | None | object = _DEFAULT_DATABASE) -> Iterator[Any]:
    pymysql = _import_pymysql()
    config = get_mysql_config()
    selected_database = config["database"] if database is _DEFAULT_DATABASE else database
    connection = pymysql.connect(
        host=config["host"],
        port=int(config["port"]),
        user=config["username"],
        password=config["password"],
        database=selected_database,
        charset=config["charset"],
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        yield connection
    finally:
        connection.close()


def get_mysql_config() -> dict[str, Any]:
    mysql = get_settings().get("database", {}).get("mysql", {})
    return {
        "host": mysql.get("host", "127.0.0.1"),
        "port": int(mysql.get("port", 3306)),
        "database": mysql.get("database", "tos"),
        "username": mysql.get("username", "root"),
        "password": mysql.get("password", ""),
        "charset": mysql.get("charset", "utf8mb4"),
    }


def upsert_automation_credentials(
    automation_id: str,
    account_key: str,
    username: str,
    password_ciphertext: str,
) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO automation_credentials
                  (automation_id, account_key, username, password_ciphertext)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  username = VALUES(username),
                  password_ciphertext = VALUES(password_ciphertext),
                  updated_at = CURRENT_TIMESTAMP
                """,
                (automation_id, account_key, username, password_ciphertext),
            )
        connection.commit()
    return get_automation_credentials(automation_id, account_key) or {}


def get_automation_credentials(automation_id: str, account_key: str = "default") -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, automation_id, account_key, username, password_ciphertext,
                       created_at, updated_at
                FROM automation_credentials
                WHERE automation_id = %s AND account_key = %s
                LIMIT 1
                """,
                (automation_id, account_key),
            )
            row = cursor.fetchone()
    return row


def delete_automation_credentials(automation_id: str, account_key: str = "default") -> bool:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM automation_credentials
                WHERE automation_id = %s AND account_key = %s
                """,
                (automation_id, account_key),
            )
            deleted = cursor.rowcount > 0
        connection.commit()
    return deleted


def list_excel_templates(module_id: str) -> list[dict[str, Any]]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, module_id, template_key, display_name, bucket, object_key,
                       original_filename, content_type, file_size, sha256,
                       created_at, updated_at
                FROM excel_templates
                WHERE module_id = %s AND is_active = 1
                ORDER BY display_name ASC, id ASC
                """,
                (module_id,),
            )
            rows = cursor.fetchall()
    return rows or []


def get_excel_template(template_id: int) -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, module_id, template_key, display_name, bucket, object_key,
                       original_filename, content_type, file_size, sha256,
                       created_at, updated_at
                FROM excel_templates
                WHERE id = %s AND is_active = 1
                LIMIT 1
                """,
                (template_id,),
            )
            row = cursor.fetchone()
    return row


def upsert_excel_template(template: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO excel_templates
                  (module_id, template_key, display_name, bucket, object_key,
                   original_filename, content_type, file_size, sha256, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                ON DUPLICATE KEY UPDATE
                  display_name = VALUES(display_name),
                  bucket = VALUES(bucket),
                  object_key = VALUES(object_key),
                  original_filename = VALUES(original_filename),
                  content_type = VALUES(content_type),
                  file_size = VALUES(file_size),
                  sha256 = VALUES(sha256),
                  is_active = 1,
                  updated_at = CURRENT_TIMESTAMP
                """,
                (
                    template["module_id"],
                    template["template_key"],
                    template["display_name"],
                    template["bucket"],
                    template["object_key"],
                    template.get("original_filename", ""),
                    template.get("content_type", ""),
                    template.get("file_size", 0),
                    template.get("sha256", ""),
                ),
            )
            cursor.execute(
                """
                SELECT id, module_id, template_key, display_name, bucket, object_key,
                       original_filename, content_type, file_size, sha256,
                       created_at, updated_at
                FROM excel_templates
                WHERE module_id = %s AND template_key = %s
                LIMIT 1
                """,
                (template["module_id"], template["template_key"]),
            )
            row = cursor.fetchone()
        connection.commit()
    return row or {}


def create_automation_run(run: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO automation_runs
                  (run_id, automation_id, module_id, run_name, status, message, started_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    run["run_id"],
                    run["automation_id"],
                    run.get("module_id", run["automation_id"]),
                    run.get("run_name", ""),
                    run.get("status", "running"),
                    run.get("message", ""),
                    run.get("started_at"),
                ),
            )
        connection.commit()
    return get_automation_run(run["run_id"]) or {}


def get_automation_run(run_id: str) -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT run_id, automation_id, module_id, run_name, status, message,
                       result_json, started_at, finished_at, created_at, updated_at
                FROM automation_runs
                WHERE run_id = %s
                LIMIT 1
                """,
                (run_id,),
            )
            row = cursor.fetchone()
    return row


def list_automation_runs(automation_id: str | None = None, limit: int = 30) -> list[dict[str, Any]]:
    ensure_schema()
    safe_limit = max(1, min(int(limit or 30), 100))
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            if automation_id:
                cursor.execute(
                    """
                    SELECT run_id, automation_id, module_id, run_name, status, message,
                           result_json, started_at, finished_at, created_at, updated_at
                    FROM automation_runs
                    WHERE automation_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (automation_id, safe_limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT run_id, automation_id, module_id, run_name, status, message,
                           result_json, started_at, finished_at, created_at, updated_at
                    FROM automation_runs
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (safe_limit,),
                )
            rows = cursor.fetchall()
    return rows or []


def update_automation_run(
    run_id: str,
    status: str,
    message: str = "",
    result: Any = None,
    finished_at: datetime | None = None,
) -> dict[str, Any]:
    ensure_schema()
    result_json = json.dumps(result, ensure_ascii=False) if result is not None else None
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE automation_runs
                SET status = %s,
                    message = %s,
                    result_json = %s,
                    finished_at = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE run_id = %s
                """,
                (status, message, result_json, finished_at, run_id),
            )
        connection.commit()
    return get_automation_run(run_id) or {}


def insert_automation_run_file(file_record: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO automation_run_files
                  (run_id, file_role, bucket, object_key, original_filename,
                   content_type, file_size, sha256)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    file_record["run_id"],
                    file_record["file_role"],
                    file_record["bucket"],
                    file_record["object_key"],
                    file_record.get("original_filename", ""),
                    file_record.get("content_type", ""),
                    file_record.get("file_size", 0),
                    file_record.get("sha256", ""),
                ),
            )
            file_id = cursor.lastrowid
            cursor.execute(
                """
                SELECT id, run_id, file_role, bucket, object_key, original_filename,
                       content_type, file_size, sha256, created_at
                FROM automation_run_files
                WHERE id = %s
                LIMIT 1
                """,
                (file_id,),
            )
            row = cursor.fetchone()
        connection.commit()
    return row or {}


def list_release_update_records(limit: int = 100) -> list[dict[str, Any]]:
    ensure_schema()
    safe_limit = max(1, min(int(limit or 100), 300))
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, record_key, version, release_date, category, page_name,
                       page_path, title, description, created_by, created_at, updated_at
                FROM release_update_records
                ORDER BY release_date DESC, id DESC
                """,
            )
            rows = cursor.fetchall()
    # 版本记录量很小，先取全量再按语义版本排序，避免数据库时间排序先 LIMIT 漏掉最新版。
    sorted_rows = sorted(rows or [], key=_release_update_sort_key, reverse=True)
    return sorted_rows[:safe_limit]


def _release_update_sort_key(row: dict[str, Any]) -> tuple[tuple[int, ...], str, int]:
    return (
        _version_sort_key(row.get("version")),
        _date_sort_key(row.get("release_date")),
        int(row.get("id") or 0),
    )


def _version_sort_key(version: Any) -> tuple[int, ...]:
    text = str(version or "").strip().lower().removeprefix("v")
    return tuple(int(part) for part in re.findall(r"\d+", text))


def _date_sort_key(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value or "")


def get_release_update_record(record_key: str) -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, record_key, version, release_date, category, page_name,
                       page_path, title, description, created_by, created_at, updated_at
                FROM release_update_records
                WHERE record_key = %s
                LIMIT 1
                """,
                (record_key,),
            )
            row = cursor.fetchone()
    return row


def insert_release_update_record_once(record: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO release_update_records
                  (record_key, version, release_date, category, page_name,
                   page_path, title, description, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE record_key = record_key
                """,
                (
                    record["record_key"],
                    record["version"],
                    record.get("release_date"),
                    record.get("category", "improved"),
                    record["page_name"],
                    record.get("page_path", ""),
                    record["title"],
                    record.get("description", ""),
                    record.get("created_by", "system"),
                ),
            )
        connection.commit()
    return get_release_update_record(record["record_key"]) or {}


def upsert_release_update_record(record: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO release_update_records
                  (record_key, version, release_date, category, page_name,
                   page_path, title, description, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  version = VALUES(version),
                  release_date = VALUES(release_date),
                  category = VALUES(category),
                  page_name = VALUES(page_name),
                  page_path = VALUES(page_path),
                  title = VALUES(title),
                  description = VALUES(description),
                  created_by = VALUES(created_by)
                """,
                (
                    record["record_key"],
                    record["version"],
                    record.get("release_date"),
                    record.get("category", "improved"),
                    record["page_name"],
                    record.get("page_path", ""),
                    record["title"],
                    record.get("description", ""),
                    record.get("created_by", "manual"),
                ),
            )
        connection.commit()
    return get_release_update_record(record["record_key"]) or {}


def _create_database_if_needed() -> None:
    config = get_mysql_config()
    with mysql_connection(database=None) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{_escape_identifier(config['database'])}` "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        connection.commit()


def _escape_identifier(value: str) -> str:
    return str(value).replace("`", "``")


def _import_pymysql() -> Any:
    try:
        import pymysql
    except ImportError as exc:
        raise RuntimeError("PyMySQL is not installed. Run `pip install -r tms-backend/requirements.txt`.") from exc
    return pymysql


SCHEMA_DDL = [
    """
    CREATE TABLE IF NOT EXISTS automation_credentials (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      automation_id VARCHAR(128) NOT NULL,
      account_key VARCHAR(128) NOT NULL DEFAULT 'default',
      username VARCHAR(255) NOT NULL,
      password_ciphertext TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_automation_credentials (automation_id, account_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS excel_templates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      module_id VARCHAR(128) NOT NULL,
      template_key VARCHAR(128) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      bucket VARCHAR(128) NOT NULL,
      object_key VARCHAR(512) NOT NULL,
      original_filename VARCHAR(255) NOT NULL DEFAULT '',
      content_type VARCHAR(128) NOT NULL DEFAULT '',
      file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
      sha256 CHAR(64) NOT NULL DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_excel_templates (module_id, template_key),
      KEY idx_excel_templates_module (module_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS automation_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      run_id VARCHAR(96) NOT NULL,
      automation_id VARCHAR(128) NOT NULL,
      module_id VARCHAR(128) NOT NULL,
      run_name VARCHAR(255) NOT NULL DEFAULT '',
      status VARCHAR(32) NOT NULL DEFAULT 'running',
      message TEXT NULL,
      result_json LONGTEXT NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_automation_runs_run_id (run_id),
      KEY idx_automation_runs_automation (automation_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS automation_run_files (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      run_id VARCHAR(96) NOT NULL,
      file_role VARCHAR(64) NOT NULL,
      bucket VARCHAR(128) NOT NULL,
      object_key VARCHAR(512) NOT NULL,
      original_filename VARCHAR(255) NOT NULL DEFAULT '',
      content_type VARCHAR(128) NOT NULL DEFAULT '',
      file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
      sha256 CHAR(64) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_automation_run_files_run_id (run_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS release_update_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      record_key VARCHAR(160) NOT NULL,
      version VARCHAR(64) NOT NULL,
      release_date DATE NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'improved',
      page_name VARCHAR(255) NOT NULL,
      page_path VARCHAR(255) NOT NULL DEFAULT '',
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      created_by VARCHAR(96) NOT NULL DEFAULT 'system',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_release_update_record_key (record_key),
      KEY idx_release_update_records_release (release_date, id),
      KEY idx_release_update_records_page (page_path)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
]
