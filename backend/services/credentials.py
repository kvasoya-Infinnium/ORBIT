"""
services/credentials.py
-----------------------
Persistent credential storage in SQLite.

Two tables:
  - `credentials`: stores the latest credentials per connector (survives restarts)
  - `query_credentials`: snapshots which connector + creds were used per query_id
    so history queries can be re-bound later.
"""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "nexus.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("""
        CREATE TABLE IF NOT EXISTS credentials (
            connector_id  TEXT NOT NULL,
            key           TEXT NOT NULL,
            value         TEXT NOT NULL,
            updated_at    TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (connector_id, key)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS query_credentials (
            query_id      TEXT NOT NULL,
            connector_id  TEXT NOT NULL,
            creds_json    TEXT NOT NULL,
            created_at    TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (query_id, connector_id)
        )
    """)
    return c


def save_creds(connector_id: str, creds: dict) -> None:
    """Persist credentials for a connector (upsert each key)."""
    with _conn() as c:
        for key, value in creds.items():
            if value is not None and value != "":
                c.execute(
                    "INSERT OR REPLACE INTO credentials (connector_id, key, value) VALUES (?,?,?)",
                    (connector_id, key, str(value)),
                )


def load_creds(connector_id: str) -> dict:
    """Load all stored credentials for a connector."""
    with _conn() as c:
        rows = c.execute(
            "SELECT key, value FROM credentials WHERE connector_id=?",
            (connector_id,),
        ).fetchall()
    return {r["key"]: r["value"] for r in rows}


def load_all_creds() -> dict[str, dict]:
    """Load credentials for all connectors. Returns {connector_id: {key: value}}."""
    with _conn() as c:
        rows = c.execute("SELECT connector_id, key, value FROM credentials").fetchall()
    result: dict[str, dict] = {}
    for r in rows:
        result.setdefault(r["connector_id"], {})[r["key"]] = r["value"]
    return result


def snapshot_for_query(query_id: str, connector_ids: list[str]) -> None:
    """Record which credentials were active for each connector at query time."""
    with _conn() as c:
        for conn_id in connector_ids:
            creds = load_creds(conn_id)
            if creds:
                c.execute(
                    "INSERT OR REPLACE INTO query_credentials (query_id, connector_id, creds_json) VALUES (?,?,?)",
                    (query_id, conn_id, json.dumps(creds)),
                )


def get_query_creds(query_id: str) -> dict[str, dict]:
    """Get the credential snapshot for a past query. Returns {connector_id: {key: value}}."""
    with _conn() as c:
        rows = c.execute(
            "SELECT connector_id, creds_json FROM query_credentials WHERE query_id=?",
            (query_id,),
        ).fetchall()
    return {r["connector_id"]: json.loads(r["creds_json"]) for r in rows}


def delete_connector_creds(connector_id: str) -> None:
    """Remove all stored credentials for a connector."""
    with _conn() as c:
        c.execute("DELETE FROM credentials WHERE connector_id=?", (connector_id,))
