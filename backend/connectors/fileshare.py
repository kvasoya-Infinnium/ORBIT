"""
connectors/fileshare.py
-----------------------
Searches one or more folders on disk (local or a mounted network/SMB share).

For each file it:
  1. reads the bytes,
  2. extracts text (PDF/DOCX/TXT/CSV) using core.textutil,
  3. checks if the text matches the query,
  4. turns matches into EvidenceItems with full file metadata.

Config (.env):  FILESHARE_PATHS=./data/fileshare,./data/more   (comma-separated)
"""

import os
from datetime import datetime, timezone
from pathlib import Path

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import textutil, config

SUPPORTED = (".pdf", ".docx", ".txt", ".csv", ".md", ".json", ".log")


def _file_metadata(file: Path) -> dict:
    """Extract rich metadata from a file."""
    stat = file.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
    ctime = datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc)
    atime = datetime.fromtimestamp(stat.st_atime, tz=timezone.utc)

    meta = {
        "file_name": file.name,
        "file_extension": file.suffix.lower(),
        "file_path": str(file.resolve()),
        "parent_folder": str(file.parent.resolve()),
        "size_bytes": stat.st_size,
        "size_readable": _human_size(stat.st_size),
        "created_at": ctime.isoformat(),
        "modified_at": mtime.isoformat(),
        "accessed_at": atime.isoformat(),
    }

    # Owner (Windows / Unix)
    try:
        if os.name == "nt":
            import ctypes
            meta["owner"] = _get_windows_owner(file)
        else:
            import pwd
            meta["owner"] = pwd.getpwuid(stat.st_uid).pw_name
    except Exception:
        meta["owner"] = "unknown"

    return meta


def _human_size(nbytes: int) -> str:
    """Convert bytes to human readable string."""
    for unit in ("B", "KB", "MB", "GB"):
        if nbytes < 1024:
            return f"{nbytes:.1f} {unit}"
        nbytes /= 1024
    return f"{nbytes:.1f} TB"


def _get_windows_owner(file: Path) -> str:
    """Get file owner on Windows."""
    try:
        import subprocess
        result = subprocess.run(
            ["powershell", "-Command", f"(Get-Acl '{file}').Owner"],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


class FileshareConnector(Connector):
    id = "fileshare"
    name = "Fileshare"
    icon = "📁"
    fields = [
        {"key": "FILESHARE_PATHS", "label": "Folder paths (comma-separated)",
         "type": "text", "placeholder": "./data/fileshare, C:/shared/legal"},
    ]

    @property
    def paths(self) -> list[str]:
        raw = config.get(self.instance_id, "FILESHARE_PATHS", "./data/fileshare")
        return [p.strip() for p in raw.split(",") if p.strip()]

    async def test_connection(self) -> ConnectionStatus:
        existing = [p for p in self.paths if Path(p).exists()]
        if not existing:
            return ConnectionStatus(connected=False, detail=f"No paths found: {self.paths}")
        return ConnectionStatus(connected=True, detail=f"{len(existing)} path(s) ready")

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        results: list[EvidenceItem] = []
        n = 0
        for root in self.paths:
            root_path = Path(root)
            if not root_path.exists():
                continue
            for file in root_path.rglob("*"):
                if len(results) >= q.limit:
                    return results
                if not file.is_file() or file.suffix.lower() not in SUPPORTED:
                    continue
                try:
                    raw = file.read_bytes()
                except Exception:
                    continue
                text = textutil.extract_text(file.name, raw)
                if not (textutil.matches(text, q) or textutil.matches(file.name, q)):
                    continue

                meta = _file_metadata(file)
                meta["root"] = root
                n += 1
                results.append(EvidenceItem(
                    id=f"{self.instance_id}-{n}",
                    source=self.id,
                    source_label=self.label,
                    record_id=str(file.resolve()),
                    title=file.name,
                    snippet=textutil.make_snippet(text, q),
                    content=text,
                    author=meta.get("owner"),
                    timestamp=meta["modified_at"],
                    link=str(file.resolve()),
                    metadata=meta,
                ))
        return results
