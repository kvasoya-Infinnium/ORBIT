"""
agent/planner.py
----------------
STEP 1 of the agent: turn a plain-English question into a structured plan.

It asks OpenAI: "Given this question and these available connectors, which
connectors should we search, and what is the structured SearchQuery?" The model
replies in JSON, which we load into a SearchQuery.

If there is no OpenAI key (or the call fails), we fall back to a simple rule-based
planner so the demo still works offline.
"""

import os
import json

from core.connector import SearchQuery

PLAN_SYSTEM = """You route an eDiscovery query.
Given the user's question and the list of available connectors, return ONLY JSON:
{
  "connectors": ["id", ...],        // subset of the available connector ids
  "search": {
     "keywords": [...],
     "person": "name or null",
     "exact_value": "exact string or null",
     "date_from": "YYYY-MM-DD or null",
     "date_to": "YYYY-MM-DD or null"
  },
  "intent": "one short sentence"
}
Choose connectors intelligently: a salary/HR document lookup favors fileshare and s3;
"what did X say" favors email, slack, ai_chat; a CRM/contact/deal lookup favors zoho;
notes, docs, wiki, or knowledge base queries favor notion."""


async def plan(question: str, available_ids: list[str]) -> dict:
    """Return {connectors, search: SearchQuery, intent}."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        try:
            return await _plan_with_openai(question, available_ids, api_key)
        except Exception as e:
            print(f"[planner] OpenAI failed, using fallback: {e}")
    return _plan_fallback(question, available_ids)


async def _plan_with_openai(question: str, available_ids: list[str], api_key: str) -> dict:
    from openai import AsyncOpenAI
    # base_url lets you point at Azure OpenAI, a proxy, a regional host, or a local
    # server (Ollama/LM Studio). Blank/unset → the OpenAI default endpoint.
    base_url = os.getenv("OPENAI_BASE_URL") or None
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    resp = await client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": PLAN_SYSTEM},
            {"role": "user", "content": f"Question: {question}\nAvailable connectors: {available_ids}"},
        ],
    )
    raw = json.loads(resp.choices[0].message.content)
    chosen = [c for c in raw.get("connectors", []) if c in available_ids] or available_ids
    s = raw.get("search", {})
    query = SearchQuery(
        keywords=s.get("keywords") or [],
        person=s.get("person") or None,
        exact_value=s.get("exact_value") or None,
        date_from=s.get("date_from") or None,
        date_to=s.get("date_to") or None,
    )
    return {"connectors": chosen, "search": query, "intent": raw.get("intent", "")}


def _plan_fallback(question: str, available_ids: list[str]) -> dict:
    """No-OpenAI plan: search everything, guess person/number from the text."""
    import re
    words = question.split()
    # crude "exact value" = a standalone number like 65200
    number = next((w.strip(".,") for w in words if w.strip(".,").isdigit()), None)
    # crude "person" = two capitalized words in a row
    person = None
    m = re.search(r"\b([A-Z][a-z]+ [A-Z][a-z]+)\b", question)
    if m:
        person = m.group(1)
    keywords = [w for w in words if len(w) > 3 and w.lower() not in
                {"find", "show", "give", "what", "about", "every", "details", "related"}]
    return {
        "connectors": available_ids,
        "search": SearchQuery(keywords=keywords[:5], person=person, exact_value=number),
        "intent": "fallback plan (no OpenAI key)",
    }
