"""
agent/synthesizer.py
--------------------
STEP 5 of the agent: write the final answer.

It feeds the top Evidence Items to OpenAI and asks for a concise answer that cites
each claim using the item's id in square brackets, e.g. [fileshare-1]. The frontend
turns those brackets into clickable links, so citations are REAL, not decorative.

If there is no OpenAI key, we produce a simple non-AI summary so the demo still runs.
"""

import os
from core.models import EvidenceItem

SYNTH_SYSTEM = """Answer the user's question using ONLY the provided evidence items.
Cite every claim with the item id in square brackets, exactly like [email-3] or
[fileshare-1]. Use the ids exactly as given. If nothing is relevant, say so plainly.
Be concise; this is for legal/compliance review."""


async def synthesize(question: str, items: list[EvidenceItem]) -> str:
    if not items:
        return "No relevant evidence was found across the selected connectors."

    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        try:
            return await _synth_with_openai(question, items, api_key)
        except Exception as e:
            print(f"[synthesizer] OpenAI failed, using fallback: {e}")
    return _synth_fallback(items)


def _format_items(items: list[EvidenceItem]) -> str:
    lines = []
    for it in items:
        lines.append(f"[{it.id}] source={it.source} title={it.title!r} "
                     f"author={it.author} date={it.timestamp}\n{it.content[:600]}")
    return "\n\n".join(lines)


async def _synth_with_openai(question: str, items: list[EvidenceItem], api_key: str) -> str:
    from openai import AsyncOpenAI
    # base_url lets you point at Azure OpenAI, a proxy, a regional host, or a local
    # server (Ollama/LM Studio). Blank/unset → the OpenAI default endpoint.
    base_url = os.getenv("OPENAI_BASE_URL") or None
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYNTH_SYSTEM},
            {"role": "user", "content": f"Question: {question}\n\nEvidence items:\n{_format_items(items)}"},
        ],
    )
    return resp.choices[0].message.content


def _synth_fallback(items: list[EvidenceItem]) -> str:
    bullets = "\n".join(f"- {it.title} ({it.source}) [{it.id}]" for it in items[:10])
    return (f"Found {len(items)} item(s) across the selected connectors:\n{bullets}\n\n"
            f"(AI summary unavailable — no OpenAI key set; showing raw matches.)")
