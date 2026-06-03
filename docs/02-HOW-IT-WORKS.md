# 02 — How it works (follow one question through the system)

Let's follow the question **"Give me employee details for salary 65200"** from the
moment you press Enter to the answer on screen.

```
You type the question
        │
        ▼
[Frontend]  Search.jsx sends POST /query { question, connector_ids }
        │
        ▼
[Backend]   main.py  →  agent/pipeline.py  runs 5 steps:

  ① PLAN      planner.py asks OpenAI (or a fallback rule):
              "which connectors? what to search for?"
              → { connectors:["fileshare","s3"], exact_value:"65200" }

  ② FAN-OUT   pipeline.py calls those connectors AT THE SAME TIME.
              Each connector.search() returns EvidenceItems.
              (One slow/broken connector can't crash the others.)

  ③ NORMALIZE nothing to do — connectors already return EvidenceItems.

  ④ RANK &    drop duplicates, score by keyword overlap + recency,
     DEDUPE    keep the top N.

  ⑤ SYNTHESIZE synthesizer.py asks OpenAI to write one answer that cites
              each fact like [fileshare-1].

        │  also: audit.py writes one row (who/when/what/#results)
        ▼
[Backend]   returns { answer, items[], query_id, per_connector }
        │
        ▼
[Frontend]  Search.jsx shows the answer. CitationText.jsx turns [fileshare-1]
            into a clickable link to the matching EvidenceCard.
            Export button → POST /export → downloads CSV/JSON.
```

## Why the "Plan then Synthesize" design?

A hackathon-friendly choice: instead of letting the AI loop freely and call tools
(which is unpredictable), we make exactly **two** AI calls with clear jobs:

1. **Plan** — turn fuzzy English into a precise `SearchQuery` + a list of connectors.
2. **Synthesize** — read the found evidence and write a cited answer.

Two clear calls = far more reliable on stage.

## What happens if there's no OpenAI key?

Everything still works. The planner falls back to a simple rule (pull out a number
like `65200`, a name like `Rudra Raval`, and some keywords) and the synthesizer just
lists the matches. So you can develop and demo even fully offline.

## What happens if a connector fails or has no credentials?

- No credentials → it shows as "Not connected" and simply returns 0 results.
- Throws an error mid-search → `pipeline.py` catches it, that connector returns `[]`,
  and the others still answer. The error is reported in `per_connector` but never
  crashes the query.

## The "provenance" rule (why this is eDiscovery, not a toy)

Every Evidence Item carries `source`, `record_id`, `timestamp`, and a `link`/path.
Nothing is shown without proof of where it came from. Plus every query is logged
(the **Audit** page) and can be exported as a **review set**. That combination —
citations + audit + export — is what makes it "defensible".

Next: **03-BACKEND-EXPLAINED.md** to see each backend file.
