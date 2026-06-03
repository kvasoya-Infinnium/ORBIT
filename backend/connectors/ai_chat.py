"""
connectors/ai_chat.py  (OPTIONAL)
---------------------------------
Searches AI chat history from ChatGPT Enterprise's Compliance API.

This connector has a SWAP built in so it works even without a real compliance key:

  AI_CHAT_MODE=local  -> reads conversations from data/ai_chat_local.json, which is
                         shaped EXACTLY like the real Compliance API response.
  AI_CHAT_MODE=live   -> calls the real Compliance API with your compliance key.

The filtering + normalizing code is identical for both, so the agent and UI can't
tell the difference. This is the safe demo path: if you don't get a compliance key,
you keep AI_CHAT_MODE=local and everything still works.

Config (.env):
  AI_CHAT_MODE=local
  CHATGPT_WORKSPACE_ID=
  CHATGPT_COMPLIANCE_KEY=
"""

import json
from pathlib import Path

import httpx

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import config

LOCAL_FILE = Path(__file__).resolve().parent.parent / "data" / "ai_chat_local.json"


class AIChatConnector(Connector):
    id = "ai_chat"
    name = "GPT / AI Chat"
    icon = "🤖"
    fields = [
        {"key": "AI_CHAT_MODE", "label": "Mode (local | live)", "type": "text", "placeholder": "local"},
        {"key": "CHATGPT_WORKSPACE_ID", "label": "Workspace ID (live only)", "type": "text", "placeholder": ""},
        {"key": "CHATGPT_COMPLIANCE_KEY", "label": "Compliance key (live only)", "type": "password", "placeholder": ""},
    ]

    @property
    def mode(self): return (config.get(self.instance_id, "AI_CHAT_MODE", "local") or "local").lower()
    @property
    def workspace(self): return config.get(self.instance_id, "CHATGPT_WORKSPACE_ID", "")
    @property
    def key(self): return config.get(self.instance_id, "CHATGPT_COMPLIANCE_KEY", "")

    async def test_connection(self) -> ConnectionStatus:
        if self.mode == "local":
            if LOCAL_FILE.exists():
                return ConnectionStatus(connected=True, detail="LOCAL mode (seeded JSON)")
            return ConnectionStatus(connected=False, detail=f"Missing {LOCAL_FILE.name}")
        # live mode
        if not (self.workspace and self.key):
            return ConnectionStatus(connected=False, detail="Missing workspace id / compliance key")
        return ConnectionStatus(connected=True, detail="LIVE mode (Compliance API)")

    async def _load_conversations(self) -> list[dict]:
        """Return conversations in the Compliance API shape, from local file or live API."""
        if self.mode == "local":
            if not LOCAL_FILE.exists():
                return []
            return json.loads(LOCAL_FILE.read_text(encoding="utf-8")).get("data", [])
        # live
        url = f"https://api.chatgpt.com/v1/compliance/workspaces/{self.workspace}/conversations"
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(url, headers={"Authorization": f"Bearer {self.key}"})
            return r.json().get("data", [])

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        conversations = await self._load_conversations()
        terms = [t.lower() for t in (q.keywords + ([q.person] if q.person else [])
                                     + ([q.exact_value] if q.exact_value else []))]
        results: list[EvidenceItem] = []
        n = 0
        for conv in conversations:
            if len(results) >= q.limit:
                break
            # flatten all message text in the conversation
            messages = conv.get("messages", [])
            content = "\n".join(
                f"{m.get('author', {}).get('role', '?')}: {m.get('content', '')}"
                for m in messages
            )
            haystack = (conv.get("title", "") + " " + content).lower()
            if terms and not any(t in haystack for t in terms):
                continue
            n += 1
            results.append(EvidenceItem(
                id=f"{self.instance_id}-{n}",
                source=self.id,
                source_label=self.label,
                record_id=str(conv.get("id", "")),
                title=conv.get("title", "(untitled conversation)"),
                snippet=content[:200],
                content=content,
                author=conv.get("user_email"),
                timestamp=conv.get("created_at"),
                link=conv.get("url"),
                metadata={"mode": self.mode, "message_count": len(messages)},
            ))
        return results
