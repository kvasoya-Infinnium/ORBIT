"""
services/export.py
------------------
Turns a set of Evidence Items into a downloadable "review set" — the last step of
an eDiscovery workflow. We support CSV (one row per item) and JSON (full bundle).

In this scaffold we export whatever items are passed in. (A production version would
re-run the stored query_id from the audit log to reproduce the exact set.)
"""

import io
import csv
import json
from core.models import EvidenceItem


def to_csv(items: list[EvidenceItem]) -> str:
    """One row per Evidence Item with the fields a reviewer cares about."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "source", "author", "timestamp", "title", "snippet", "link"])
    for it in items:
        writer.writerow([it.id, it.source, it.author or "", it.timestamp or "",
                         it.title, it.snippet, it.link or ""])
    return buf.getvalue()


def to_json(items: list[EvidenceItem]) -> str:
    """Full JSON bundle including complete content (for archival)."""
    return json.dumps([it.model_dump() for it in items], indent=2, ensure_ascii=False)
