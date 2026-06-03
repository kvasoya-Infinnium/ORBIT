"""
agent/pipeline.py
-----------------
The conductor. This runs the whole agent flow end to end:

  1. PLAN      - ask the planner which connectors + what SearchQuery (agent/planner.py)
  2. FAN-OUT   - call all chosen connectors AT THE SAME TIME (asyncio.gather)
  3. NORMALIZE - connectors already return EvidenceItems, so nothing to do here
  4. RANK/DEDUPE - drop duplicates, score by relevance + recency, keep the top N
  5. SYNTHESIZE - ask the synthesizer to write the cited answer (agent/synthesizer.py)

Fault tolerance: each connector call is wrapped so a slow/broken connector returns
an empty list instead of killing the whole query. The others still answer.
"""

import asyncio
from datetime import datetime

from core.connector import SearchQuery, Connector
from core.models import EvidenceItem
from core import registry
from agent import planner, synthesizer


async def _safe_search(conn: Connector, q: SearchQuery) -> tuple[str, list[EvidenceItem], str]:
    """Run one connector's search but never let it raise. Returns (id, items, error)."""
    try:
        items = await conn.search(q)
        # re-id items so they are globally unique (per instance) and match citations
        for i, it in enumerate(items, start=1):
            it.id = f"{conn.instance_id}-{i}"
        return conn.instance_id, items, ""
    except Exception as e:
        return conn.instance_id, [], str(e)


def _score(item: EvidenceItem, q: SearchQuery) -> float:
    """Simple relevance score: term overlap + a small recency bonus."""
    text = (item.title + " " + item.content).lower()
    terms = [t.lower() for t in q.keywords]
    if q.person:
        terms.append(q.person.lower())
    if q.exact_value:
        terms.append(q.exact_value.lower())
    score = sum(text.count(t) for t in terms) if terms else 1.0
    # recency bonus (newer = slightly higher)
    if item.timestamp:
        try:
            age_days = (datetime.now().astimezone() -
                        datetime.fromisoformat(item.timestamp)).days
            score += max(0.0, 1.0 - age_days / 365.0)
        except Exception:
            pass
    return score


async def run_query(question: str, connector_ids: list[str], synth_n: int = 15) -> dict:
    """The single entry point the API calls for POST /query.
    connector_ids are INSTANCE ids (e.g. 'fileshare_1', 'fileshare_2').

    Important design point: we DECOUPLE what the user sees from what the LLM reads.
      • The UI gets EVERY matched item (ranked) — showing items costs no tokens.
      • The LLM only gets the top `synth_n` items for the written summary — so token
        cost stays fixed no matter how many matches there are.
    """
    available = [c.instance_id for c in registry.all_instances() if c.instance_id in connector_ids]

    # 1. PLAN
    plan = await planner.plan(question, available)
    chosen_ids = plan["connectors"]
    query: SearchQuery = plan["search"]

    # 2. FAN-OUT (parallel)
    conns = registry.enabled_instances(chosen_ids)
    results = await asyncio.gather(*[_safe_search(c, query) for c in conns])

    # collect + remember which connectors errored / how many each returned
    items: list[EvidenceItem] = []
    per_connector: dict[str, dict] = {}
    for conn_id, conn_items, error in results:
        per_connector[conn_id] = {"count": len(conn_items), "error": error}
        items.extend(conn_items)

    # 4. DEDUPE (by id) + RANK
    seen = set()
    deduped = []
    for it in items:
        if it.id in seen:
            continue
        seen.add(it.id)
        deduped.append(it)
    deduped.sort(key=lambda it: _score(it, query), reverse=True)

    # 5. SYNTHESIZE — the LLM only reads the top slice (fixed token cost); the UI and
    #    the export still receive the FULL ranked list (`deduped`).
    top_for_llm = deduped[:synth_n]
    answer = await synthesizer.synthesize(question, top_for_llm, total_found=len(deduped))

    return {
        "answer": answer,
        "items": deduped,              # everything found, ranked — for the UI + export
        "synth_count": len(top_for_llm),  # how many the AI summary was based on
        "total_found": len(deduped),
        "intent": plan["intent"],
        "planned_query": query.model_dump(),
        "per_connector": per_connector,
    }
