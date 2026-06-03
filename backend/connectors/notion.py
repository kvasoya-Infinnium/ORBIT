"""
connectors/notion.py
--------------------
Searches Notion pages and databases via the Notion API.

Uses the Notion Integration Token to:
  1. Search across all pages/databases the integration has access to.
  2. Extract page content (blocks) as plain text.
  3. Return results as EvidenceItems with metadata.

Config (.env):
  NOTION_TOKEN=secret_...  (Internal Integration Token)
"""

import httpx

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import config

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


class NotionConnector(Connector):
    id = "notion"
    name = "Notion"
    icon = "📝"
    fields = [
        {"key": "NOTION_TOKEN", "label": "Notion Integration Token",
         "type": "password", "placeholder": "secret_..."},
    ]

    @property
    def token(self):
        return config.get(self.instance_id, "NOTION_TOKEN", "")

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

    async def test_connection(self) -> ConnectionStatus:
        if not self.token:
            return ConnectionStatus(connected=False, detail="Missing NOTION_TOKEN")
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.get(f"{NOTION_API}/users/me", headers=self._headers())
                data = r.json()
            if r.status_code == 200:
                name = data.get("name", "Integration")
                return ConnectionStatus(connected=True, detail=f"Connected as: {name}")
            return ConnectionStatus(connected=False, detail=data.get("message", "Auth failed"))
        except Exception as e:
            return ConnectionStatus(connected=False, detail=str(e))

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        if not self.token:
            return []

        results: list[EvidenceItem] = []
        query_text = " ".join(q.keywords)
        if q.person:
            query_text += f" {q.person}"
        if q.exact_value:
            query_text += f" {q.exact_value}"

        try:
            async with httpx.AsyncClient(timeout=30) as c:
                # Search Notion pages
                payload = {
                    "query": query_text,
                    "page_size": min(q.limit, 100),
                }
                r = await c.post(f"{NOTION_API}/search", headers=self._headers(), json=payload)
                data = r.json()

                if r.status_code != 200:
                    return []

                for i, item in enumerate(data.get("results", []), start=1):
                    if len(results) >= q.limit:
                        break

                    obj_type = item.get("object", "")
                    title = _extract_title(item)
                    url = item.get("url", "")
                    created = item.get("created_time", "")
                    last_edited = item.get("last_edited_time", "")
                    created_by = _get_user_name(item.get("created_by", {}))

                    # Fetch page content
                    content = ""
                    if obj_type == "page":
                        content = await self._get_page_content(c, item["id"])
                    elif obj_type == "database":
                        content = f"[Database] {title}"

                    results.append(EvidenceItem(
                        id=f"{self.instance_id}-{i}",
                        source=self.id,
                        source_label=self.label,
                        record_id=item.get("id", ""),
                        title=title or "Untitled",
                        snippet=content[:200] if content else "",
                        content=content,
                        author=created_by,
                        timestamp=last_edited or created,
                        link=url,
                        metadata={
                            "type": obj_type,
                            "created_at": created,
                            "last_edited_at": last_edited,
                            "notion_id": item.get("id", ""),
                            "url": url,
                        },
                    ))

        except Exception as e:
            print(f"[notion] Search error: {e}")

        return results

    async def _get_page_content(self, client: httpx.AsyncClient, page_id: str) -> str:
        """Fetch all blocks from a page and extract text."""
        try:
            r = await client.get(
                f"{NOTION_API}/blocks/{page_id}/children?page_size=100",
                headers=self._headers(),
            )
            if r.status_code != 200:
                return ""
            blocks = r.json().get("results", [])
            return "\n".join(_block_to_text(b) for b in blocks if _block_to_text(b))
        except Exception:
            return ""


def _extract_title(item: dict) -> str:
    """Extract title from a Notion page or database object."""
    props = item.get("properties", {})

    # Check for title property
    for prop in props.values():
        if prop.get("type") == "title":
            title_arr = prop.get("title", [])
            if title_arr:
                return "".join(t.get("plain_text", "") for t in title_arr)

    # Database title
    title_arr = item.get("title", [])
    if title_arr:
        return "".join(t.get("plain_text", "") for t in title_arr)

    return ""


def _get_user_name(user: dict) -> str:
    """Get user name from Notion user object."""
    return user.get("name", "") or user.get("id", "unknown")


def _block_to_text(block: dict) -> str:
    """Convert a Notion block to plain text."""
    block_type = block.get("type", "")
    type_data = block.get(block_type, {})

    # Most text blocks have a "rich_text" array
    rich_text = type_data.get("rich_text", [])
    if rich_text:
        return "".join(rt.get("plain_text", "") for rt in rich_text)

    # Some blocks have "text" instead
    text = type_data.get("text", [])
    if isinstance(text, list):
        return "".join(t.get("plain_text", "") for t in text)

    # Child page/database
    if block_type == "child_page":
        return f"[Page: {type_data.get('title', '')}]"
    if block_type == "child_database":
        return f"[Database: {type_data.get('title', '')}]"

    return ""
