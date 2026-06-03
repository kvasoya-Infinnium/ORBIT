# ORBIT — Unified Discovery Agent

Ask one question in plain English, search every connected system at once, and get a
single answer where **every fact is cited back to its source**. Built for eDiscovery.

**Connectors:** Fileshare · Email (IMAP) · AWS S3 · Slack · Zoho CRM · GPT/AI-Chat (optional)

**The UI:** connectors live in the left rail. Use **Add a connector** to create as many
as you like — including **multiple of the same type** (e.g. an "HR Fileshare" and a
"Legal Fileshare"), each with its own credentials. **Double-click** a connector to enter
its credentials in a popup; **drag** it onto the center canvas to add it to your **ORBIT**.
Whatever sits in the orbit is exactly what your query searches.

---

## Quick start (2 terminals)

### 1. Backend (Python)
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env       # Windows  (use: cp .env.example .env on mac/linux)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Backend runs on **http://localhost:8000** (try http://localhost:8000/docs).
`--host 0.0.0.0` makes it reachable from other machines on the network.

> It works out of the box with **zero credentials** — the Fileshare and AI-Chat
> connectors use the seeded demo data in `backend/data/`. Add real credentials in
> `.env` to light up Email, S3, Slack, and Zoho.

### 2. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:8080** on this machine.

### Access from another machine (same network)
The dev server binds to `0.0.0.0`, so from another computer open
**`http://<this-machine-ip>:8080`** (e.g. `http://192.168.172.6:8080`). The UI
auto-targets the backend at the same IP on port 8000 — no config needed. Make sure
both machines are on the same network and Windows Firewall allows inbound ports
**8080** and **8000** (see the one-time firewall command below).

### Try it
1. In the left rail, **drag** *Fileshare* and *GPT / AI Chat* onto the center canvas
   (they're connected out of the box). They snap into orbit around the ORBIT core.
2. Type *"Give me employee details for salary 65200"* in the query bar → **Run**.
3. Click a `[fileshare-1]` citation → it jumps to the source. Hit **Export CSV**.
4. Click **Audit log** (top right) — your query is recorded.
5. To add a real source: **double-click** any connector (e.g. Email) → enter
   credentials in the popup → **Save & Connect** → its dot turns green → drag to orbit.

### One-time firewall rules (Windows, for network access)
Run **PowerShell as Administrator** once on the host machine:
```powershell
netsh advfirewall firewall add rule name="ORBIT frontend" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="ORBIT backend"  dir=in action=allow protocol=TCP localport=8000
```

---

## Rebuilding from scratch?
`RECREATE.md` is a single self-contained build spec — hand it to Claude Code in an
empty folder ("read RECREATE.md and build the whole project") to regenerate ORBIT
end to end. (Cloning this repo is the faster path; the spec is the from-scratch route.)

## New to the project? Read the docs in order:
1. `docs/01-START-HERE.md` — what this is, in plain words
2. `docs/02-HOW-IT-WORKS.md` — the flow, step by step
3. `docs/03-BACKEND-EXPLAINED.md` — every backend file explained
4. `docs/04-FRONTEND-EXPLAINED.md` — every frontend file explained
5. `docs/05-CONNECTORS-SETUP.md` — how to get each credential
6. `docs/06-DEMO-SCRIPT.md` — what to say to the judges
7. `docs/07-HOW-SEARCH-WORKS.md` — the search/rank/token flow, step by step
