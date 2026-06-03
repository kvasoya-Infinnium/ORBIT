"""
services/audit.py
-----------------
The audit log = the "defensibility" feature.

Every time someone runs a query we write one row to a tiny SQLite database:
who ran it, when, the question, which connectors, how many results, and the exact
item ids returned. That last bit lets us reproduce an export later, which is what
"legal hold / eDiscovery" requires.

SQLite is built into Python — no server to install.
"""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "nexus.db"


_SCHEMA = """
    CREATE TABLE IF NOT EXISTS audit (
        query_id      TEXT PRIMARY KEY,
        user          TEXT,
        question      TEXT,
        connectors    TEXT,
        result_count  INTEGER,
        item_ids      TEXT,
        created_at    TEXT
    )
"""


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    # Self-healing: make sure the table exists on EVERY connection. This way a query
    # can never fail with "no such table", regardless of startup order or a deleted
    # database file. CREATE TABLE IF NOT EXISTS is cheap.
    c.execute(_SCHEMA)
    return c


def init_db() -> None:
    """Create the audit table (also done lazily by _conn, kept for explicit startup)."""
    with _conn() as c:
        c.execute(_SCHEMA)


def record_query(user: str, question: str, connectors: list[str],
                 item_ids: list[str]) -> str:
    """Write one audit row and return its query_id."""
    query_id = str(uuid.uuid4())[:8]
    with _conn() as c:
        c.execute(
            "INSERT INTO audit VALUES (?,?,?,?,?,?,?)",
            (query_id, user, question, ",".join(connectors),
             len(item_ids), json.dumps(item_ids), datetime.now().isoformat()),
        )
    return query_id


def list_queries() -> list[dict]:
    """All past queries, newest first — powers the Audit page."""
    with _conn() as c:
        rows = c.execute("SELECT * FROM audit ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def get_query(query_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM audit WHERE query_id=?", (query_id,)).fetchone()
    return dict(row) if row else None
