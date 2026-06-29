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
        connect_timeout=int(config["connect_timeout"]),
        read_timeout=int(config["read_timeout"]),
        write_timeout=int(config["write_timeout"]),
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
        "connect_timeout": int(mysql.get("connect_timeout", 8)),
        "read_timeout": int(mysql.get("read_timeout", 15)),
        "write_timeout": int(mysql.get("write_timeout", 15)),
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


def list_automation_credentials(automation_id: str) -> list[dict[str, Any]]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, automation_id, account_key, username, created_at, updated_at
                FROM automation_credentials
                WHERE automation_id = %s
                ORDER BY updated_at DESC, account_key ASC
                """,
                (automation_id,),
            )
            rows = cursor.fetchall()
    return rows or []


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


def list_excel_templates(
    module_id: str | None = None,
    *,
    include_inactive: bool = False,
    limit: int = 500,
) -> list[dict[str, Any]]:
    ensure_schema()
    safe_limit = max(1, min(int(limit or 500), 1000))
    conditions: list[str] = []
    params: list[Any] = []
    if module_id:
        conditions.append("module_id = %s")
        params.append(module_id)
    if not include_inactive:
        conditions.append("is_active = 1")
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.append(safe_limit)
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT id, module_id, template_key, display_name, bucket, object_key,
                       original_filename, content_type, file_size, sha256,
                       is_active, created_at, updated_at
                FROM excel_templates
                {where_clause}
                ORDER BY module_id ASC, display_name ASC, id ASC
                LIMIT %s
                """,
                tuple(params),
            )
            rows = cursor.fetchall()
    return rows or []


def get_excel_template(template_id: int, *, include_inactive: bool = False) -> dict[str, Any] | None:
    ensure_schema()
    active_clause = "" if include_inactive else "AND is_active = 1"
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT id, module_id, template_key, display_name, bucket, object_key,
                       original_filename, content_type, file_size, sha256,
                       is_active, created_at, updated_at
                FROM excel_templates
                WHERE id = %s {active_clause}
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
                       is_active, created_at, updated_at
                FROM excel_templates
                WHERE module_id = %s AND template_key = %s
                LIMIT 1
                """,
                (template["module_id"], template["template_key"]),
            )
            row = cursor.fetchone()
        connection.commit()
    return row or {}


def update_excel_template(template_id: int, updates: dict[str, Any]) -> dict[str, Any] | None:
    ensure_schema()
    allowed_fields = {
        "module_id": "module_id",
        "template_key": "template_key",
        "display_name": "display_name",
        "is_active": "is_active",
    }
    assignments: list[str] = []
    params: list[Any] = []
    for key, column in allowed_fields.items():
        if key not in updates:
            continue
        assignments.append(f"{column} = %s")
        params.append(updates[key])

    if not assignments:
        return get_excel_template(template_id, include_inactive=True)

    assignments.append("updated_at = CURRENT_TIMESTAMP")
    params.append(template_id)
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE excel_templates
                SET {', '.join(assignments)}
                WHERE id = %s
                """,
                tuple(params),
            )
        connection.commit()
    return get_excel_template(template_id, include_inactive=True)


def delete_excel_template(template_id: int) -> bool:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE excel_templates
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (template_id,),
            )
            deleted = cursor.rowcount > 0
        connection.commit()
    return deleted


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


def list_automation_runs(
    automation_id: str | None = None,
    limit: int = 30,
    *,
    module_id: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    offset: int = 0,
) -> list[dict[str, Any]]:
    ensure_schema()
    safe_limit = max(1, min(int(limit or 30), 300))
    safe_offset = max(0, int(offset or 0))
    where_clause, params = _build_automation_run_filters(
        automation_id=automation_id,
        module_id=module_id,
        status=status,
        keyword=keyword,
    )
    params.extend([safe_limit, safe_offset])
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT run_id, automation_id, module_id, run_name, status, message,
                       result_json, started_at, finished_at, created_at, updated_at
                FROM automation_runs
                {where_clause}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params),
            )
            rows = cursor.fetchall()
    return rows or []


def count_automation_runs(
    automation_id: str | None = None,
    *,
    module_id: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
) -> int:
    ensure_schema()
    where_clause, params = _build_automation_run_filters(
        automation_id=automation_id,
        module_id=module_id,
        status=status,
        keyword=keyword,
    )
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM automation_runs
                {where_clause}
                """,
                tuple(params),
            )
            row = cursor.fetchone() or {}
    return int(row.get("total") or 0)


def _build_automation_run_filters(
    *,
    automation_id: str | None = None,
    module_id: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
) -> tuple[str, list[Any]]:
    conditions: list[str] = []
    params: list[Any] = []
    if automation_id:
        conditions.append("automation_id = %s")
        params.append(automation_id)
    if module_id:
        conditions.append("module_id = %s")
        params.append(module_id)
    if status:
        conditions.append("status = %s")
        params.append(status)
    if keyword:
        pattern = f"%{keyword}%"
        conditions.append("(run_id LIKE %s OR run_name LIKE %s OR message LIKE %s)")
        params.extend([pattern, pattern, pattern])
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return where_clause, params


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


def insert_excel_upload_backup(backup: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO excel_upload_backups
                  (request_id, module_id, file_role, bucket, object_key,
                   original_filename, content_type, file_size, sha256)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    backup["request_id"],
                    backup["module_id"],
                    backup["file_role"],
                    backup["bucket"],
                    backup["object_key"],
                    backup.get("original_filename", ""),
                    backup.get("content_type", ""),
                    backup.get("file_size", 0),
                    backup.get("sha256", ""),
                ),
            )
            backup_id = cursor.lastrowid
            cursor.execute(
                """
                SELECT id, request_id, module_id, file_role, bucket, object_key,
                       original_filename, content_type, file_size, sha256, created_at
                FROM excel_upload_backups
                WHERE id = %s
                LIMIT 1
                """,
                (backup_id,),
            )
            row = cursor.fetchone()
        connection.commit()
    return row or {}


def list_automation_run_files(run_id: str) -> list[dict[str, Any]]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, run_id, file_role, bucket, object_key, original_filename,
                       content_type, file_size, sha256, created_at
                FROM automation_run_files
                WHERE run_id = %s
                ORDER BY created_at ASC, id ASC
                """,
                (run_id,),
            )
            rows = cursor.fetchall()
    return rows or []


def get_automation_run_file(file_id: int) -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
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
    return row


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
                WHERE NOT (
                  record_key LIKE 'git-%%'
                  AND title = 'chore: 同步版本更新缓存'
                )
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


def get_latest_release_announcement() -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, notice_id, version, release_date, show_popup, level,
                       title, groups_json, created_by, created_at, updated_at
                FROM release_announcements
                ORDER BY release_date DESC, id DESC
                LIMIT 1
                """,
            )
            row = cursor.fetchone()
    return row


def get_release_announcement(notice_id: str) -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, notice_id, version, release_date, show_popup, level,
                       title, groups_json, created_by, created_at, updated_at
                FROM release_announcements
                WHERE notice_id = %s
                LIMIT 1
                """,
                (notice_id,),
            )
            row = cursor.fetchone()
    return row


def upsert_release_announcement(announcement: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    groups_json = json.dumps(announcement.get("groups") or [], ensure_ascii=False)
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO release_announcements
                  (notice_id, version, release_date, show_popup, level,
                   title, groups_json, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  version = VALUES(version),
                  release_date = VALUES(release_date),
                  show_popup = VALUES(show_popup),
                  level = VALUES(level),
                  title = VALUES(title),
                  groups_json = VALUES(groups_json),
                  created_by = VALUES(created_by)
                """,
                (
                    announcement["notice_id"],
                    announcement["version"],
                    announcement.get("release_date"),
                    1 if announcement.get("show_popup") else 0,
                    announcement.get("level", "info"),
                    announcement["title"],
                    groups_json,
                    announcement.get("created_by", "release"),
                ),
            )
        connection.commit()
    return get_release_announcement(announcement["notice_id"]) or {}


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
    CREATE TABLE IF NOT EXISTS excel_upload_backups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id VARCHAR(96) NOT NULL,
      module_id VARCHAR(128) NOT NULL,
      file_role VARCHAR(64) NOT NULL,
      bucket VARCHAR(128) NOT NULL,
      object_key VARCHAR(512) NOT NULL,
      original_filename VARCHAR(255) NOT NULL DEFAULT '',
      content_type VARCHAR(128) NOT NULL DEFAULT '',
      file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
      sha256 CHAR(64) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_excel_upload_backups_request (request_id),
      KEY idx_excel_upload_backups_module_created (module_id, created_at),
      KEY idx_excel_upload_backups_sha256 (sha256)
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
    """
    CREATE TABLE IF NOT EXISTS release_announcements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      notice_id VARCHAR(160) NOT NULL,
      version VARCHAR(64) NOT NULL,
      release_date DATE NULL,
      show_popup TINYINT(1) NOT NULL DEFAULT 0,
      level VARCHAR(32) NOT NULL DEFAULT 'info',
      title VARCHAR(255) NOT NULL,
      groups_json JSON NOT NULL,
      created_by VARCHAR(96) NOT NULL DEFAULT 'release',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_release_announcements_notice_id (notice_id),
      KEY idx_release_announcements_latest (release_date, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
]
