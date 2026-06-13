from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = WORKSPACE_ROOT / "tms-backend"


def main() -> int:
    parser = argparse.ArgumentParser(description="Record Git commits into TOS release update history.")
    target = parser.add_mutually_exclusive_group()
    target.add_argument("--commit", help="Single commit SHA to record.")
    target.add_argument("--range", dest="commit_range", help="Git revision range, for example ORIG_HEAD..HEAD.")
    parser.add_argument("--limit", type=int, default=1, help="Maximum commits to record when no range is provided.")
    parser.add_argument("--event", default="manual", help="Source event, for example commit, merge, deploy.")
    parser.add_argument("--backend-url", default=os.environ.get("TOS_RELEASE_UPDATES_API_URL", ""))
    parser.add_argument("--dry-run", action="store_true", help="Print records without writing them.")
    parser.add_argument("--quiet", action="store_true", help="Suppress success output.")
    args = parser.parse_args()

    try:
        records = build_release_update_records(args)
        if args.dry_run:
            print(json.dumps(records, ensure_ascii=False, indent=2))
            return 0

        if args.backend_url:
            for record in records:
                post_record(args.backend_url, record)
        else:
            upsert_records_directly(records)

        if not args.quiet:
            print(f"Recorded {len(records)} release update record(s).")
        return 0
    except Exception as exc:
        if not args.quiet:
            print(f"Failed to record release updates: {exc}", file=sys.stderr)
        return 1


def build_release_update_records(args: argparse.Namespace) -> list[dict[str, Any]]:
    commits = read_commits(args.commit, args.commit_range, args.limit)
    version = read_app_version()
    return [build_record(commit, version, args.event) for commit in commits]


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


def infer_page(files: list[str]) -> tuple[str, str]:
    rules = [
        ("系统设置", "/settings", ("src/pages/settings/", "src/layout/AppShell.vue", "src/layout/useAppShellModel.ts")),
        (
            "版本更新记录",
            "/release-updates",
            ("src/pages/release-updates/", "release_updates_api.py", "release_update_sync.py", ".githooks/"),
        ),
        ("IT-发票PDF重排序", "/it-invoice-pdf-reorder", ("it-invoice-pdf-reorder", "it_invoice_pdf_reorder")),
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
    url = base_url.rstrip("/")
    if not url.endswith("/api/release-updates"):
        url = f"{url}/api/release-updates"
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
    request = Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
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
