# 01 — Start Here (the big picture, in plain words)

## What problem does ORBIT solve?

In a company, information about a person or a case is scattered everywhere: some in
email, some in Slack, some in files, some in a CRM. To find "everything about X"
today you have to log into each system separately, search each one differently, and
manually stitch the results together. Slow and easy to miss things.

For an **eDiscovery** company (collecting evidence for legal/audit/compliance), this
is *the* core problem — and the evidence must be **defensible**: you must prove where
each piece came from and keep a record of every search.

## What ORBIT does

You ask **one** question in plain English. ORBIT:
1. Figures out which systems to look in.
2. Searches all of them **at the same time**.
3. Puts every result into **one common shape**.
4. Removes duplicates and ranks by relevance.
5. Writes **one answer**, with a **citation** on every claim.
6. Logs the whole thing so it's auditable, and lets you **export** the results.

> One sentence: **ask once, search everywhere, trust every answer.**

## The two ideas that make it work

Everything in this project comes back to two simple ideas. If you understand these
two, you understand ORBIT.

### Idea 1 — The Connector (one common "plug")
Every data source is wrapped in a class that promises to do exactly two things:
- **test_connection()** — "do my credentials work?"
- **search(query)** — "here is a search; give me back results."

Because every source makes the same promise, the rest of the app treats them all the
same way. Adding a new source later = write **one** new connector class. Nothing else
changes. (Code: `backend/core/connector.py`.)

### Idea 2 — The Evidence Item (one common "result shape")
No matter where a result comes from, it's converted into the **same** little record:
`id, source, title, snippet, content, author, timestamp, link, …`

Because every result looks identical, the AI, the screen, the audit log, and the
export only have to understand **one** format. (Code: `backend/core/models.py`.)

## The six connectors in this project
| Connector | What it searches | Needs |
|---|---|---|
| 📁 Fileshare | Files in folders (PDF/DOCX/TXT) | just a folder path |
| ✉️ Email | An email mailbox over IMAP | email + app password |
| 🪣 AWS S3 | Documents in S3 buckets | AWS keys + bucket |
| 💬 Slack | Slack messages | a Slack token |
| 🧾 Zoho CRM | Contacts/Leads/Deals | Zoho OAuth creds |
| 🤖 GPT/AI-Chat *(optional)* | ChatGPT history | compliance key (or seeded data) |

Next: read **02-HOW-IT-WORKS.md** to see the request travel through the system.
