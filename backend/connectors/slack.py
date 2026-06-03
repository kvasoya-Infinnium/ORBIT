"""
connectors/slack.py
-------------------
Searches Slack messages.

There are TWO kinds of Slack tokens and they behave very differently:
  - USER token (starts with "xoxp-")  -> can use Slack's full-text search.messages API.
  - BOT token  (starts with "xoxb-")  -> CANNOT search; it can only read history of
                                          channels the bot has joined.

This connector auto-detects which one you have:
  - xoxp- : calls search.messages (best experience).
  - xoxb- : lists channels, pulls recent history, and filters locally.

Config (.env):
  SLACK_TOKEN=xoxp-...   (or xoxb-...)
"""

import httpx

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import config

SLACK_API = "https://slack.com/api"


class SlackConnector(Connector):
    id = "slack"
    name = "Slack"
    icon = "💬"
    fields = [
        {"key": "SLACK_TOKEN", "label": "Slack token (xoxp- or xoxb-)",
         "type": "password", "placeholder": "xoxp-..."},
    ]

    @property
    def token(self): return config.get(self.instance_id, "SLACK_TOKEN", "")

    @property
    def _is_user_token(self) -> bool:
        return self.token.startswith("xoxp-")

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    async def test_connection(self) -> ConnectionStatus:
        if not self.token:
            return ConnectionStatus(connected=False, detail="Missing SLACK_TOKEN")
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(f"{SLACK_API}/auth.test", headers=self._headers())
                data = r.json()
            if data.get("ok"):
                kind = "user token (full search)" if self._is_user_token else "bot token (history only)"
                return ConnectionStatus(connected=True, detail=f"{data.get('team')} — {kind}")
            return ConnectionStatus(connected=False, detail=data.get("error", "auth failed"))
        except Exception as e:
            return ConnectionStatus(connected=False, detail=str(e))

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        if self._is_user_token:
            return await self._search_full(q)
        return await self._search_history(q)

    def _query_text(self, q: SearchQuery) -> str:
        bits = list(q.keywords)
        if q.person:
            bits.append(q.person)
        if q.exact_value:
            bits.append(q.exact_value)
        return " ".join(bits) or "*"

    async def _search_full(self, q: SearchQuery) -> list[EvidenceItem]:
        """USER token path: real full-text search via search.messages."""
        results: list[EvidenceItem] = []
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(
                f"{SLACK_API}/search.messages",
                headers=self._headers(),
                params={"query": self._query_text(q), "count": q.limit},
            )
            data = r.json()
        matches = data.get("messages", {}).get("matches", [])
        for n, msg in enumerate(matches[: q.limit], start=1):
            ts = msg.get("ts", "")
            results.append(EvidenceItem(
                id=f"{self.instance_id}-{n}",
                source=self.id,
                source_label=self.label,
                record_id=ts,
                title=f"#{msg.get('channel', {}).get('name', 'dm')} message",
                snippet=(msg.get("text") or "")[:200],
                content=msg.get("text") or "",
                author=msg.get("username") or msg.get("user"),
                timestamp=_slack_ts_to_iso(ts),
                link=msg.get("permalink"),
                metadata={"channel": msg.get("channel", {}).get("name")},
            ))
        return results

    async def _search_history(self, q: SearchQuery) -> list[EvidenceItem]:
        """BOT token path: no search API, so read channel history and filter ourselves."""
        results: list[EvidenceItem] = []
        terms = [t.lower() for t in (q.keywords + ([q.person] if q.person else [])
                                     + ([q.exact_value] if q.exact_value else []))]
        async with httpx.AsyncClient(timeout=20) as c:
            ch = await c.get(f"{SLACK_API}/conversations.list",
                             headers=self._headers(), params={"limit": 50})
            channels = ch.json().get("channels", [])
            n = 0
            for channel in channels:
                if len(results) >= q.limit:
                    break
                hist = await c.get(f"{SLACK_API}/conversations.history",
                                   headers=self._headers(),
                                   params={"channel": channel["id"], "limit": 50})
                for msg in hist.json().get("messages", []):
                    text = (msg.get("text") or "")
                    if terms and not any(t in text.lower() for t in terms):
                        continue
                    n += 1
                    results.append(EvidenceItem(
                        id=f"{self.instance_id}-{n}",
                        source=self.id,
                        source_label=self.label,
                        record_id=msg.get("ts", ""),
                        title=f"#{channel.get('name')} message",
                        snippet=text[:200],
                        content=text,
                        author=msg.get("user"),
                        timestamp=_slack_ts_to_iso(msg.get("ts", "")),
                        link=None,
                        metadata={"channel": channel.get("name")},
                    ))
                    if len(results) >= q.limit:
                        break
        return results


def _slack_ts_to_iso(ts: str) -> str | None:
    """Slack timestamps look like '1700000000.000200' (unix seconds)."""
    from datetime import datetime, timezone
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()
    except Exception:
        return None
