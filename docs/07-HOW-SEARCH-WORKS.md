# 07 — How search works (the agent, step by step)

This is the "what actually happens when I press Run" document. It explains the whole
pipeline in plain words: how a question becomes a plan, how each connector searches,
how results are ranked and de-duplicated, and **how the AI token cost stays small no
matter how big your data is.**

The code for all of this lives in `backend/agent/` (the brain) and
`backend/connectors/` (the searchers).

---

## The big picture

```
Your question: "emails about Rudra Raval"
        │
        ▼
① PLAN  ──► LLM call #1
            Sees ONLY: your question + the list of connector names (~200 tokens)
            Returns:   { keywords:[...], person:"Rudra Raval" }   ← a search plan
        │
        ▼
② SEARCH ──► PLAIN PYTHON, no LLM at all
            Each connector searches its own system and returns matches.
            A million files → filtered down to a handful of matches.
            ZERO tokens used here.
        │
        ▼
③ NORMALISE ──► every match becomes one common "Evidence Item"
        │
        ▼
④ RANK & DEDUPE ──► Python sorting + duplicate removal, no LLM
        │
        ▼
⑤ SYNTHESIZE ──► LLM call #2
            Sees ONLY: your question + the TOP 15 matches,
            each truncated to ~600 characters.   (~2,000–3,000 tokens, fixed)
        │
        ▼
   Answer (with citations)  +  full ranked evidence list  +  audit row
```

**The one sentence to remember:** the LLM is used only at the **start** (to plan) and
the **end** (to write the answer). All the heavy lifting — reading and matching your
documents — is done by ordinary Python in the middle, and uses **no tokens**.

---

## Step ① PLAN — turn English into a search (LLM call #1)

File: `agent/planner.py`

The planner sends the model a tiny prompt: your question + the list of connector ids.
It gets back JSON describing **what to search for**:

```json
{
  "connectors": ["email_1", "ai_chat_1"],
  "search": { "keywords": ["data breach"], "person": "Rudra Raval",
              "exact_value": null, "date_from": null, "date_to": null },
  "intent": "find communications mentioning a person"
}
```

This becomes a `SearchQuery` object (defined in `core/connector.py`). Note how small
this call is — it never contains any of your documents, just the question. ~200 tokens.

> **No OpenAI key?** `planner.py` falls back to a simple rule: it pulls a number out
> of the text (e.g. `65200` → `exact_value`), a capitalised name (`Rudra Raval` →
> `person`), and the remaining words as keywords. Everything still works offline.

---

## Step ② SEARCH — each connector searches its own system (no LLM)

File: every file in `connectors/`. This is run **in parallel** across the connectors
you put in the orbit (`asyncio.gather` in `agent/pipeline.py`).

Each connector translates the same `SearchQuery` into whatever its system understands:

| Connector | How it actually searches |
|---|---|
| 📁 **Fileshare** | Walks the folder(s), extracts text from each file (PDF/DOCX/TXT), and keeps files whose **text or filename contains** a search term. Plain substring match. |
| 🪣 **AWS S3** | Same as Fileshare, but lists objects in the bucket and downloads each one. Reuses the exact same text-extraction + matching helper. |
| ✉️ **Email (IMAP)** | Builds a native **IMAP `SEARCH`** command (`FROM`/`TO`/`TEXT`/`SINCE`…) — the mail **server** does the filtering and only returns matching messages. |
| 💬 **Slack** | If you have a user token, calls Slack's `search.messages` API (the server searches). With a bot token, it reads channel history and filters in Python. |
| 🧾 **Zoho CRM** | Calls Zoho's `/search` API with the term — the CRM does the matching server-side. |
| 🤖 **GPT / AI Chat** | Loads conversations (local JSON or the Compliance API) and filters them in Python by term. |

### The matching rule (Fileshare / S3 / AI-Chat)

File: `core/textutil.py`, function `matches()`. It is deliberately simple:

```python
# lower-cased substring check — true if the text contains ANY search term
hay = text.lower()
return any(term in hay for term in terms)   # terms = keywords + person + exact_value
```

So for *"Rudra Raval"* it literally checks `"rudra raval" in file_text`. No AI, no
embeddings — just fast string matching, one file at a time. This is why a million
files costs **zero tokens**: the model never sees them.

Each connector stops once it has collected `limit` matches (currently **200**, set in
`core/connector.py`) so a single query can't run forever.

---

## Step ③ NORMALISE — one shape for everything

File: `core/models.py` (the `EvidenceItem`).

Every match — an email, an S3 file, a Slack message, a CRM record — is converted into
the **same** record: `id, source, title, snippet, content, author, timestamp, link…`.
Because everything looks identical from here on, ranking, the UI, the audit log and the
export only have to understand **one** format. (Connectors build these directly, so
this step is "free".)

The `snippet` is made by `make_snippet()` in `core/textutil.py`: it finds the first
place a search term appears and grabs ~200 characters around it, so the preview shows
*why* the item matched.

---

## Step ④ RANK & DEDUPE — order the matches (no LLM)

File: `agent/pipeline.py`.

**Dedupe:** items are unique by their `id` (`source + record number`), so the same
thing can't appear twice.

**Rank:** every item gets a relevance **score** and the list is sorted highest-first.
The scoring function (`_score`) is plain Python:

```python
text  = (title + " " + content).lower()
terms = keywords + person + exact_value

# 1) how many times do the search terms appear?  (term frequency)
score = sum(text.count(term) for term in terms)

# 2) small recency bonus: newer items score slightly higher (up to +1.0,
#    fading to 0 over one year)
score += max(0.0, 1.0 - age_in_days / 365.0)
```

In words:
- **The more often your search words appear** in an item, the higher it ranks.
- **Newer items get a small boost**, so recent evidence floats up when scores tie.

It's intentionally simple and explainable (good for a compliance tool — you can say
exactly *why* something ranked where it did). A production version might add semantic
/ embedding similarity here, but the interface wouldn't change.

---

## Step ⑤ SYNTHESIZE — write the cited answer (LLM call #2)

File: `agent/synthesizer.py`.

Only now does the model see any content — and only a **small, fixed slice**:
- the **top 15** ranked items (`synth_n` in `pipeline.py`),
- each item **truncated to ~600 characters** (`it.content[:600]`).

The system prompt tells it: *answer using ONLY these items, and cite every claim with
the item id in brackets like `[fileshare_1-3]`.* The frontend turns each `[id]` into a
clickable link to that evidence card — so citations are real, not decoration.

> **No OpenAI key?** The synthesizer falls back to simply listing the matches.

---

## Why your token cost is bounded (the important part)

The LLM only ever sees: **the question** + **15 short snippets**. It never sees your
whole dataset. So one query costs roughly the same whether you have 3 files or 3 million:

| | Tokens (approx) |
|---|---|
| Plan call (question + connector names) | ~200 |
| Synthesize call (question + 15 × ~600 chars) | ~2,400 |
| **Total per query** | **~2,600, fixed** |

The three "dials" that control this live in code:

| Dial | Where | Default | Effect |
|---|---|---|---|
| `limit` | `core/connector.py` | 200 | max matches collected **per connector** |
| `synth_n` | `agent/pipeline.py` | 15 | how many items the **LLM reads** (token cost) |
| `content[:600]` | `agent/synthesizer.py` | 600 | characters per item sent to the LLM |

---

## We show everything, but only summarise the top slice

A key design choice (in `agent/pipeline.py`):

- The **UI and the export receive the FULL ranked list** of matches — showing items on
  screen costs **no tokens**.
- The **LLM only reads the top `synth_n`** for the written paragraph.

So if a search hits 1,000 files you get a complete, scrollable, exportable list of all
1,000 (your review set), while the AI summary still costs the same fixed ~2.6k tokens.
The results header makes this explicit, e.g. *"1000 evidence items · AI summary based
on the top 15."*

---

## Scaling to a really large fileshare

The token cost is already safe. The remaining concern at millions of files is **speed**:
today the Fileshare connector re-reads and re-parses every file on each query (no
index). The production fix is to scan the files **once** into a search index — e.g.
**SQLite FTS5** (built into Python) or a search engine — so each query hits the index
in milliseconds instead of walking the disk. Only the inside of the connector's
`search()` changes; the rest of the system stays the same.

---

### Where to look in the code
- `agent/planner.py` — Step ① (plan)
- `connectors/*.py` + `core/textutil.py` — Step ② (search & matching)
- `core/models.py` — Step ③ (Evidence Item)
- `agent/pipeline.py` — Steps ② fan-out, ④ rank/dedupe, and the orchestration
- `agent/synthesizer.py` — Step ⑤ (cited answer)
