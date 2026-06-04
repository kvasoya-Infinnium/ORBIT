"""
services/export.py
------------------
Turns a set of Evidence Items into a downloadable "review set" — the last step of
an eDiscovery workflow. We support CSV, JSON, and XLSX (Excel).
"""

import io
import csv
import json
import re
import zipfile
from pathlib import Path
from datetime import datetime
from core.models import EvidenceItem


def _safe_filename(name: str, fallback: str = "item") -> str:
    """Strip characters Windows/Linux don't allow in filenames; cap length."""
    name = (name or fallback).strip()
    name = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    return (name or fallback)[:120]


def _text_blob(it: EvidenceItem) -> str:
    """A human-readable text rendering of an evidence item (used in the ZIP for
    sources that don't have an original file)."""
    lines = [
        f"Title:       {it.title}",
        f"Source:      {it.source_label} ({it.source})",
        f"Item ID:     {it.id}",
        f"Record ID:   {it.record_id}",
        f"Author:      {it.author or ''}",
        f"Timestamp:   {it.timestamp or ''}",
        f"Link:        {it.link or ''}",
    ]
    if it.participants:
        lines.append(f"Participants: {', '.join(it.participants)}")
    if it.metadata:
        lines.append("Metadata:")
        for k, v in it.metadata.items():
            lines.append(f"  - {k}: {v}")
    lines.append("")
    lines.append("=" * 72)
    lines.append("")
    lines.append(it.content or "")
    return "\n".join(lines)


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


def to_xlsx(items: list[EvidenceItem], question: str = "", per_connector: dict | None = None) -> bytes:
    """Structured Excel workbook: a summary band at the top, then one row per item
    with every field a reviewer cares about (file, author, time, source, link, …).
    """
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "ORBIT Results"

    title_font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    label_font = Font(name="Calibri", size=11, bold=True)
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_fill = PatternFill("solid", fgColor="1F4E78")
    header_fill = PatternFill("solid", fgColor="2E75B6")
    band_fill = PatternFill("solid", fgColor="DEEBF7")
    thin = Side(border_style="thin", color="BFBFBF")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    wrap = Alignment(wrap_text=True, vertical="top")

    columns = [
        ("#",            6),
        ("ID",           14),
        ("Source",       14),
        ("Source Label", 22),
        ("Title",        36),
        ("Author",       20),
        ("Timestamp",    22),
        ("Record ID",    22),
        ("Participants", 28),
        ("Snippet",      50),
        ("Link / Path",  40),
        ("Content",      60),
    ]

    # ----- Summary band -----
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(columns))
    c = ws.cell(row=1, column=1, value="ORBIT — Query Export")
    c.font = title_font
    c.fill = title_fill
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 26

    meta = [
        ("Query",         question or ""),
        ("Generated",     datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        ("Total Items",   str(len(items))),
        ("Sources",       ", ".join(sorted({it.source_label or it.source for it in items}))),
    ]
    if per_connector:
        meta.append(("Per connector",
                     ", ".join(f"{cid}: {info.get('count', 0)}"
                               for cid, info in per_connector.items())))

    row = 2
    for label, value in meta:
        a = ws.cell(row=row, column=1, value=label)
        a.font = label_font
        a.fill = band_fill
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=len(columns))
        b = ws.cell(row=row, column=2, value=value)
        b.alignment = wrap
        row += 1

    row += 1  # blank spacer

    # ----- Header row -----
    header_row = row
    for col_idx, (name, width) in enumerate(columns, start=1):
        cell = ws.cell(row=header_row, column=col_idx, value=name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border
        ws.column_dimensions[get_column_letter(col_idx)].width = width
    ws.row_dimensions[header_row].height = 22

    # ----- Data rows -----
    for i, it in enumerate(items, start=1):
        r = header_row + i
        values = [
            i,
            it.id,
            it.source,
            it.source_label,
            it.title,
            it.author or "",
            it.timestamp or "",
            it.record_id,
            ", ".join(it.participants) if it.participants else "",
            it.snippet,
            it.link or "",
            it.content,
        ]
        for col_idx, val in enumerate(values, start=1):
            cell = ws.cell(row=r, column=col_idx, value=val)
            cell.alignment = wrap
            cell.border = border

    # Freeze header + summary band
    ws.freeze_panes = ws.cell(row=header_row + 1, column=1)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _fetch_email_raw(it: EvidenceItem) -> bytes | None:
    """Re-fetch the original RFC822 bytes for an email item by routing back to its
    specific connector instance (item.id is '<instance_id>-<n>')."""
    try:
        from core import registry
        instance_id = it.id.rsplit("-", 1)[0]
        conn = registry.get(instance_id)
        if conn is None or not hasattr(conn, "fetch_raw"):
            return None
        return conn.fetch_raw(it.record_id)
    except Exception:
        return None


def to_zip(items: list[EvidenceItem], question: str = "", per_connector: dict | None = None) -> bytes:
    """Bundle the entire result set into a single ZIP:
      • Fileshare items keep their ORIGINAL bytes + extension.
      • Email / Slack / Zoho / Notion / S3 / Blob / AI Chat items become .txt
        (we only have the extracted text in memory; the original isn't re-fetched).
      • manifest.xlsx at the root holds the full structured index.
    """
    buf = io.BytesIO()
    used_names: set[str] = set()

    def _unique(path: str) -> str:
        """Avoid collisions when two items share the same filename."""
        if path not in used_names:
            used_names.add(path)
            return path
        stem, dot, ext = path.rpartition(".")
        if not dot:
            stem, ext = path, ""
        i = 2
        while True:
            candidate = f"{stem}_{i}{('.' + ext) if ext else ''}"
            if candidate not in used_names:
                used_names.add(candidate)
                return candidate
            i += 1

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for it in items:
            src = _safe_filename(it.source or "other", "other")

            # Fileshare → drop the ORIGINAL file in, original extension preserved.
            if it.source == "fileshare" and it.link:
                p = Path(it.link)
                if p.exists() and p.is_file():
                    try:
                        zf.write(p, _unique(f"{src}/{_safe_filename(p.name, 'file')}"))
                        continue
                    except Exception:
                        # Fall through to the text fallback if the copy fails.
                        pass

            # Email → re-fetch the raw RFC822 from IMAP and save as a real .eml.
            if it.source == "email" and it.record_id:
                raw = _fetch_email_raw(it)
                if raw:
                    base = _safe_filename(it.title or it.id, it.id)
                    arcname = _unique(f"{src}/{it.id}_{base}.eml")
                    zf.writestr(arcname, raw)
                    continue
                # If re-fetch fails (offline, creds rotated), fall back to the .txt rendering.

            # Everything else → write a .txt rendering of the item.
            base = _safe_filename(it.title or it.id, it.id)
            arcname = _unique(f"{src}/{it.id}_{base}.txt")
            zf.writestr(arcname, _text_blob(it))

    return buf.getvalue()
