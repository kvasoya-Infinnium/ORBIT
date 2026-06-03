"""
main.py
-------
The FastAPI web server. This is the front door of the backend: the React UI talks
to these HTTP endpoints.

Endpoints:
  GET  /connectors              -> list connectors + status + credential field defs
  POST /connectors/{id}/connect -> save credentials from the UI popup, then test
  POST /connectors/{id}/test    -> re-test one connector's connection
  POST /query                  -> the big one: run the agent over chosen connectors
  GET  /audit                  -> list every past query (defensibility view)
  POST /export                 -> download a query's results as CSV or JSON
  GET  /health                 -> simple "is it alive" check

Run it with:   uvicorn main:app --reload
"""

import os
import json
import asyncio
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()  # read the .env file into environment variables

from core import registry, config
from core.connector import ConnectionStatus
from core.models import EvidenceItem
from agent import pipeline
from services import audit, export, credentials

# Register every connector TYPE (a template). Instances are created on demand
# from the UI: dragging a type onto the canvas (or picking it from the Add menu)
# spawns a fresh instance and drops it into the orbit.
from connectors.fileshare import FileshareConnector
from connectors.email_imap import EmailConnector
from connectors.aws_s3 import S3Connector
from connectors.slack import SlackConnector
from connectors.zoho_crm import ZohoCRMConnector
from connectors.ai_chat import AIChatConnector
from connectors.notion import NotionConnector
from connectors.azure_blob import AzureBlobConnector

for cls in (FileshareConnector, EmailConnector, S3Connector,
            SlackConnector, ZohoCRMConnector, AIChatConnector, NotionConnector,
            AzureBlobConnector):
    registry.register_type(cls)

# Make sure the audit table exists as soon as the app is imported.
audit.init_db()
# Load persisted credentials from DB into memory.
config.init_from_db()

# ------------------------------------------------------------------------------
app = FastAPI(title="ORBIT — Unified Discovery Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # demo only; lock this down for production
    allow_methods=["*"],
    allow_headers=["*"],
)

# A tiny in-memory cache so /export can reproduce a recent query's items.
_RESULTS_CACHE: dict[str, list[EvidenceItem]] = {}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/browse")
def browse_folders(path: str = ""):
    """List folders at a given path for the in-app file browser. Works for any remote client."""
    from pathlib import Path
    import platform

    if not path:
        if platform.system() == "Windows":
            import string
            drives = []
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if Path(drive).exists():
                    drives.append({"name": drive, "path": drive, "is_dir": True})
            return {"current": "", "parent": None, "items": drives}
        else:
            path = "/"

    p = Path(path)
    if not p.exists():
        raise HTTPException(404, f"Path not found: {path}")

    items = []
    try:
        for child in sorted(p.iterdir()):
            if child.name.startswith("."):
                continue
            try:
                is_dir = child.is_dir()
            except PermissionError:
                continue
            items.append({"name": child.name, "path": str(child.resolve()), "is_dir": is_dir})
    except PermissionError:
        pass

    return {
        "current": str(p.resolve()),
        "parent": str(p.parent.resolve()) if p.parent != p else None,
        "items": items,
    }


async def _instance_dto(conn) -> dict:
    """The JSON shape the UI expects for one connector instance.
    The connection test is wrapped in a short timeout so one slow/hanging source
    (e.g. an IMAP login) can't stall the whole connector list."""
    try:
        status = await asyncio.wait_for(conn.test_connection(), timeout=6)
    except Exception:
        status = ConnectionStatus(connected=False, detail="connection check timed out")
    field_keys = [f["key"] for f in conn.fields]
    return {
        "id": conn.instance_id,        # unique per instance, e.g. "fileshare_2"
        "type_id": conn.id,            # the type, e.g. "fileshare"
        "name": conn.label,            # the editable display name
        "icon": conn.icon,
        "connected": status.connected,
        "detail": status.detail,
        "fields": conn.fields,
        "values": config.masked_values(conn.instance_id, field_keys),
    }


@app.get("/connector-types")
def connector_types():
    """The catalog for the 'Add a connector' menu."""
    return registry.list_types()


@app.get("/connectors")
async def list_connectors():
    """Every connector INSTANCE with its status, fields, and saved (masked) values.
    Connection tests run in PARALLEL so the list returns quickly even with many
    live connectors."""
    return list(await asyncio.gather(*[_instance_dto(c) for c in registry.all_instances()]))


@app.post("/connectors")
async def add_connector(body: dict = Body(default={})):
    """Create a new instance of a connector type (e.g. a second Fileshare)."""
    type_id = body.get("type_id")
    if type_id not in registry.TYPES:
        raise HTTPException(400, "Unknown connector type")
    conn = registry.create_instance(type_id, label=body.get("label"))
    return await _instance_dto(conn)


@app.delete("/connectors/{instance_id}")
def delete_connector(instance_id: str):
    """Remove a connector instance."""
    if not registry.get(instance_id):
        raise HTTPException(404, "Unknown connector instance")
    registry.remove_instance(instance_id)
    credentials.delete_connector_creds(instance_id)
    return {"removed": instance_id}


@app.post("/connectors/{instance_id}/test")
async def test_connector(instance_id: str):
    conn = registry.get(instance_id)
    if not conn:
        raise HTTPException(404, "Unknown connector instance")
    status = await conn.test_connection()
    return {"id": instance_id, "connected": status.connected, "detail": status.detail}


@app.post("/connectors/{instance_id}/connect")
async def connect_connector(instance_id: str, creds: dict = Body(default={})):
    """Save credentials typed into the UI popup, then test the connection.
    A "label" key (if present) renames the instance. Masked values ('••••') are
    ignored so we don't overwrite real secrets already stored."""
    conn = registry.get(instance_id)
    if not conn:
        raise HTTPException(404, "Unknown connector instance")
    label = creds.pop("label", None)
    if label:
        conn.label = label
    clean = {k: v for k, v in creds.items() if v and not str(v).startswith("••")}
    config.set_creds(instance_id, clean)
    status = await conn.test_connection()
    return {"id": instance_id, "connected": status.connected, "detail": status.detail}


class QueryBody(BaseModel):
    question: str
    connector_ids: list[str]
    user: str = "demo.user"


@app.post("/query")
async def query(body: QueryBody):
    """Run the full agent pipeline and log the query to the audit store."""
    result = await pipeline.run_query(body.question, body.connector_ids)
    items: list[EvidenceItem] = result["items"]
    items_dumped = [it.model_dump() for it in items]

    query_id = audit.record_query(
        user=body.user,
        question=body.question,
        connectors=body.connector_ids,
        item_ids=[it.id for it in items],
        answer=result["answer"],
        per_connector=result["per_connector"],
        items_json=json.dumps(items_dumped),
    )
    _RESULTS_CACHE[query_id] = items

    # Snapshot which credentials were used for this query
    credentials.snapshot_for_query(query_id, body.connector_ids)

    return {
        "query_id": query_id,
        "question": body.question,
        "answer": result["answer"],
        "items": items_dumped,
        "synth_count": result["synth_count"],
        "total_found": result["total_found"],
        "intent": result["intent"],
        "planned_query": result["planned_query"],
        "per_connector": result["per_connector"],
    }


@app.get("/audit")
def get_audit():
    return audit.list_queries()


@app.get("/history/{query_id}")
def get_history_detail(query_id: str):
    """Get full details of a past query for the history view."""
    row = audit.get_query(query_id)
    if not row:
        raise HTTPException(404, "Query not found.")
    # Remove large fields from the detail view
    row.pop("items_json", None)
    row.pop("item_ids", None)
    # Include which credentials (masked) were used
    raw_creds = credentials.get_query_creds(query_id)
    masked = {}
    for conn_id, cred_dict in raw_creds.items():
        masked[conn_id] = {
            k: ("••••••••" if config.is_secret(k) else v)
            for k, v in cred_dict.items()
        }
    row["credentials_used"] = masked
    return row


@app.post("/history/{query_id}/rebind")
def rebind_from_history(query_id: str):
    """Fetch the stored results of a past query from the database (no re-run)."""
    row = audit.get_query(query_id)
    if not row:
        raise HTTPException(404, "Query not found.")

    # Parse stored data
    items = json.loads(row.get("items_json") or "[]")
    per_connector = json.loads(row.get("per_connector") or "{}")
    connector_ids = [c.strip() for c in row["connectors"].split(",") if c.strip()]

    # Trim content to avoid oversized responses
    for item in items:
        if item.get("content") and len(item["content"]) > 1000:
            item["content"] = item["content"][:1000] + "…"

    # Re-apply credentials so connectors stay configured
    creds_map = credentials.get_query_creds(query_id)
    for conn_id, cred_dict in creds_map.items():
        config.set_creds(conn_id, cred_dict)

    return {
        "query_id": query_id,
        "question": row.get("question", ""),
        "answer": row.get("answer", ""),
        "items": items,
        "synth_count": min(15, len(items)),
        "total_found": len(items),
        "per_connector": per_connector,
        "rebound_connectors": connector_ids,
    }


class ExportBody(BaseModel):
    query_id: str
    format: str = "csv"   # "csv" | "json"


@app.post("/export")
def do_export(body: ExportBody):
    items = _RESULTS_CACHE.get(body.query_id)
    if items is None:
        raise HTTPException(404, "No cached results for that query_id (re-run the query).")
    if body.format == "json":
        return PlainTextResponse(export.to_json(items), media_type="application/json")
    return PlainTextResponse(export.to_csv(items), media_type="text/csv")
