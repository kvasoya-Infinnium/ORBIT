"""
core/textutil.py
----------------
Small shared helpers used by several connectors.

- extract_text(filename, raw_bytes): pull plain text out of a PDF / DOCX / TXT / CSV.
- matches(text, query): decide whether some text is relevant to a SearchQuery.
- make_snippet(text, query): grab a short preview around the first match.

Both the Fileshare connector and the AWS S3 connector use these, so document
handling lives in exactly one place.
"""

import io
from core.connector import SearchQuery


def extract_text(filename: str, raw: bytes) -> str:
    """Best-effort plain-text extraction. Unknown/binary types return ""."""
    name = filename.lower()
    try:
        if name.endswith(".pdf"):
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(raw))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        if name.endswith(".docx"):
            import docx  # python-docx
            doc = docx.Document(io.BytesIO(raw))
            return "\n".join(p.text for p in doc.paragraphs)
        if name.endswith((".txt", ".csv", ".md", ".json", ".log")):
            return raw.decode("utf-8", errors="ignore")
    except Exception as e:
        return f"[could not extract text: {e}]"
    return ""  # unsupported type (image, zip, ...) -> no searchable text


def _terms(q: SearchQuery) -> list[str]:
    """All the things we should look for, as lowercase strings."""
    terms = [k.lower() for k in q.keywords]
    if q.person:
        terms.append(q.person.lower())
    if q.exact_value:
        terms.append(q.exact_value.lower())
    return terms


def matches(text: str, q: SearchQuery) -> bool:
    """True if the text contains ANY of the query terms. Empty query matches all."""
    terms = _terms(q)
    if not terms:
        return True
    hay = text.lower()
    return any(t in hay for t in terms)


def make_snippet(text: str, q: SearchQuery, width: int = 200) -> str:
    """Return a short preview, centered on the first matching term if we can find one."""
    if not text:
        return ""
    terms = _terms(q)
    low = text.lower()
    pos = -1
    for t in terms:
        pos = low.find(t)
        if pos != -1:
            break
    if pos == -1:
        return text[:width].strip()
    start = max(0, pos - width // 2)
    return text[start:start + width].strip()
