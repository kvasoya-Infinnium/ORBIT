"""
connectors/fileshare.py
-----------------------
Searches one or more folders on disk (local or a mounted network/SMB share).

For each file it:
  1. reads the bytes,
  2. extracts text (PDF/DOCX/TXT/CSV) using core.textutil,
  3. checks if the text matches the query,
  4. turns matches into EvidenceItems.

Config (.env):  FILESHARE_PATHS=./data/fileshare,./data/more   (comma-separated)
"""

from datetime import datetime, timezone
from pathlib import Path

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import textutil, config

SUPPORTED = (".pdf", ".docx", ".txt", ".csv", ".md", ".json", ".log")


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
                # match against file name OR its contents
                if not (textutil.matches(text, q) or textutil.matches(file.name, q)):
                    continue
                mtime = datetime.fromtimestamp(file.stat().st_mtime, tz=timezone.utc)
                n += 1
                results.append(EvidenceItem(
                    id=f"{self.instance_id}-{n}",
                    source=self.id,
                    source_label=self.label,
                    record_id=str(file.resolve()),
                    title=file.name,
                    snippet=textutil.make_snippet(text, q),
                    content=text,
                    author=None,
                    timestamp=mtime.isoformat(),
                    link=str(file.resolve()),
                    metadata={"root": root, "size_bytes": file.stat().st_size},
                ))
        return results
