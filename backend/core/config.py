"""
core/config.py
--------------
Where a connector's credentials come from.

Two sources, checked in this order:
  1. RUNTIME  — credentials typed into the UI popup (saved here, in memory).
  2. .env     — environment variables (the fallback / pre-seeded values).

This is what lets the UI "Connect" popup work: the frontend POSTs credentials,
we store them here, and the connector immediately starts using them — no restart,
no editing files.

Note: runtime creds live in memory only (cleared on restart). That's fine for a
hackathon demo. A production version would encrypt and persist them.
"""

import os

# connector_id -> { "KEY": "value", ... }
_RUNTIME: dict[str, dict] = {}

# keys whose values should never be sent back to the browser in full
SECRET_HINTS = ("PASSWORD", "SECRET", "KEY", "TOKEN")


def set_creds(conn_id: str, creds: dict) -> None:
    """Save credentials typed in the UI for one connector."""
    store = _RUNTIME.setdefault(conn_id, {})
    for k, v in creds.items():
        if v is not None and v != "":
            store[k] = v


def get(conn_id: str, key: str, default: str = "") -> str:
    """Read one credential: runtime value first, then .env, then default."""
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
