"""
core/config.py
--------------
Where a connector's credentials come from.

Three sources, checked in this order:
  1. RUNTIME  — credentials typed into the UI popup (saved here, in memory + DB).
  2. DATABASE — persisted credentials from previous sessions.
  3. .env     — environment variables (the fallback / pre-seeded values).

On startup, credentials are loaded from the database into memory. When the UI
POSTs new credentials, they are saved to both memory and DB.
"""

import os

# connector_id -> { "KEY": "value", ... }
_RUNTIME: dict[str, dict] = {}

# keys whose values should never be sent back to the browser in full
SECRET_HINTS = ("PASSWORD", "SECRET", "KEY", "TOKEN")


def _db():
    """Lazy import to avoid circular imports at startup."""
    from services.credentials import save_creds, load_all_creds, load_creds
    return save_creds, load_all_creds, load_creds


def init_from_db() -> None:
    """Load all persisted credentials into memory on startup."""
    global _RUNTIME
    _, load_all, _ = _db()
    _RUNTIME = load_all()


def set_creds(conn_id: str, creds: dict) -> None:
    """Save credentials typed in the UI — to memory AND database."""
    store = _RUNTIME.setdefault(conn_id, {})
    clean = {}
    for k, v in creds.items():
        if v is not None and v != "":
            store[k] = v
            clean[k] = v
    if clean:
        save, _, _ = _db()
        save(conn_id, clean)


def get(conn_id: str, key: str, default: str = "") -> str:
    """Read one credential: runtime/DB value first, then .env, then default."""
    runtime = _RUNTIME.get(conn_id, {})
    if key in runtime:
        return runtime[key]
    return os.getenv(key, default)


def is_secret(key: str) -> bool:
    return any(h in key.upper() for h in SECRET_HINTS)


def masked_values(conn_id: str, field_keys: list[str]) -> dict:
    """Current values for prefilling the form. Secrets are masked to '••••'."""
    out = {}
    for key in field_keys:
        val = get(conn_id, key, "")
        if not val:
            out[key] = ""
        elif is_secret(key):
            out[key] = "••••••••"      # signal "already set" without leaking it
        else:
            out[key] = val
    return out
