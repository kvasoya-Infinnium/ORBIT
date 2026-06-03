"""
connectors/email_imap.py
------------------------
Searches an email mailbox over IMAP (works with Gmail, Outlook, etc.).

IMPORTANT for Gmail/Outlook: use an APP PASSWORD with IMAP enabled, not your real
login password. Test the exact account the night before the hackathon.

It translates our SearchQuery into IMAP's own SEARCH language, fetches the matching
messages, and parses them into EvidenceItems with Python's built-in email tools.

Config (.env):
  IMAP_HOST=imap.gmail.com
  IMAP_PORT=993
  IMAP_USER=demo.account@gmail.com
  IMAP_PASSWORD=app-password-here
"""

import email
import imaplib
from email.header import decode_header
from email.utils import parsedate_to_datetime

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import config


def _decode(value: str | None) -> str:
    """Email headers can be encoded (e.g. =?UTF-8?...). Turn them into normal text."""
    if not value:
        return ""
    parts = decode_header(value)
    out = ""
    for text, enc in parts:
        if isinstance(text, bytes):
            out += text.decode(enc or "utf-8", errors="ignore")
        else:
            out += text
    return out


def _imap_date(iso: str | None) -> str | None:
    """IMAP wants dates like '01-May-2026'. Convert from our ISO date if present."""
    if not iso:
        return None
    from datetime import datetime
    try:
        d = datetime.fromisoformat(iso[:10])
        return d.strftime("%d-%b-%Y")
    except Exception:
        return None


class EmailConnector(Connector):
    id = "email"
    name = "Email (IMAP)"
    icon = "✉️"
    fields = [
        {"key": "IMAP_HOST", "label": "IMAP host", "type": "text", "placeholder": "imap.gmail.com"},
        {"key": "IMAP_PORT", "label": "Port", "type": "text", "placeholder": "993"},
        {"key": "IMAP_USER", "label": "Email address", "type": "text", "placeholder": "you@gmail.com"},
        {"key": "IMAP_PASSWORD", "label": "App password", "type": "password", "placeholder": "16-char app password"},
    ]

    @property
    def host(self): return config.get(self.instance_id, "IMAP_HOST", "imap.gmail.com")
    @property
    def port(self): return int(config.get(self.instance_id, "IMAP_PORT", "993") or "993")
    @property
    def user(self): return config.get(self.instance_id, "IMAP_USER", "")
    @property
    def password(self): return config.get(self.instance_id, "IMAP_PASSWORD", "")

    def _connect(self) -> imaplib.IMAP4_SSL:
        m = imaplib.IMAP4_SSL(self.host, self.port)
        m.login(self.user, self.password)
        return m

    async def test_connection(self) -> ConnectionStatus:
        if not self.user or not self.password:
            return ConnectionStatus(connected=False, detail="Missing IMAP_USER / IMAP_PASSWORD")
        try:
            m = self._connect()
            m.logout()
            return ConnectionStatus(connected=True, detail=f"Logged in as {self.user}")
        except Exception as e:
            return ConnectionStatus(connected=False, detail=str(e))

    def _build_criteria(self, q: SearchQuery) -> str:
        """Turn our SearchQuery into an IMAP SEARCH string."""
        parts: list[str] = []
        if q.person:
            # match the person as sender OR recipient
            parts.append(f'(OR FROM "{q.person}" TO "{q.person}")')
        for kw in q.keywords:
            parts.append(f'TEXT "{kw}"')
        if q.exact_value:
            parts.append(f'BODY "{q.exact_value}"')
        d_from = _imap_date(q.date_from)
        d_to = _imap_date(q.date_to)
        if d_from:
            parts.append(f'SINCE {d_from}')
        if d_to:
            parts.append(f'BEFORE {d_to}')
        return "(" + " ".join(parts) + ")" if parts else "ALL"

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        results: list[EvidenceItem] = []
        m = self._connect()
        try:
            m.select("INBOX")
            typ, data = m.search(None, self._build_criteria(q))
            if typ != "OK":
                return results
            uids = data[0].split()[: q.limit]
            for n, uid in enumerate(uids, start=1):
                typ, msg_data = m.fetch(uid, "(RFC822)")
                if typ != "OK":
                    continue
                msg = email.message_from_bytes(msg_data[0][1])
                subject = _decode(msg.get("Subject"))
                sender = _decode(msg.get("From"))
                to = _decode(msg.get("To"))
                cc = _decode(msg.get("Cc"))
                participants = [p for p in (to + "," + cc).split(",") if p.strip()]
                # timestamp
                ts = None
                try:
                    ts = parsedate_to_datetime(msg.get("Date")).isoformat()
                except Exception:
                    pass
                body = self._get_body(msg)
                results.append(EvidenceItem(
                    id=f"{self.instance_id}-{n}",
                    source=self.id,
                    source_label=self.label,
                    record_id=uid.decode(),
                    title=subject or "(no subject)",
                    snippet=body[:200].strip(),
                    content=body,
                    author=sender,
                    participants=participants,
                    timestamp=ts,
                    link=f"imap://{self.user}/INBOX/{uid.decode()}",
                    metadata={"to": to, "cc": cc},
                ))
        finally:
            try:
                m.logout()
            except Exception:
                pass
        return results

    def _get_body(self, msg) -> str:
        """Pull the plain-text body out of an email (skips attachments/HTML where possible)."""
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                disp = str(part.get("Content-Disposition") or "")
                if ctype == "text/plain" and "attachment" not in disp:
                    payload = part.get_payload(decode=True) or b""
                    return payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
            return ""
        payload = msg.get_payload(decode=True) or b""
        return payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")
