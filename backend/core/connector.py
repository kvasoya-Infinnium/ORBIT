"""
core/connector.py
-----------------
This file defines the CONTRACT that every connector must follow.

Think of it like a job description. Any data source that wants to join Nexus must
be able to do exactly two things:
  1. test_connection() -> tell us if its credentials work.
  2. search(query)      -> take a standard query and return Evidence Items.

Because every connector promises to do these two things in the same way, the rest
of Nexus (the agent, the API, the UI) can treat all of them identically. Adding a
brand new source later (Jira, Salesforce...) means writing ONE new class here.
"""

from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel, Field

from core.models import EvidenceItem


class SearchQuery(BaseModel):
    """A normalized search request. The AI 'planner' fills this in from plain English."""
    keywords: list[str] = Field(default_factory=list)  # free-text terms, e.g. ["data breach"]
    person: Optional[str] = None                        # a custodian/subject, e.g. "Rudra Raval"
    exact_value: Optional[str] = None                   # an exact match, e.g. "65200"
    date_from: Optional[str] = None                     # ISO date lower bound
    date_to: Optional[str] = None                       # ISO date upper bound
    # Max matches collected PER connector. Set high for completeness — showing items
    # in the UI costs no tokens (only the LLM summary is capped, in the pipeline).
    limit: int = 200


class ConnectionStatus(BaseModel):
    """The answer to 'are your credentials working?'."""
    connected: bool
    detail: str = ""


class Connector(ABC):
    """The base class every connector inherits from. These three attributes
    identify the connector to the UI; the two methods are the actual contract."""

    id: str = "base"            # the TYPE id, e.g. "email" (same for every instance)
    name: str = "Base"          # the TYPE display name, e.g. "Email (IMAP)"
    icon: str = "🔌"            # emoji shown on the connector card

    # Describes the credential inputs the UI popup should render. Each item:
    #   {"key": "IMAP_HOST", "label": "Host", "type": "text"|"password", "placeholder": "..."}
    fields: list[dict] = []

    def __init__(self):
        # Per-INSTANCE identity. You can create several instances of the same type
        # (e.g. two Fileshares). The registry sets these when it creates an instance.
        #   instance_id : unique per instance, e.g. "fileshare_1", "fileshare_2"
        #   label       : the editable display name, e.g. "HR Fileshare"
        # Credentials and Evidence Item ids are keyed by instance_id, so instances
        # never collide.
        self.instance_id: str = self.id
        self.label: str = self.name

    @abstractmethod
    async def test_connection(self) -> ConnectionStatus:
        """Check that this connector can reach its system. Never raise — return a status."""
        ...

    @abstractmethod
    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        """Run the search and return results already shaped as EvidenceItems."""
        ...
