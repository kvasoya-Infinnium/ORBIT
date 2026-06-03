"""
connectors/zoho_crm.py
----------------------
Searches Zoho CRM (Contacts, Leads, Deals, Notes...).

Zoho uses OAuth. You don't send a username/password; instead you have a long-lived
"refresh token" that you exchange for a short-lived "access token" before each run.
The "data center" decides which Zoho domain to talk to (.com / .in / .eu / ...).

Config (.env):
  ZOHO_CLIENT_ID=...
  ZOHO_CLIENT_SECRET=...
  ZOHO_REFRESH_TOKEN=...
  ZOHO_DATA_CENTER=com          (com | in | eu | com.au | jp ...)
"""

import httpx

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import config

# Which modules (record types) we search and concatenate.
MODULES = ["Contacts", "Leads", "Deals"]


class ZohoCRMConnector(Connector):
    id = "zoho"
    name = "Zoho CRM"
    icon = "🧾"
    fields = [
        {"key": "ZOHO_CLIENT_ID", "label": "Client ID", "type": "text", "placeholder": "1000...."},
        {"key": "ZOHO_CLIENT_SECRET", "label": "Client secret", "type": "password", "placeholder": "..."},
        {"key": "ZOHO_REFRESH_TOKEN", "label": "Refresh token", "type": "password", "placeholder": "1000...."},
        {"key": "ZOHO_DATA_CENTER", "label": "Data center", "type": "text", "placeholder": "com | in | eu"},
    ]

    @property
    def client_id(self): return config.get(self.instance_id, "ZOHO_CLIENT_ID", "")
    @property
    def client_secret(self): return config.get(self.instance_id, "ZOHO_CLIENT_SECRET", "")
    @property
    def refresh_token(self): return config.get(self.instance_id, "ZOHO_REFRESH_TOKEN", "")
    @property
    def _dc(self): return config.get(self.instance_id, "ZOHO_DATA_CENTER", "com") or "com"
    @property
    def accounts_url(self): return f"https://accounts.zoho.{self._dc}"
    @property
    def api_url(self): return f"https://www.zohoapis.{self._dc}/crm/v2"

    async def _access_token(self, client: httpx.AsyncClient) -> str:
        """Exchange the refresh token for a fresh access token."""
        r = await client.post(f"{self.accounts_url}/oauth/v2/token", params={
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token",
        })
        return r.json().get("access_token", "")

    async def test_connection(self) -> ConnectionStatus:
        if not (self.client_id and self.client_secret and self.refresh_token):
            return ConnectionStatus(connected=False, detail="Missing Zoho OAuth credentials")
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                token = await self._access_token(c)
            if token:
                return ConnectionStatus(connected=True, detail="Access token obtained")
            return ConnectionStatus(connected=False, detail="Could not get access token")
        except Exception as e:
            return ConnectionStatus(connected=False, detail=str(e))

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        results: list[EvidenceItem] = []
        term = q.person or (q.keywords[0] if q.keywords else None) or q.exact_value
        async with httpx.AsyncClient(timeout=20) as c:
            token = await self._access_token(c)
            if not token:
                return results
            headers = {"Authorization": f"Zoho-oauthtoken {token}"}
            n = 0
            for module in MODULES:
                if len(results) >= q.limit:
                    break
                # If we have a search term use /search?word=..., else just list records.
                if term:
                    url = f"{self.api_url}/{module}/search"
                    params = {"word": term}
                else:
                    url = f"{self.api_url}/{module}"
                    params = {"per_page": q.limit}
                resp = await c.get(url, headers=headers, params=params)
                if resp.status_code != 200:
                    continue
                for rec in resp.json().get("data", []):
                    if len(results) >= q.limit:
                        break
                    n += 1
                    title = rec.get("Full_Name") or rec.get("Deal_Name") or rec.get("Last_Name") or f"{module} record"
                    content = "\n".join(f"{k}: {v}" for k, v in rec.items()
                                        if isinstance(v, (str, int, float)) and v not in (None, ""))
                    results.append(EvidenceItem(
                        id=f"{self.instance_id}-{n}",
                        source=self.id,
                        source_label=f"{self.label} / {module}",
                        record_id=str(rec.get("id", "")),
                        title=str(title),
                        snippet=content[:200],
                        content=content,
                        author=(rec.get("Owner") or {}).get("name") if isinstance(rec.get("Owner"), dict) else None,
                        timestamp=rec.get("Modified_Time") or rec.get("Created_Time"),
                        link=rec.get("$link") or None,
                        metadata={"module": module},
                    ))
        return results
