from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = WORKSPACE_ROOT / "tms-backend"
FRONTEND_RELEASE_HISTORY_PATH = Path("tms-frontend/src/shared/version/releaseHistory.json")
BACKEND_RELEASE_UPDATES_API_PATH = Path("tms-backend/api/release_updates_api.py")
RELEASE_UPDATE_CACHE_SYNC_TITLE = "chore: 同步版本更新缓存"
RELEASE_UPDATE_CACHE_SYNC_FILES = {
    FRONTEND_RELEASE_HISTORY_PATH.as_posix(),
    BACKEND_RELEASE_UPDATES_API_PATH.as_posix(),
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Record Git commits into TOS release update history.")
    target = parser.add_mutually_exclusive_group()
    target.add_argument("--commit", help="Single commit SHA to record.")
    target.add_argument("--range", dest="commit_range", help="Git revision range, for example ORIG_HEAD..HEAD.")
    target.add_argument("--pull", action="store_true", help="Pull records from the server into local fallback caches.")
    parser.add_argument("--limit", type=int, default=None, help="Maximum commits or server records to read.")
    parser.add_argument("--event", default="manual", help="Source event, for example commit, merge, deploy.")
    parser.add_argument("--backend-url", default="", help="Release updates API URL or backend base URL.")
    parser.add_argument("--allow-direct-db", action="store_true", help="Allow writing directly to the configured MySQL database.")
    parser.add_argument("--dry-run", action="store_true", help="Print records without writing them.")
    parser.add_argument("--quiet", action="store_true", help="Suppress success output.")
    args = parser.parse_args()

    try:
        backend_url = resolve_release_updates_api_url(args.backend_url)
        if args.pull:
            if not backend_url:
                raise RuntimeError("Missing release updates backend URL; set TOS_RELEASE_UPDATES_API_URL or tms-frontend/.env.server.")
            records = fetch_release_update_records(backend_url, args.limit or 300)
            result = sync_release_update_cache(server_records=records, dry_run=args.dry_run)
            if args.dry_run:
                print(json.dumps(result, ensure_ascii=False, indent=2))
            elif not args.quiet:
                print(f"Synced {result['recordCount']} release update record(s).")
            return 0

        records = build_release_update_records(args)
        if args.dry_run:
            print(json.dumps(records, ensure_ascii=False, indent=2))
            return 0

        if backend_url:
            for record in records:
                post_record(backend_url, record)
        elif args.allow_direct_db:
            upsert_records_directly(records)
        else:
            raise RuntimeError("Missing release updates backend URL; set TOS_RELEASE_UPDATES_API_URL or tms-frontend/.env.server.")

        if not args.quiet:
            print(f"Recorded {len(records)} release update record(s).")
        return 0
    except Exception as exc:
        if not args.quiet:
            print(f"Failed to record release updates: {exc}", file=sys.stderr)
        return 1


def build_release_update_records(args: argparse.Namespace) -> list[dict[str, Any]]:
    commits = read_commits(args.commit, args.commit_range, args.limit or 1)
    version = read_app_version()
    return [
        build_record(commit, version, args.event)
        for commit in commits
        if not is_release_update_cache_sync_commit(commit)
    ]


def resolve_release_updates_api_url(explicit_url: str | None = "", workspace_root: Path = WORKSPACE_ROOT) -> str:
    raw_url = (explicit_url or os.environ.get("TOS_RELEASE_UPDATES_API_URL") or "").strip()
    if not raw_url:
        raw_url = read_env_server_backend_url(workspace_root)
    return normalize_release_updates_api_url(raw_url)


def read_env_server_backend_url(workspace_root: Path = WORKSPACE_ROOT) -> str:
    env_server_path = workspace_root / "tms-frontend" / ".env.server"
    if not env_server_path.exists():
        return ""

    for line in env_server_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        if key.strip() == "VITE_BACKEND_URL":
            return value.strip().strip("\"'")
    return ""


def normalize_release_updates_api_url(raw_url: str) -> str:
    url = str(raw_url or "").strip().rstrip("/")
    if not url:
        return ""
    if url.endswith("/api/release-updates"):
        return url
    return f"{url}/api/release-updates"


def fetch_release_update_records(api_url: str, limit: int = 300) -> list[dict[str, Any]]:
    safe_limit = max(1, min(int(limit or 300), 300))
    separator = "&" if "?" in api_url else "?"
    request = Request(f"{api_url}{separator}limit={safe_limit}", method="GET")
    try:
        with urlopen(request, timeout=20) as response:
            if response.status >= 300:
                raise RuntimeError(f"HTTP {response.status}")
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='ignore')}") from exc
    except URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc

    records = payload.get("records") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        raise RuntimeError("Release updates API returned an invalid records payload.")
    return records


def sync_release_update_cache(
    *,
    workspace_root: Path = WORKSPACE_ROOT,
    server_records: list[dict[str, Any]],
    dry_run: bool = False,
) -> dict[str, Any]:
    local_records = read_local_release_history(workspace_root)
    merged_records = merge_release_update_records(server_records, local_records)

    if not dry_run:
        write_local_release_history(workspace_root, merged_records)
        write_backend_default_records(workspace_root, merged_records)

    return {
        "recordCount": len(merged_records),
        "records": merged_records,
    }


def read_local_release_history(workspace_root: Path = WORKSPACE_ROOT) -> list[dict[str, Any]]:
    history_path = workspace_root / FRONTEND_RELEASE_HISTORY_PATH
    if not history_path.exists():
        return []
    payload = json.loads(history_path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, list) else []


def merge_release_update_records(
    server_records: list[dict[str, Any]],
    local_records: list[dict[str, Any]],
) -> list[dict[str, str]]:
    merged: list[tuple[dict[str, str], int]] = []
    seen_keys: set[str] = set()
    order = 0

    for source_records in (server_records, local_records):
        for raw_record in source_records:
            record = normalize_release_update_record(raw_record)
            record_key = record["recordKey"]
            if is_release_update_cache_sync_record(record):
                order += 1
                continue
            if not record_key or record_key in seen_keys:
                order += 1
                continue
            seen_keys.add(record_key)
            merged.append((record, order))
            order += 1

    merged.sort(key=lambda item: release_update_sort_key(item[0], item[1]), reverse=True)
    return [record for record, _order in merged]


def normalize_release_update_record(raw_record: dict[str, Any]) -> dict[str, str]:
    return {
        "recordKey": str(raw_record.get("recordKey") or raw_record.get("record_key") or "").strip(),
        "version": str(raw_record.get("version") or "").strip(),
        "releaseDate": str(raw_record.get("releaseDate") or raw_record.get("release_date") or "").strip(),
        "category": str(raw_record.get("category") or "improved").strip() or "improved",
        "pageName": str(raw_record.get("pageName") or raw_record.get("page_name") or "全局通用").strip(),
        "pagePath": str(raw_record.get("pagePath") or raw_record.get("page_path") or "").strip(),
        "title": str(raw_record.get("title") or "").strip(),
        "description": str(raw_record.get("description") or "").strip(),
    }


def is_release_update_cache_sync_record(record: dict[str, str]) -> bool:
    return (
        record.get("recordKey", "").startswith("git-")
        and record.get("title", "").strip() == RELEASE_UPDATE_CACHE_SYNC_TITLE
    )


def release_update_sort_key(record: dict[str, str], order: int) -> tuple[tuple[int, ...], str, int]:
    return (
        version_sort_key(record["version"]),
        record["releaseDate"],
        -order,
    )


def version_sort_key(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in re.findall(r"\d+", version.lower().removeprefix("v")))


def write_local_release_history(workspace_root: Path, records: list[dict[str, str]]) -> None:
    history_path = workspace_root / FRONTEND_RELEASE_HISTORY_PATH
    history_path.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(history_path, f"{json.dumps(records, ensure_ascii=False, indent=2)}\n")


def write_backend_default_records(workspace_root: Path, records: list[dict[str, str]]) -> None:
    api_path = workspace_root / BACKEND_RELEASE_UPDATES_API_PATH
    content = api_path.read_text(encoding="utf-8")
    start_marker = "DEFAULT_RELEASE_UPDATE_RECORDS: list[dict[str, Any]] = ["
    end_marker = "\n\n\n@router.get"
    start = content.index(start_marker)
    end = content.index(end_marker, start)
    updated = f"{content[:start]}{build_backend_default_records_source(records)}{content[end:]}"
    write_text_lf(api_path, updated)


def write_text_lf(path: Path, content: str) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(content)


def build_backend_default_records_source(records: list[dict[str, str]]) -> str:
    lines = ["DEFAULT_RELEASE_UPDATE_RECORDS: list[dict[str, Any]] = ["]
    for record in records:
        lines.extend([
            "    _default_record(",
            f"        {json.dumps(record['recordKey'], ensure_ascii=False)},",
            f"        {json.dumps(record['version'], ensure_ascii=False)},",
            f"        {json.dumps(record['releaseDate'], ensure_ascii=False)},",
            f"        {json.dumps(record['category'], ensure_ascii=False)},",
            f"        {json.dumps(record['pageName'], ensure_ascii=False)},",
            f"        {json.dumps(record['pagePath'], ensure_ascii=False)},",
            f"        {json.dumps(record['title'], ensure_ascii=False)},",
            f"        {json.dumps(record['description'], ensure_ascii=False)},",
            "    ),",
        ])
    lines.append("]")
    return "\n".join(lines)


def read_commits(commit: str | None, commit_range: str | None, limit: int) -> list[dict[str, str]]:
    if commit:
        shas = [git("rev-parse", commit)]
    elif commit_range:
        shas = git("rev-list", "--reverse", commit_range).splitlines()
    else:
        safe_limit = max(1, min(int(limit or 1), 50))
        shas = git("rev-list", "--reverse", f"--max-count={safe_limit}", "HEAD").splitlines()

    records: list[dict[str, str]] = []
    for sha in [item.strip() for item in shas if item.strip()]:
        records.append({
            "sha": sha,
            "short_sha": git("rev-parse", "--short=12", sha),
            "subject": git("show", "-s", "--format=%s", sha),
            "body": git("show", "-s", "--format=%b", sha).strip(),
            "author": git("show", "-s", "--format=%an", sha),
            "date": git("show", "-s", "--format=%cI", sha),
            "files": "\n".join(read_changed_files(sha)),
        })
    return records


def build_record(commit: dict[str, str], version: str, event: str) -> dict[str, Any]:
    files = [item for item in commit["files"].splitlines() if item]
    page_name, page_path = infer_page(files)
    subject = commit["subject"].strip() or commit["short_sha"]
    release_date = parse_commit_date(commit["date"])
    category = infer_category(subject, files)
    description = build_description(subject, files, event)

    return {
        "record_key": f"git-{commit['sha']}",
        "version": version,
        "release_date": release_date,
        "category": category,
        "page_name": page_name,
        "page_path": page_path,
        "title": subject[:255],
        "description": description,
        "created_by": f"git:{commit['author'] or 'unknown'}",
    }


def is_release_update_cache_sync_commit(commit: dict[str, str]) -> bool:
    files = {
        item.replace("\\", "/")
        for item in commit.get("files", "").splitlines()
        if item.strip()
    }
    return (
        commit.get("subject", "").strip() == RELEASE_UPDATE_CACHE_SYNC_TITLE
        and bool(files)
        and files.issubset(RELEASE_UPDATE_CACHE_SYNC_FILES)
    )


def infer_page(files: list[str]) -> tuple[str, str]:
    rules = [
        ("系统设置", "/settings", ("src/pages/settings/", "src/layout/AppShell.vue", "src/layout/useAppShellModel.ts")),
        (
            "版本更新记录",
            "/release-updates",
            ("src/pages/release-updates/", "release_updates_api.py", "release_update_sync.py", ".githooks/"),
        ),
        (
            "Jason / 发票 PDF 重排序",
            "/jason/pdf-reorder",
            ("src/pages/jason-pdf-reorder/", "it_invoice_pdf_reorder", "jason_pdf_reorder"),
        ),
        ("浏览器自动化", "/web-automation", ("src/pages/web-automation/", "automation-apps/")),
        ("TMS 财务 / Excel", "/tms-finance", ("tms-finance", "tmsFinance")),
        ("后端服务", "/api", ("tms-backend/",)),
        ("应用版本", "/settings", ("app-version.json", "app_version.py", "releaseNotes.json")),
    ]

    matches: list[tuple[str, str]] = []
    normalized_files = [item.replace("\\", "/") for item in files]
    for page_name, page_path, markers in rules:
        if any(any(marker in path for marker in markers) for path in normalized_files):
            matches.append((page_name, page_path))

    unique_matches = list(dict.fromkeys(matches))
    if not unique_matches:
        return "全局通用", ""
    if len(unique_matches) == 1:
        return unique_matches[0]
    return "多个页面", ""


def infer_category(subject: str, files: list[str]) -> str:
    lowered = subject.lower()
    if lowered.startswith(("fix", "hotfix")) or any(token in subject for token in ("修复", "解决")):
        return "fixed"
    if lowered.startswith(("feat", "add")) or any(token in subject for token in ("新增", "接入")):
        return "added"
    if any(token in subject for token in ("重构", "优化", "美化", "调整", "完善")):
        return "improved"
    if any("test" in item.lower() for item in files):
        return "improved"
    return "improved"


def build_description(subject: str, files: list[str], event: str) -> str:
    shown_files = files[:8]
    file_summary = "、".join(shown_files)
    if len(files) > len(shown_files):
        file_summary += f" 等 {len(files)} 个文件"
    if not file_summary:
        file_summary = "未检测到文件列表"
    return f"由 Git {event} 自动记录：{subject}。涉及文件：{file_summary}。"


def read_changed_files(sha: str) -> list[str]:
    output = git("diff-tree", "--no-commit-id", "--name-only", "-r", "-m", sha, allow_empty=True)
    files = []
    for line in output.splitlines():
        clean = line.strip()
        if clean and clean not in files:
            files.append(clean)
    return files


def read_app_version() -> str:
    version_file = WORKSPACE_ROOT / "app-version.json"
    if version_file.exists():
        payload = json.loads(version_file.read_text(encoding="utf-8"))
        version = str(payload.get("version", "")).strip()
        if version:
            return version

    app_version_file = BACKEND_ROOT / "app_version.py"
    if app_version_file.exists():
        namespace: dict[str, Any] = {}
        exec(app_version_file.read_text(encoding="utf-8"), namespace)
        version = str(namespace.get("APP_VERSION", "")).strip()
        if version:
            return version

    return "0.0.0"


def parse_commit_date(value: str) -> str:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return datetime.now().date().isoformat()


def upsert_records_directly(records: list[dict[str, Any]]) -> None:
    sys.path.insert(0, str(BACKEND_ROOT))
    from utils.mysql_store import upsert_release_update_record

    for record in records:
        upsert_release_update_record(record)


def post_record(base_url: str, record: dict[str, Any]) -> None:
    url = normalize_release_updates_api_url(base_url)
    payload = {
        "recordKey": record["record_key"],
        "version": record["version"],
        "releaseDate": record["release_date"],
        "category": record["category"],
        "pageName": record["page_name"],
        "pagePath": record["page_path"],
        "title": record["title"],
        "description": record["description"],
        "createdBy": record["created_by"],
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    write_token = os.environ.get("TOS_RELEASE_UPDATE_WRITE_TOKEN", "").strip()
    if write_token:
        headers["X-Release-Update-Token"] = write_token
    request = Request(url, data=data, method="POST", headers=headers)
    try:
        with urlopen(request, timeout=15) as response:
            if response.status >= 300:
                raise RuntimeError(f"HTTP {response.status}")
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='ignore')}") from exc
    except URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc


def git(*args: str, allow_empty: bool = False) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=WORKSPACE_ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        if allow_empty:
            return ""
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


if __name__ == "__main__":
    raise SystemExit(main())
