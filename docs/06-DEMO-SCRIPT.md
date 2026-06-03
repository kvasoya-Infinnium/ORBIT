# 06 — Demo script (what to say to the judges)

You have ~3 minutes. Tell a story, don't list features. Suggested arc: **an internal
investigation**.

## Before you start (checklist)
- [ ] Backend running (`uvicorn main:app --reload`) — check http://localhost:8000/health
- [ ] Frontend running (`npm run dev`) — open http://localhost:5173
- [ ] In the left rail, Fileshare + GPT/AI-Chat show a green dot (connected)
- [ ] Drag both onto the canvas so they're in the ORBIT before you present
- [ ] You've run each demo query ONCE already (warms it up; pre-caches if using OpenAI)
- [ ] A backup screen-recording exists in case the network dies on stage

## The 30-second pitch (say this first)
> "In any company, information about a person or a case is scattered across email,
> chat, files, CRMs. Finding *everything* means logging into five systems and stitching
> results by hand. ORBIT connects them all behind one AI agent: you ask once in plain
> English, it searches everywhere at the same time, and every answer is cited back to
> its exact source — which is what makes it usable as legal evidence."

## The demo (run these live)

**1. Unstructured search — "everything about a person"**
> Type: **"Find everything related to Rudra Raval"**
- Point at the per-connector status line ("fileshare: 2, ai_chat: 1…").
- Point at the answer and **click a citation** — "notice this isn't decoration, it
  jumps to the actual source document."

**2. Structured search — a precise data lookup**
> Type: **"Give me employee details for salary 65200"**
- "The agent recognized this is a structured lookup and searched the HR documents."
- Show the matching record(s) with the salary highlighted in the snippet.

**3. Export — the eDiscovery payoff**
- Click **Export CSV**. "That's a review set a legal team can hand off — a real
  deliverable, not just a chat answer."

**4. Audit — defensibility**
- Go to the **Audit** page. "Every search we just ran is logged: who, when, what,
  how many results. That's the *defensibility* eDiscovery legally requires."

## The closing line (the "why it's a product" slide)
> "Three things make this a real eDiscovery product, not a chat demo: **citations**
> on every result, an **audit trail** of every query, and a **normalized evidence
> schema** so anything exports together. And the architecture is pluggable — every
> source is one connector class, so adding Jira or Salesforce is a day's work, not a
> rewrite. The AI brain is swappable too."

## If something breaks (stay calm)
- A connector errors live → that's fine, the others still answer. Say: *"notice one
  connector failed and the query still returned — fault-tolerant by design."*
- OpenAI is slow/down → the fallback still returns matches; or play the backup recording.
- Nothing returns → check you enabled connectors on the Connectors page and that the
  backend terminal shows no startup error.

## Questions judges love to ask (have answers ready)
- *"How do you add a new source?"* → "One new class implementing the Connector
  interface. Show `connectors/slack.py` as the template."
- *"Is the AI making things up?"* → "It can only cite the evidence items we pass it,
  and every citation links to the real source. No source, not shown."
- *"Does this scale?"* → "Today we search on demand; production would pre-index into
  something like SQLite FTS5 or a search engine. Architecture doesn't change."
