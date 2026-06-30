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
                _seed_default_tos_modules(cursor)
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


DEFAULT_TOS_MODULES: tuple[dict[str, Any], ...] = (
    {
        "module_id": "jessca",
        "owner_key": "jessica",
        "owner_name": "Jessica",
        "module_name": "Invoice 核对",
        "module_name_en": "Invoice Compare",
        "module_type": "excel",
        "page_path": "/jessca",
    },
    {
        "module_id": "draft-packing-compare",
        "owner_key": "jessica",
        "owner_name": "Jessica",
        "module_name": "产地证核对",
        "module_name_en": "Certificate of Origin Compare",
        "module_type": "excel",
        "page_path": "/draft-packing-compare",
    },
    {
        "module_id": "shipping-automation",
        "owner_key": "jessica",
        "owner_name": "Jessica",
        "module_name": "万代 Shipping 自动化",
        "module_name_en": "Wandai Shipping Automation",
        "module_type": "browser-automation",
        "page_path": "/web-automation/scenarios/shipping-automation",
    },
    {
        "module_id": "xinlongtai-shipping-automation",
        "owner_key": "jessica",
        "owner_name": "Jessica",
        "module_name": "新龙泰 Shipping 自动化",
        "module_name_en": "Xinlongtai Shipping Automation",
        "module_type": "browser-automation",
        "page_path": "/web-automation/scenarios/xinlongtai-shipping-automation",
    },
    {
        "module_id": "tc-inv-automation",
        "owner_key": "jessica",
        "owner_name": "Jessica",
        "module_name": "TC INV 自动化",
        "module_name_en": "TC INV Automation",
        "module_type": "browser-automation",
        "page_path": "/web-automation/scenarios/tc-inv-automation",
    },
    {
        "module_id": "po-auto-download",
        "owner_key": "jessica",
        "owner_name": "Jessica",
        "module_name": "Invoice 自动下载",
        "module_name_en": "Invoice Auto Download",
        "module_type": "browser-automation",
        "page_path": "/web-automation/scenarios/po-auto-download",
    },
    {
        "module_id": "packing-list-auto-download",
        "owner_key": "jessica",
        "owner_name": "Jessica",
        "module_name": "自动下载箱单",
        "module_name_en": "Packing List Auto Download",
        "module_type": "browser-automation",
        "page_path": "/web-automation/scenarios/packing-list-auto-download",
    },
    {
        "module_id": "sophia-tina",
        "owner_key": "sophia",
        "owner_name": "Sophia",
        "module_name": "报表合并",
        "module_name_en": "Report Merge",
        "module_type": "excel",
        "page_path": "/sophia-tina",
    },
    {
        "module_id": "jane",
        "owner_key": "jane",
        "owner_name": "Jane",
        "module_name": "成品表生成",
        "module_name_en": "Finished Goods Sheet",
        "module_type": "excel",
        "page_path": "/jane",
    },
    {
        "module_id": "jane-bom-summary",
        "owner_key": "jane",
        "owner_name": "Jane",
        "module_name": "BOM 汇总",
        "module_name_en": "BOM Summary",
        "module_type": "excel",
        "page_path": "/jane-bom-summary",
    },
    {
        "module_id": "jane-bom-compare",
        "owner_key": "jane",
        "owner_name": "Jane",
        "module_name": "BOM 核对",
        "module_name_en": "BOM Compare",
        "module_type": "excel",
        "page_path": "/jane-bom-compare",
    },
    {
        "module_id": "jane-outbound-compare",
        "owner_key": "jane",
        "owner_name": "Jane",
        "module_name": "OUTBOUND 核对",
        "module_name_en": "OUTBOUND Compare",
        "module_type": "excel",
        "page_path": "/jane-outbound-compare",
    },
    {
        "module_id": "jane-sap",
        "owner_key": "jane",
        "owner_name": "Jane",
        "module_name": "SAP 自动化",
        "module_name_en": "SAP Automation",
        "module_type": "browser-automation",
        "page_path": "/jane-sap",
    },
    {
        "module_id": "jane-infornexus",
        "owner_key": "jane",
        "owner_name": "Jane",
        "module_name": "Infornexus Released Bulk",
        "module_name_en": "Infornexus Released Bulk",
        "module_type": "browser-automation",
        "page_path": "/jane-infornexus",
    },
    {
        "module_id": "eric",
        "owner_key": "eric",
        "owner_name": "Eric",
        "module_name": "数据处理",
        "module_name_en": "Data Processing",
        "module_type": "excel",
        "page_path": "/eric",
    },
    {
        "module_id": "iplex-dual-table-compare",
        "owner_key": "eric",
        "owner_name": "Eric",
        "module_name": "数据核对",
        "module_name_en": "Data Compare",
        "module_type": "excel",
        "page_path": "/iplex/dual-table-compare",
    },
    {
        "module_id": "eric-infornexus",
        "owner_key": "eric",
        "owner_name": "Eric",
        "module_name": "Infornexus 自动添加",
        "module_name_en": "Infornexus Auto Add",
        "module_type": "browser-automation",
        "page_path": "/eric-infornexus",
    },
    {
        "module_id": "infornexus-auto-add",
        "owner_key": "eric",
        "owner_name": "Eric",
        "module_name": "Infornexus 自动添加",
        "module_name_en": "Infornexus Auto Add",
        "module_type": "browser-automation",
        "page_path": "/eric-infornexus",
    },
    {
        "module_id": "jason-pdf-reorder",
        "owner_key": "jason",
        "owner_name": "Jason",
        "module_name": "发票 PDF 重排序",
        "module_name_en": "Invoice PDF Reorder",
        "module_type": "pdf",
        "page_path": "/jason/pdf-reorder",
    },
    {
        "module_id": "tms-finance-internal-reconciliation",
        "owner_key": "lucia",
        "owner_name": "Lucia",
        "module_name": "内销对账单数据写入",
        "module_name_en": "Internal Reconciliation Data Fill",
        "module_type": "excel",
        "page_path": "/tms-finance-internal-reconciliation",
    },
    {
        "module_id": "tms-finance-work-sales",
        "owner_key": "lucia",
        "owner_name": "Lucia",
        "module_name": "Turnover 数据写入",
        "module_name_en": "Turnover Data Fill",
        "module_type": "excel",
        "page_path": "/tms-finance-work-sales",
    },
    {
        "module_id": "microsoft-login-n8n",
        "owner_key": "general-tools",
        "owner_name": "通用工具",
        "module_name": "Microsoft Login 自动化",
        "module_name_en": "Microsoft Login Automation",
        "module_type": "browser-automation",
        "page_path": "/web-automation/scenarios/microsoft-login-n8n",
    },
    {
        "module_id": "ticket-owner-statistics",
        "owner_key": "general-tools",
        "owner_name": "通用工具",
        "module_name": "统计 Ticket 归属",
        "module_name_en": "Ticket Owner Statistics",
        "module_type": "browser-automation",
        "page_path": "/web-automation/scenarios/ticket-owner-statistics",
    },
    {
        "module_id": "shipping-automation-2",
        "owner_key": "jane",
        "owner_name": "Jane",
        "module_name": "Released Bulk 自动化",
        "module_name_en": "Released Bulk Automation",
        "module_type": "browser-automation",
        "page_path": "/jane-infornexus",
    },
)


def _seed_default_tos_modules(cursor: Any) -> None:
    people: dict[str, dict[str, Any]] = {}
    for index, module in enumerate(DEFAULT_TOS_MODULES, start=1):
        person_id = str(module["owner_key"])
        people.setdefault(person_id, {
            "person_id": person_id,
            "person_name": module["owner_name"],
            "person_name_en": module["owner_name"] if person_id != "general-tools" else "General Tools",
            "sort_order": _person_sort_order(person_id),
        })
        cursor.execute(
            """
            INSERT INTO tos_modules
              (module_id, person_id, module_name, module_name_en, module_type, page_path, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              person_id = VALUES(person_id),
              module_name = VALUES(module_name),
              module_name_en = VALUES(module_name_en),
              module_type = VALUES(module_type),
              page_path = VALUES(page_path),
              sort_order = VALUES(sort_order),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP
            """,
            (
                module["module_id"],
                person_id,
                module["module_name"],
                module["module_name_en"],
                module["module_type"],
                module["page_path"],
                index * 10,
            ),
        )

    for person in people.values():
        cursor.execute(
            """
            INSERT INTO tos_people
              (person_id, person_name, person_name_en, sort_order)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              person_name = VALUES(person_name),
              person_name_en = VALUES(person_name_en),
              sort_order = VALUES(sort_order),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP
            """,
            (
                person["person_id"],
                person["person_name"],
                person["person_name_en"],
                person["sort_order"],
            ),
        )


def get_tos_module(module_id: str) -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT module_id, person_id, module_name, module_name_en, module_type, page_path
                FROM tos_modules
                WHERE module_id = %s AND is_active = 1
                LIMIT 1
                """,
                (module_id,),
            )
            row = cursor.fetchone()
    return row


def _person_sort_order(person_id: str) -> int:
    order = {
        "jessica": 10,
        "sophia": 20,
        "jane": 30,
        "eric": 40,
        "jason": 50,
        "lucia": 60,
        "general-tools": 90,
    }
    return order.get(person_id, 100)


def _owner_key_for_module(module_id: str) -> str:
    for module in DEFAULT_TOS_MODULES:
        if module["module_id"] == module_id:
            return str(module["owner_key"])
    return "general-tools"


def _activity_status_label(status: str) -> str:
    labels = {
        "success": "成功",
        "failed": "失败",
        "error": "失败",
        "running": "执行中",
        "pending": "待确认",
        "canceled": "已取消",
    }
    return labels.get(str(status or "").strip().lower(), "待确认")


def _file_role_label(file_role: str) -> str:
    labels = {
        "source_excel": "源 Excel",
        "result_json": "结果 JSON",
        "result_excel": "结果 Excel",
        "failed_po_excel": "失败明细 Excel",
        "failed_po_json": "失败明细 JSON",
        "result_file": "结果文件",
    }
    return labels.get(str(file_role or ""), str(file_role or "文件"))


def _read_file_name(path: str) -> str:
    normalized = str(path or "").replace("\\", "/")
    return normalized.split("/")[-1] or normalized


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
                INSERT INTO tos_login_accounts
                  (module_id, account_key, username, password_ciphertext)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  username = VALUES(username),
                  password_ciphertext = VALUES(password_ciphertext),
                  is_active = 1,
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
                SELECT account_id AS id, module_id AS automation_id, account_key,
                       username, password_ciphertext,
                       created_at, updated_at
                FROM tos_login_accounts
                WHERE module_id = %s AND account_key = %s AND is_active = 1
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
                SELECT account_id AS id, module_id AS automation_id, account_key,
                       username, created_at, updated_at
                FROM tos_login_accounts
                WHERE module_id = %s AND is_active = 1
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
                UPDATE tos_login_accounts
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE module_id = %s AND account_key = %s
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
                SELECT template_id AS id, module_id, template_key,
                       template_name AS display_name, bucket, object_key,
                       file_name AS original_filename, content_type, file_size, sha256,
                       is_active, created_at, updated_at
                FROM tos_module_templates
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
                SELECT template_id AS id, module_id, template_key,
                       template_name AS display_name, bucket, object_key,
                       file_name AS original_filename, content_type, file_size, sha256,
                       is_active, created_at, updated_at
                FROM tos_module_templates
                WHERE template_id = %s {active_clause}
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
                INSERT INTO tos_module_templates
                  (module_id, template_key, template_name, bucket, object_key,
                   file_name, content_type, file_size, sha256, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                ON DUPLICATE KEY UPDATE
                  template_name = VALUES(template_name),
                  bucket = VALUES(bucket),
                  object_key = VALUES(object_key),
                  file_name = VALUES(file_name),
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
                SELECT template_id AS id, module_id, template_key,
                       template_name AS display_name, bucket, object_key,
                       file_name AS original_filename, content_type, file_size, sha256,
                       is_active, created_at, updated_at
                FROM tos_module_templates
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
        "display_name": "template_name",
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
                UPDATE tos_module_templates
                SET {', '.join(assignments)}
                WHERE template_id = %s
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
                UPDATE tos_module_templates
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE template_id = %s
                """,
                (template_id,),
            )
            deleted = cursor.rowcount > 0
        connection.commit()
    return deleted


def create_automation_run(run: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    module_id = run.get("module_id", run["automation_id"]) or run["automation_id"]
    module = get_tos_module(module_id) or get_tos_module(run["automation_id"]) or {}
    activity_name = run.get("run_name") or module.get("module_name") or run["automation_id"]
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tos_activity_records
                  (activity_id, module_id, person_id, activity_type, activity_name,
                   status, status_label, message, started_at, created_at, source_system)
                VALUES (%s, %s, %s, 'automation', %s, %s, %s, %s, %s, %s, 'web-automation')
                ON DUPLICATE KEY UPDATE
                  module_id = VALUES(module_id),
                  person_id = VALUES(person_id),
                  activity_name = VALUES(activity_name),
                  status = VALUES(status),
                  status_label = VALUES(status_label),
                  message = VALUES(message),
                  started_at = VALUES(started_at),
                  updated_at = CURRENT_TIMESTAMP
                """,
                (
                    run["run_id"],
                    module_id,
                    module.get("person_id") or module.get("owner_key") or _owner_key_for_module(module_id),
                    activity_name,
                    run.get("status", "running"),
                    _activity_status_label(run.get("status", "running")),
                    run.get("message", ""),
                    run.get("started_at"),
                    run.get("started_at") or datetime.utcnow(),
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
                SELECT activity_id AS run_id, module_id AS automation_id, module_id,
                       activity_name AS run_name, status, message,
                       result_json, started_at, finished_at, created_at, updated_at
                FROM tos_activity_records
                WHERE activity_id = %s AND activity_type = 'automation'
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
                SELECT activity_id AS run_id, module_id AS automation_id, module_id,
                       activity_name AS run_name, status, message,
                       result_json, started_at, finished_at, created_at, updated_at
                FROM tos_activity_records
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
                FROM tos_activity_records
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
        conditions.append("module_id = %s")
        params.append(automation_id)
    if module_id:
        conditions.append("module_id = %s")
        params.append(module_id)
    conditions.append("activity_type = 'automation'")
    if status:
        conditions.append("status = %s")
        params.append(status)
    if keyword:
        pattern = f"%{keyword}%"
        conditions.append("(activity_id LIKE %s OR activity_name LIKE %s OR message LIKE %s)")
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
                UPDATE tos_activity_records
                SET status = %s,
                    status_label = %s,
                    message = %s,
                    technical_message = %s,
                    result_json = %s,
                    finished_at = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE activity_id = %s AND activity_type = 'automation'
                """,
                (
                    status,
                    _activity_status_label(status),
                    message,
                    message,
                    result_json,
                    finished_at,
                    run_id,
                ),
            )
        connection.commit()
    return get_automation_run(run_id) or {}


def insert_automation_run_file(file_record: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tos_activity_files
                  (activity_id, file_role, file_role_label, storage_provider,
                   bucket, object_key, file_name,
                   content_type, file_size, sha256)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    file_record["run_id"],
                    file_record["file_role"],
                    _file_role_label(file_record["file_role"]),
                    "minio",
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
                SELECT file_id AS id, activity_id AS run_id, file_role,
                       bucket, object_key, file_name AS original_filename,
                       content_type, file_size, sha256, created_at
                FROM tos_activity_files
                WHERE file_id = %s
                LIMIT 1
                """,
                (file_id,),
            )
            row = cursor.fetchone()
        connection.commit()
    return row or {}


def upsert_process_history_record(record: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    module_id = record["module_id"]
    module = get_tos_module(module_id) or {}
    status = record.get("status", "success")
    output_file = record.get("output_file", "")
    metadata = {
        "inputFiles": record.get("input_files") or [],
        "outputFile": output_file,
        "summary": record.get("summary") or [],
    }
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tos_activity_records
                  (activity_id, module_id, person_id, activity_type, activity_name,
                   status, status_label, message, technical_message, metadata_json,
                   duration_ms, created_at, source_system)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'frontend.process-history')
                ON DUPLICATE KEY UPDATE
                  module_id = VALUES(module_id),
                  person_id = VALUES(person_id),
                  activity_type = VALUES(activity_type),
                  activity_name = VALUES(activity_name),
                  status = VALUES(status),
                  status_label = VALUES(status_label),
                  duration_ms = VALUES(duration_ms),
                  message = VALUES(message),
                  technical_message = VALUES(technical_message),
                  metadata_json = VALUES(metadata_json),
                  created_at = VALUES(created_at),
                  updated_at = CURRENT_TIMESTAMP
                """,
                (
                    record["record_id"],
                    module_id,
                    module.get("person_id") or _owner_key_for_module(module_id),
                    module.get("module_type") or "excel",
                    record.get("module_name") or module.get("module_name") or module_id,
                    status,
                    _activity_status_label(status),
                    record.get("message", ""),
                    record.get("message", ""),
                    json.dumps(metadata, ensure_ascii=False),
                    max(0, int(record.get("duration_ms") or 0)),
                    record.get("created_at"),
                ),
            )
            if output_file:
                cursor.execute(
                    """
                    INSERT INTO tos_activity_files
                      (activity_id, file_role, file_role_label, storage_provider,
                       object_key, file_name, created_at)
                    VALUES (%s, 'result_file', '结果文件', 'local-path', %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                      object_key = VALUES(object_key),
                      file_name = VALUES(file_name)
                    """,
                    (
                        record["record_id"],
                        output_file,
                        _read_file_name(output_file),
                        record.get("created_at"),
                    ),
                )
        connection.commit()
    return get_process_history_record(record["record_id"]) or {}


def get_process_history_record(record_id: str) -> dict[str, Any] | None:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT ar.id, ar.activity_id AS record_id, ar.module_id,
                       ar.activity_name AS module_name, ar.status, ar.duration_ms,
                       ar.message,
                       JSON_EXTRACT(ar.metadata_json, '$.inputFiles') AS input_files_json,
                       JSON_UNQUOTE(JSON_EXTRACT(ar.metadata_json, '$.outputFile')) AS output_file,
                       JSON_EXTRACT(ar.metadata_json, '$.summary') AS summary_json,
                       ar.created_at, ar.updated_at
                FROM tos_activity_records ar
                WHERE ar.activity_id = %s AND ar.activity_type <> 'automation'
                LIMIT 1
                """,
                (record_id,),
            )
            row = cursor.fetchone()
    return row


def list_process_history_records(
    module_ids: list[str] | None = None,
    *,
    status: str | None = None,
    limit: int = 80,
    offset: int = 0,
) -> list[dict[str, Any]]:
    ensure_schema()
    safe_limit = max(1, min(int(limit or 80), 300))
    safe_offset = max(0, int(offset or 0))
    where_clause, params = _build_process_history_filters(
        module_ids=module_ids,
        status=status,
    )
    params.extend([safe_limit, safe_offset])
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT ar.id, ar.activity_id AS record_id, ar.module_id,
                       ar.activity_name AS module_name, ar.status, ar.duration_ms,
                       ar.message,
                       JSON_EXTRACT(ar.metadata_json, '$.inputFiles') AS input_files_json,
                       JSON_UNQUOTE(JSON_EXTRACT(ar.metadata_json, '$.outputFile')) AS output_file,
                       JSON_EXTRACT(ar.metadata_json, '$.summary') AS summary_json,
                       ar.created_at, ar.updated_at
                FROM tos_activity_records ar
                {where_clause}
                ORDER BY created_at DESC, id DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params),
            )
            rows = cursor.fetchall()
    return rows or []


def count_process_history_records(
    module_ids: list[str] | None = None,
    *,
    status: str | None = None,
) -> int:
    ensure_schema()
    where_clause, params = _build_process_history_filters(
        module_ids=module_ids,
        status=status,
    )
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM tos_activity_records ar
                {where_clause}
                """,
                tuple(params),
            )
            row = cursor.fetchone() or {}
    return int(row.get("total") or 0)


def _build_process_history_filters(
    *,
    module_ids: list[str] | None = None,
    status: str | None = None,
) -> tuple[str, list[Any]]:
    conditions: list[str] = []
    params: list[Any] = []
    clean_module_ids = [
        module_id.strip()
        for module_id in (module_ids or [])
        if str(module_id or "").strip()
    ]
    if clean_module_ids:
        placeholders = ", ".join(["%s"] * len(clean_module_ids))
        conditions.append(f"ar.module_id IN ({placeholders})")
        params.extend(clean_module_ids)
    else:
        conditions.append("ar.activity_type <> 'automation'")
    if status:
        conditions.append("ar.status = %s")
        params.append(status)
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return where_clause, params


def insert_excel_upload_backup(backup: dict[str, Any]) -> dict[str, Any]:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tos_activity_files
                  (activity_id, file_role, file_role_label, storage_provider,
                   bucket, object_key, file_name, content_type, file_size, sha256)
                VALUES (%s, %s, '上传备份', 'minio', %s, %s, %s, %s, %s, %s)
                """,
                (
                    backup["request_id"],
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
                SELECT file_id AS id, activity_id AS request_id, file_role,
                       bucket, object_key, file_name AS original_filename,
                       content_type, file_size, sha256, created_at
                FROM tos_activity_files
                WHERE file_id = %s
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
                SELECT file_id AS id, activity_id AS run_id, file_role,
                       bucket, object_key, file_name AS original_filename,
                       content_type, file_size, sha256, created_at
                FROM tos_activity_files
                WHERE activity_id = %s
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
                SELECT file_id AS id, activity_id AS run_id, file_role,
                       bucket, object_key, file_name AS original_filename,
                       content_type, file_size, sha256, created_at
                FROM tos_activity_files
                WHERE file_id = %s
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
                SELECT release_id AS id, release_key AS record_key,
                       release_version AS version, release_date, change_type AS category, page_name,
                       page_path, title, description, created_by, created_at, updated_at
                FROM tos_release_records
                WHERE NOT (
                  release_key LIKE 'git-%%'
                  AND title = 'chore: 同步版本更新缓存'
                )
                ORDER BY release_date DESC, id DESC
                """,
            )
            rows = cursor.fetchall()
    # 版本记录量很小，先取全量再按语义版本排序，避免数据库时间排序先 LIMIT 漏掉最新版。
    sorted_rows = sorted(rows or [], key=_release_update_sort_key, reverse=True)
    return sorted_rows[:safe_limit]


def count_release_update_records() -> int:
    ensure_schema()
    with mysql_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*) AS total
                FROM tos_release_records
                WHERE NOT (
                  release_key LIKE 'git-%%'
                  AND title = 'chore: 同步版本更新缓存'
                )
                """,
            )
            row = cursor.fetchone() or {}
    return int(row.get("total") or 0)


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
                SELECT release_id AS id, release_key AS record_key,
                       release_version AS version, release_date, change_type AS category, page_name,
                       page_path, title, description, created_by, created_at, updated_at
                FROM tos_release_records
                WHERE release_key = %s
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
                INSERT INTO tos_release_records
                  (release_key, release_version, release_date, change_type, page_name,
                   page_path, title, description, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE release_key = release_key
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
                INSERT INTO tos_release_records
                  (release_key, release_version, release_date, change_type, page_name,
                   page_path, title, description, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  release_version = VALUES(release_version),
                  release_date = VALUES(release_date),
                  change_type = VALUES(change_type),
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
    CREATE TABLE IF NOT EXISTS tos_people (
      person_id VARCHAR(64) NOT NULL PRIMARY KEY,
      person_name VARCHAR(96) NOT NULL,
      person_name_en VARCHAR(96) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 100,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS tos_modules (
      module_id VARCHAR(128) NOT NULL PRIMARY KEY,
      person_id VARCHAR(64) NOT NULL,
      module_name VARCHAR(255) NOT NULL,
      module_name_en VARCHAR(255) NOT NULL DEFAULT '',
      module_type VARCHAR(64) NOT NULL DEFAULT 'excel',
      page_path VARCHAR(255) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 100,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_tos_modules_person (person_id, sort_order),
      KEY idx_tos_modules_type (module_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS tos_activity_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      activity_id VARCHAR(128) NOT NULL,
      module_id VARCHAR(128) NOT NULL,
      person_id VARCHAR(64) NOT NULL,
      activity_type VARCHAR(64) NOT NULL DEFAULT 'excel',
      activity_name VARCHAR(255) NOT NULL DEFAULT '',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      status_label VARCHAR(32) NOT NULL DEFAULT '',
      message TEXT NULL,
      technical_message TEXT NULL,
      result_json LONGTEXT NULL,
      metadata_json LONGTEXT NULL,
      duration_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      source_system VARCHAR(96) NOT NULL DEFAULT 'tos',
      UNIQUE KEY uq_tos_activity_id (activity_id),
      KEY idx_tos_activity_created (created_at),
      KEY idx_tos_activity_person_created (person_id, created_at),
      KEY idx_tos_activity_module_created (module_id, created_at),
      KEY idx_tos_activity_status_created (status, created_at),
      KEY idx_tos_activity_type_created (activity_type, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS tos_activity_files (
      file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      activity_id VARCHAR(128) NOT NULL,
      file_role VARCHAR(64) NOT NULL,
      file_role_label VARCHAR(96) NOT NULL DEFAULT '',
      storage_provider VARCHAR(32) NOT NULL DEFAULT 'minio',
      bucket VARCHAR(128) NOT NULL DEFAULT '',
      object_key VARCHAR(1024) NOT NULL DEFAULT '',
      file_name VARCHAR(255) NOT NULL DEFAULT '',
      content_type VARCHAR(128) NOT NULL DEFAULT '',
      file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
      sha256 CHAR(64) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_tos_activity_files_activity (activity_id, created_at),
      UNIQUE KEY uq_tos_activity_file_object (activity_id, file_role, object_key(191), file_name(191))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS tos_module_templates (
      template_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      module_id VARCHAR(128) NOT NULL,
      template_key VARCHAR(128) NOT NULL DEFAULT 'default',
      template_name VARCHAR(255) NOT NULL,
      bucket VARCHAR(128) NOT NULL,
      object_key VARCHAR(1024) NOT NULL,
      file_name VARCHAR(255) NOT NULL DEFAULT '',
      content_type VARCHAR(128) NOT NULL DEFAULT '',
      file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
      sha256 CHAR(64) NOT NULL DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tos_module_templates (module_id, template_key),
      KEY idx_tos_module_templates_module (module_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS tos_login_accounts (
      account_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      module_id VARCHAR(128) NOT NULL,
      account_key VARCHAR(128) NOT NULL DEFAULT 'default',
      username VARCHAR(255) NOT NULL,
      password_ciphertext TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tos_login_accounts (module_id, account_key),
      KEY idx_tos_login_accounts_module (module_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS tos_release_records (
      release_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      release_key VARCHAR(160) NOT NULL,
      release_version VARCHAR(64) NOT NULL,
      release_date DATE NULL,
      change_type VARCHAR(32) NOT NULL DEFAULT 'improved',
      page_name VARCHAR(255) NOT NULL,
      page_path VARCHAR(255) NOT NULL DEFAULT '',
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      created_by VARCHAR(96) NOT NULL DEFAULT 'system',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tos_release_key (release_key),
      KEY idx_tos_release_date (release_date, release_id),
      KEY idx_tos_release_page (page_path)
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
