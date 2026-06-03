"""
core/models.py
----------------
This file defines the ONE shape that every connector must return its results in.

We call it the "Evidence Item". No matter where data comes from (Email, S3, Slack,
Zoho, a file on disk, or an AI chat), it always gets turned into this exact shape.

Why this matters: because everything looks the same, the AI agent, the UI, the
audit log, and the export all only have to understand ONE format. That is the
secret that makes ORBIT feel like a single product instead of six different tools.
"""

from typing import Optional
from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    # A stable, unique id for this item. Format: "<source>-<number>" e.g. "email-3".
    # The AI uses this exact id when it writes citations like [email-3].
    id: str

    # Which connector this came from: "fileshare" | "email" | "s3" | "slack" | "zoho" | "ai_chat"
    source: str

    # A human-friendly label for the source, e.g. "Email (IMAP)" — shown in the UI.
    source_label: str

    # The native id in the source system (email UID, S3 key, Slack ts, Zoho record id...).
    record_id: str

    # The headline: email subject, file name, chat title, CRM contact name, etc.
    title: str

    # A short preview (a sentence or two) shown in the result list.
    snippet: str

    # The full extracted text. This is what the AI actually reads, and what export saves.
    content: str

    # Who made/owns it: sender, file owner, message author, record owner.
    author: Optional[str] = None

    # Other people involved: email to/cc, chat participants, etc.
    participants: list[str] = Field(default_factory=list)

    # When it happened, in ISO 8601 format ("2026-05-01T14:30:00").
    timestamp: Optional[str] = None

    # A link or file path back to the original — this is the "provenance" (proof of origin).
    link: Optional[str] = None

    # Anything extra that only this source has. Free-form bag of extra fields.
    metadata: dict = Field(default_factory=dict)
