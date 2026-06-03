# 05 — Connectors setup (how to get each credential)

All credentials go in `backend/.env` (copy it from `.env.example`). Anything you leave
blank just shows that connector as "Not connected" — the app still runs. **Fileshare**
and **AI-Chat (local mode)** need nothing; they use the seeded demo data.

---

## 📁 1. Fileshare — easiest, needs nothing
```
FILESHARE_PATHS=./data/fileshare
```
Multiple folders? Separate with commas:
```
FILESHARE_PATHS=./data/fileshare,C:/shared/legal,//server/share/hr
```
Supports PDF, DOCX, TXT, CSV, MD, JSON, LOG.

---

## ✉️ 2. Email (IMAP)
```
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=demo.account@gmail.com
IMAP_PASSWORD=your-app-password
```
**Gmail:** turn on 2-Step Verification, then create an **App Password**
(Google Account → Security → App passwords). Use that 16-char password here, NOT your
normal one. Also confirm IMAP is enabled in Gmail settings.
**Outlook/other:** find the host (e.g. `outlook.office365.com`) and use an app password.
> ⚠️ Test the EXACT account the night before — IMAP/app-password setup is the classic
> day-of time sink. If it's risky, leave it blank and lean on the seeded connectors.

---

## 🪣 3. AWS S3 (documents)
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKETS=my-bucket,another-bucket
```
In AWS Console → IAM → create a user with **read-only S3** access, generate an access
key. Put a few PDFs/DOCXs in the bucket(s). (Note: your form said "client id/key/secret"
— for AWS those map to access key id + secret access key + region.)

---

## 💬 4. Slack
```
SLACK_TOKEN=xoxp-...   (or xoxb-...)
```
Two token types behave differently — the connector auto-detects which you have:
- **xoxp- (USER token)** → real full-text search across messages. Best experience.
  Create a Slack app → OAuth & Permissions → add **User Token Scopes**: `search:read`,
  then install and copy the **User OAuth Token**.
- **xoxb- (BOT token)** → cannot search; the connector falls back to reading the
  history of channels the bot is in, then filtering. Add bot scopes `channels:history`,
  `channels:read`, and **invite the bot into the channels** you want searchable.

---

## 🧾 5. Zoho CRM (OAuth)
```
ZOHO_CLIENT_ID=1000....
ZOHO_CLIENT_SECRET=...
ZOHO_REFRESH_TOKEN=1000....
ZOHO_DATA_CENTER=com        # com | in | eu | com.au | jp ...
```
1. Go to **https://api-console.zoho.com**, create a **Self Client** (or Server-based app).
2. Generate a grant code with scope `ZohoCRM.modules.ALL` (or read scopes).
3. Exchange the grant code for a **refresh token** (one-time curl/Postman call to
   `https://accounts.zoho.<dc>/oauth/v2/token`). Store the refresh token here.
4. `ZOHO_DATA_CENTER` is the domain suffix of YOUR Zoho account (India = `in`, EU = `eu`).
The connector swaps the refresh token for a short-lived access token on every search.

---

## 🤖 6. GPT / AI-Chat (OPTIONAL)
```
AI_CHAT_MODE=local                 # local | live
CHATGPT_WORKSPACE_ID=
CHATGPT_COMPLIANCE_KEY=
```
- **local** (default) → reads `data/ai_chat_local.json`, which is shaped exactly like
  the real Compliance API. No key needed; perfect for the demo.
- **live** → set `AI_CHAT_MODE=live` and fill in the workspace id + compliance key
  (requires a real ChatGPT Enterprise workspace + admin key).
The agent and UI can't tell the difference — that's the point.

---

## The OpenAI key (the agent's brain)
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=               # optional endpoint override; blank = default
```
Optional but recommended — it powers the smart planning and the cited summary. Without
it, ORBIT uses a simple rule-based fallback so everything still runs. `gpt-4o-mini` is
fast and cheap; bump the model only if you need to.

**`OPENAI_BASE_URL`** lets you point the agent at a different endpoint without touching
code — e.g. **Azure OpenAI**, a company **proxy/gateway**, a **regional host**, or a
local server like **Ollama / LM Studio** (OpenAI-compatible). Leave it blank to use the
default `https://api.openai.com/v1`. If you ever hit an *"incorrect regional hostname"*
error, set it to `https://us.api.openai.com/v1`.
