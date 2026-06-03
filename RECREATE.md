# RECREATE — Build "ORBIT" with Claude Code from scratch

> **How to use this file at the hackathon:** open an agentic coding CLI (Claude Code,
> GitHub Copilot CLI agent, Cursor, etc.) in an **empty folder** and paste the
> **ONE-SHOT PROMPT** below. The fastest, guaranteed-identical path is still
> `git clone https://github.com/Rudra-Infinnium/orbit-discovery-agent`; this file is
> the from-scratch regeneration path.

---

## ⭐ ONE-SHOT PROMPT (copy everything inside the box)

```
You are building a complete full-stack app from a fixed spec. Work autonomously and
do not stop until both servers run and the demo queries work.

STEP 1: Clone https://github.com/Rudra-Infinnium/orbit-discovery-agent into a temp
folder and read its RECREATE.md in full. That file is the authoritative spec — follow
every section (core models, registry with multiple instances per type, runtime config,
the 6 connectors, the plan→search→rank→synthesize pipeline, all API endpoints, and the
React "orbit" UI). If you cannot clone, tell me and I will paste the spec instead.

STEP 2: Build the project in THIS order, verifying each stage before moving on:
  (a) Backend skeleton: core/ (EvidenceItem, Connector ABC, SearchQuery, registry,
      config, textutil), then main.py with all endpoints. Create the seed data
      (data/fileshare/HR_records.txt containing "Salary: 65200" for Rudra Raval, plus
      a policy memo and a Q2-incident report; and data/ai_chat_local.json in the
      ChatGPT-Compliance shape). Run: uvicorn main:app --port 8000 and confirm GET
      /health and GET /connectors return data.
  (b) The 6 connectors (fileshare, email_imap, aws_s3, slack, zoho_crm, ai_chat) and
      the agent pipeline (planner, synthesizer, pipeline) with the OFFLINE fallback so
      it works with NO OpenAI key. Confirm POST /query for "salary 65200" returns a
      cited answer from the seed fileshare.
  (c) Frontend (React + Vite, port 8080): sidebar (Add-a-connector catalog + draggable
      instance tiles, double-click opens a credential popup), the center OrbitCanvas
      (drag connectors in; pills CENTERED on their circle point so spokes align to the
      core), the query bar, results with clickable citations that match EvidenceItem.id
      exactly, Export, and the Audit modal. One styles.css dark theme, SVG icons (no
      emoji). Run: npm install && npm run dev.

STEP 3: Start both servers, open the app, drag Fileshare + GPT/AI-Chat into the orbit,
run "Give me employee details for salary 65200", and confirm a cited answer appears and
a citation clicks through to the source. Fix anything until this works. Then summarize
what you built and how to run it.

Rules: it MUST run with zero credentials (seed data covers Fileshare + AI-Chat). Never
let one failing connector crash a query. Keep the citation id format "<instance_id>-<n>"
(e.g. fileshare_1-3) consistent between the synthesizer and the UI regex.
```

---

## THE BUILD PROMPT (detailed spec — this is what RECREATE's sections expand on)

## THE BUILD PROMPT

Build a full-stack app called **ORBIT — Unified Discovery Agent**: an eDiscovery AI
agent that searches across multiple pluggable data-source "connectors" at once,
normalizes every result into one common shape, and returns a single cited answer with
an audit log and export. Stack: **Python + FastAPI** backend, **React + Vite** frontend,
**OpenAI** for the agent (with an offline fallback so it runs with no key).

### 0. Golden rules (the architecture's spine)
1. **One Connector interface.** Every data source is a class implementing the SAME two
   async methods: `test_connection()` and `search(SearchQuery)`. Adding a source = one
   new class, nothing else changes.
2. **One Evidence Item.** Every result from every connector is normalized into the SAME
   pydantic model. The agent, UI, audit, and export only ever understand this one shape.
3. **Provenance always.** Every item carries `source`, `record_id`, `timestamp`, and a
   `link`/path. No provenance → not evidence.
4. **The LLM is used only to PLAN and to SYNTHESIZE.** All searching/matching/ranking is
   plain Python (zero tokens). Token cost is fixed regardless of dataset size.

### 1. Repository layout
```
orbit/
├── backend/
│   ├── main.py                 # FastAPI app + all endpoints
│   ├── core/
│   │   ├── models.py           # EvidenceItem
│   │   ├── connector.py        # Connector ABC, SearchQuery, ConnectionStatus, fields
│   │   ├── registry.py         # TYPES (templates) + INSTANCES (live connectors)
│   │   ├── config.py           # runtime credential store (UI popup creds + .env)
│   │   └── textutil.py         # extract_text(), matches(), make_snippet()
│   ├── agent/
│   │   ├── planner.py          # LLM call #1: question -> SearchQuery (+ offline fallback)
│   │   ├── synthesizer.py      # LLM call #2: items -> cited answer (+ offline fallback)
│   │   └── pipeline.py         # fan-out (parallel) + rank/dedupe + orchestration
│   ├── connectors/
│   │   ├── fileshare.py  email_imap.py  aws_s3.py  slack.py  zoho_crm.py  ai_chat.py
│   ├── services/
│   │   ├── audit.py            # SQLite audit log (self-healing schema)
│   │   └── export.py           # CSV / JSON review set
│   ├── data/
│   │   ├── fileshare/          # seed docs incl. an HR record with "salary 65200"
│   │   └── ai_chat_local.json  # ChatGPT-Compliance-shaped seed data
│   ├── .env.example   requirements.txt
└── frontend/  (React + Vite, port 8080)
    └── src/  App.jsx  api.js  styles.css  components/{Icon,Sidebar,OrbitCanvas,
              CredentialModal,ResultsPanel,AuditModal,EvidenceCard,SourceModal,CitationText}.jsx
```

### 2. Core models

**`core/models.py` — EvidenceItem (pydantic BaseModel):**
`id` (str, format `"<instance_id>-<n>"`, e.g. `fileshare_1-3`), `source` (type id),
`source_label`, `record_id`, `title`, `snippet`, `content` (full text), `author?`,
`participants:list[str]`, `timestamp?` (ISO), `link?`, `metadata:dict`.

**`core/connector.py`:**
- `SearchQuery(BaseModel)`: `keywords:list[str]=[]`, `person:str|None`, `exact_value:str|None`,
  `date_from:str|None`, `date_to:str|None`, `limit:int=200`.
- `ConnectionStatus(BaseModel)`: `connected:bool`, `detail:str=""`.
- `Connector(ABC)`: class attrs `id` (type id), `name`, `icon`, `fields:list[dict]`
  (each `{key,label,type:"text"|"password",placeholder}` describing the UI popup).
  `__init__` sets per-instance `self.instance_id = self.id` and `self.label = self.name`.
  Abstract async `test_connection()->ConnectionStatus` and `search(SearchQuery)->list[EvidenceItem]`.
  **Never raise from these — return an empty list / a not-connected status.**

### 3. Registry — multiple instances per type
`core/registry.py` keeps `TYPES: dict[str,class]` and `INSTANCES: dict[str,Connector]`.
- `register_type(cls)`, `list_types()`.
- `create_instance(type_id, label=None)`: instantiate the class, set
  `instance_id = f"{type_id}_{n}"` (n increments per type), `label` default = name or
  `"{name} {n}"`. Store in INSTANCES.
- `remove_instance(id)`, `get(id)`, `all_instances()`, `enabled_instances(ids)`.
This is what lets you add e.g. two Fileshares, each with its own credentials.

### 4. Credentials at runtime — `core/config.py`
A connector reads credentials via `config.get(instance_id, KEY, default)`, which checks a
runtime in-memory store FIRST, then `os.getenv(KEY)`. `set_creds(instance_id, dict)` saves
creds typed into the UI popup. `masked_values(instance_id, keys)` returns current values
with secrets shown as `••••••••`. Connectors read creds via `@property` (so popup updates
take effect immediately, no restart).

### 5. Shared text util — `core/textutil.py`
- `extract_text(filename, raw_bytes)`: PDF (`pypdf`), DOCX (`python-docx`), TXT/CSV/MD/JSON/LOG
  (utf-8). Unknown → "".
- `matches(text, q)`: lowercase substring — `any(term in text.lower())` over
  keywords+person+exact_value; empty query matches all.
- `make_snippet(text, q, width=200)`: ~200 chars centered on the first matching term.

### 6. The six connectors (each: class attrs id/name/icon/fields, creds via config props)
| id | name | fields (keys) | search behavior |
|---|---|---|---|
| `fileshare` | Fileshare | `FILESHARE_PATHS` (comma list) | walk paths, extract_text, keep files matching text/filename; map mtime/path |
| `email` | Email (IMAP) | `IMAP_HOST,IMAP_PORT,IMAP_USER,IMAP_PASSWORD` | build IMAP `SEARCH` (FROM/TO/TEXT/BODY/SINCE/BEFORE); parse with stdlib `email` |
| `s3` | AWS S3 | `AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY,AWS_REGION,AWS_S3_BUCKETS` | `boto3` list/get objects, reuse `textutil` extraction |
| `slack` | Slack | `SLACK_TOKEN` | if token starts `xoxp-` use `search.messages`; else (`xoxb-`) list channels + read history + filter in Python |
| `zoho` | Zoho CRM | `ZOHO_CLIENT_ID,ZOHO_CLIENT_SECRET,ZOHO_REFRESH_TOKEN,ZOHO_DATA_CENTER` | OAuth: refresh-token → access-token; search Contacts/Leads/Deals via `/search?word=` |
| `ai_chat` | GPT / AI Chat | `AI_CHAT_MODE,CHATGPT_WORKSPACE_ID,CHATGPT_COMPLIANCE_KEY` | `local` mode reads `data/ai_chat_local.json`; `live` calls ChatGPT Enterprise Compliance API. Same filter/normalize for both. |
Each connector builds EvidenceItems with `id=f"{self.instance_id}-{n}"`, `source=self.id`,
`source_label=self.label`. Stop at `q.limit`. Wrap network calls so failures return `[]`.

### 7. The agent pipeline — `agent/`
- **planner.py**: system prompt asks OpenAI (JSON mode, model from `OPENAI_MODEL`, base url
  from `OPENAI_BASE_URL` if set) for `{connectors:[ids], search:{...}, intent}`. **Fallback
  (no key):** regex a number → `exact_value`, a `Capitalized Name` → `person`, other words →
  keywords; choose all available connectors.
- **synthesizer.py**: system prompt = "answer using ONLY these items; cite every claim with
  the id in brackets like `[fileshare_1-3]`; concise, for legal review." Sends the question +
  the top items (each `content[:600]`). **Fallback:** list the matches.
- **pipeline.py `run_query(question, connector_ids, synth_n=15)`:**
  1. PLAN. 2. FAN-OUT in parallel (`asyncio.gather`), each connector wrapped in try/except so
  one failure can't kill the query; re-id items `f"{instance_id}-{i}"`. 3. DEDUPE by id.
  4. RANK by `_score` = term-frequency over (title+content) + a recency bonus
  (`max(0, 1 - age_days/365)`); sort desc. 5. SYNTHESIZE on the **top `synth_n`** only.
  **Return the FULL ranked list as `items`** (UI/export show everything; LLM reads only the
  top slice → token cost fixed), plus `synth_count`, `total_found`, `per_connector`
  (`{id:{count,error}}`), `intent`, `planned_query`.

### 8. Services
- **audit.py** (SQLite at `data/nexus.db`): table `audit(query_id, user, question,
  connectors, result_count, item_ids, created_at)`. **Run `CREATE TABLE IF NOT EXISTS` inside
  `_conn()` so the schema is self-healing** (never "no such table"). `record_query(...)->id`,
  `list_queries()`, `get_query(id)`.
- **export.py**: `to_csv(items)` (id,source,author,timestamp,title,snippet,link),
  `to_json(items)` (full bundle).

### 9. Backend API — `main.py`
`load_dotenv()`, register all 6 types and seed one instance each, CORS `allow_origins=["*"]`.
Keep an in-memory `{query_id: items}` cache for export.
| method | path | does |
|---|---|---|
| GET | `/health` | `{status:ok}` |
| GET | `/connector-types` | catalog for the Add menu |
| GET | `/connectors` | every instance + status + fields + masked values. **Run the per-instance `test_connection` in PARALLEL with a 6s timeout each** (so the list is fast). |
| POST | `/connectors` | `{type_id,label?}` → create instance |
| DELETE | `/connectors/{id}` | remove instance |
| POST | `/connectors/{id}/connect` | save popup creds (pop `label` to rename; ignore masked `••` values) then test |
| POST | `/connectors/{id}/test` | re-test |
| POST | `/query` | `{question, connector_ids, user?}` → run pipeline, write audit row, cache items, return `{query_id, answer, items[], synth_count, total_found, per_connector, intent}` |
| GET | `/audit` | list past queries |
| POST | `/export` | `{query_id, format:"csv"|"json"}` → download |

### 10. Frontend — React + Vite (the "ORBIT" workspace)
`vite.config.js`: `server:{ host:true, port:8080 }`. `api.js`: `BASE =
import.meta.env.VITE_API_BASE || \`${location.protocol}//${location.hostname}:8000\``
(so it works from any machine); expose `api.base`; wrap calls; methods for all endpoints.

**Layout = three regions:**
- **Sidebar (left):** "Add a connector" catalog (click a type → `POST /connectors` → opens its
  credential popup). "Your connectors" list: each instance tile is **draggable** (sets
  `dataTransfer` connector id), **double-click opens its credential popup**, has a +
  (add-to-orbit) and trash (delete) button, and a green/amber status dot.
- **OrbitCanvas (center):** a drop target. Connectors dropped here form the **orbit** (the
  active search set) around a glowing central **ORBIT core**. Geometry: ring is a zero-size
  point at center that slowly spins (CSS); each node is a zero-size point placed at
  `rotate(angle) translateX(R)`; the **pill is centered on that point** with
  `translate(-50%,-50%)` and nested counter-rotations to stay upright; a **spoke** spans
  `left:-R, width:R` so it runs cleanly from the core to the node. (Centering the pill on its
  point is essential — otherwise spokes misalign.)
- **Query bar + Results:** type a question → `POST /query` with the orbit's instance ids →
  show per-connector status chips, the synthesized **answer with clickable citations**, an
  Export CSV/JSON button, and the full ranked evidence list. Header notes "N items · AI
  summary based on top {synth_count}".

**Key components:** `Icon.jsx` (inline-SVG icon set + `connectorIconName(type_id)` mapping +
per-type accent colors), `CitationText.jsx` (regex `/\[([a-z0-9_]+-\d+)\]/g` → clickable spans
that scroll to `#ev-<id>`), `EvidenceCard.jsx` (badge, title, "Open source" button, snippet,
provenance), `SourceModal.jsx` (full captured content + provenance — because file://, imap://,
s3:// links can't open in a browser), `CredentialModal.jsx` (auto-builds form from
`connector.fields` + a Name field; secrets prefilled as `••••`), `AuditModal.jsx`.
Show a red banner if the backend is unreachable. No CSS framework — one `styles.css` dark
"mission-control" theme (Inter font, glass panels, subtle animations).

### 11. Config & deps
`.env.example`: `OPENAI_API_KEY, OPENAI_MODEL=gpt-4o-mini, OPENAI_BASE_URL`, plus every
connector's keys (section 6), `AI_CHAT_MODE=local`, `FILESHARE_PATHS=./data/fileshare`.
`requirements.txt`: fastapi, uvicorn[standard], pydantic, python-dotenv, openai, httpx,
boto3, pypdf, python-docx, python-dateutil. Frontend deps: react, react-dom, axios, vite,
@vitejs/plugin-react.

### 12. Seed data (so it runs with ZERO credentials)
- `data/fileshare/HR_records.txt`: a few employees incl. **"Salary: 65200"** for "Rudra Raval".
- A policy memo + a "Q2 data incident" report mentioning Rudra Raval.
- `data/ai_chat_local.json`: `{ "data": [ { id, title, user_email, created_at, url,
  messages:[{author:{role}, content}] } ] }` — a few conversations referencing the same story.

### 13. Definition of done
- All 6 connectors implement the common interface; Fileshare + AI-Chat work with no creds.
- "salary 65200" and "everything about Rudra Raval" both return cited answers.
- Drag connectors into the orbit; query searches exactly those; citations click through to
  the source; Export produces a CSV/JSON; Audit logs every query.
- Runs locally (backend `uvicorn main:app --host 0.0.0.0 --port 8000`, frontend `npm run dev`).

---

### Run commands
```
# backend
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt && copy .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# frontend
cd frontend && npm install && npm run dev   # http://localhost:8080
```

For the full beginner explanation of each part, see `docs/01`–`docs/07`.
