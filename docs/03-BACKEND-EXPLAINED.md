# 03 — Backend explained (every file, plainly)

The backend is **Python + FastAPI**. Here is every file and what it does. Each source
file also has comments at the top explaining itself.

```
backend/
├── main.py                  ← the web server (the "front door")
├── core/                    ← the shared rules everyone obeys
│   ├── models.py            ← the Evidence Item (one result shape)
│   ├── connector.py         ← the Connector contract + SearchQuery + UI field defs
│   ├── registry.py          ← a phone book of connectors
│   ├── config.py            ← where credentials come from (UI popup OR .env)
│   └── textutil.py          ← shared text extraction + matching helpers
├── agent/                   ← the "brain"
│   ├── planner.py           ← STEP 1: English → structured query
│   ├── synthesizer.py       ← STEP 5: evidence → cited answer
│   └── pipeline.py          ← the conductor that runs all 5 steps
├── connectors/              ← one file per data source
│   ├── fileshare.py
│   ├── email_imap.py
│   ├── aws_s3.py
│   ├── slack.py
│   ├── zoho_crm.py
│   └── ai_chat.py           ← optional GPT/compliance (local|live)
├── services/
│   ├── audit.py             ← SQLite log of every query (defensibility)
│   └── export.py            ← CSV / JSON "review set" download
├── data/                    ← seeded demo data (works with no credentials)
│   ├── fileshare/           ← demo docs incl. the salary record
│   └── ai_chat_local.json   ← fake ChatGPT history in the real API's shape
├── .env.example             ← copy to .env and fill in credentials
└── requirements.txt         ← Python libraries to install
```

## core/ — the foundation (read this first)

- **models.py** → defines `EvidenceItem`. THE most important file. Every result
  becomes this shape. Read its comments.
- **connector.py** → defines `SearchQuery` (a normalized search) and the `Connector`
  base class with the two methods every source must implement.
- **registry.py** → keeps two books: **TYPES** (the connector templates, one per class)
  and **INSTANCES** (the live connectors you've created). You can create several
  instances of the same type — e.g. `fileshare_1` and `fileshare_2` — each with its own
  credentials and its own evidence ids, so they never collide. The agent searches
  INSTANCES; the "Add a connector" menu is built from TYPES.
- **config.py** → the credential lookup. When you type credentials into the UI popup,
  the backend stores them here in memory; connectors read from here first, then fall
  back to `.env`. This is what makes the "double-click → enter credentials → Connect"
  flow work without editing files or restarting. Each connector also declares a
  `fields` list (in its class) describing the inputs its popup should show.
- **textutil.py** → `extract_text()` (PDF/DOCX/TXT → plain text), `matches()` (is this
  text relevant?), `make_snippet()` (short preview). Used by Fileshare **and** S3 so
  document handling lives in one place.

## agent/ — the brain

- **planner.py** → STEP 1. Calls OpenAI in JSON mode to decide *which connectors* and
  *what to search for*. Has an offline fallback (no key needed).
- **synthesizer.py** → STEP 5. Calls OpenAI to write the final answer that cites items
  by id, e.g. `[email-3]`. Also has an offline fallback.
- **pipeline.py** → the conductor. Runs PLAN → FAN-OUT (parallel) → DEDUPE/RANK →
  SYNTHESIZE. Wraps each connector in try/except so one failure can't kill the query.

## connectors/ — the data sources

Each one inherits `Connector` and implements `test_connection()` + `search()`. They
all return `EvidenceItem`s, so they're interchangeable. See **05-CONNECTORS-SETUP.md**
for how to get each one's credentials, and each file's top comment for specifics.

## services/ — defensibility

- **audit.py** → writes one row to a SQLite file (`data/nexus.db`) per query: who, when,
  the question, connectors, result count, and the item ids. Powers the Audit page.
- **export.py** → turns the items into a CSV (one row each) or a JSON bundle to download.

## main.py — the web server

Registers all connectors, then exposes the HTTP endpoints the React app calls:

| Method | Endpoint | Does |
|---|---|---|
| GET | `/connector-types` | the catalog for the "Add a connector" menu |
| GET | `/connectors` | list connector **instances** + status + field defs |
| POST | `/connectors` | create a new instance of a type (e.g. a 2nd Fileshare) |
| DELETE | `/connectors/{instance_id}` | remove an instance |
| POST | `/connectors/{instance_id}/connect` | save credentials (+ rename), then test |
| POST | `/connectors/{instance_id}/test` | re-test one instance |
| POST | `/query` | run the whole agent pipeline (+ write audit row) |
| GET | `/audit` | list past queries |
| POST | `/export` | download a query's results as CSV/JSON |
| GET | `/health` | liveness check |

Tip: while the backend is running, open **http://localhost:8000/docs** — FastAPI gives
you an interactive page to try every endpoint without the frontend.

Next: **04-FRONTEND-EXPLAINED.md**.
