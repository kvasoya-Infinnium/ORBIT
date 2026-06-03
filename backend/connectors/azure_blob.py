"""
connectors/azure_blob.py
------------------------
Treats one or more Azure Storage containers like a cloud fileshare.

It lists the blobs in the configured container(s), downloads each document,
extracts text with the same helper the local Fileshare/S3 connectors use, and
turns matches into EvidenceItems.

Auth: a Storage Account connection string (the kind that starts with
"DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=
core.windows.net"). If "Containers" is left blank we auto-discover every
container the credential can read.

Config (.env or popup):
  AZURE_BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
  AZURE_BLOB_CONTAINERS=container-a,container-b   (optional — blank = all)
"""

import asyncio

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import textutil, config

SUPPORTED = (".pdf", ".docx", ".txt", ".csv", ".md", ".json", ".log")


def _parse_account_name(conn_str: str) -> str:
    """Pull the AccountName out of a storage connection string."""
    for part in conn_str.split(";"):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        if k.strip().lower() == "accountname":
            return v.strip()
    return ""


class AzureBlobConnector(Connector):
    id = "azure_blob"
    name = "Azure Blob"
    icon = "☁️"
    fields = [
        {
            "key": "AZURE_BLOB_CONNECTION_STRING",
            "label": "Connection string",
            "type": "password",
            "placeholder": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net",
        },
        {
            "key": "AZURE_BLOB_CONTAINERS",
            "label": "Containers (comma-separated, blank = all)",
            "type": "text",
            "placeholder": "documents,uploads",
        },
    ]

    @property
    def connection_string(self):
        return config.get(self.instance_id, "AZURE_BLOB_CONNECTION_STRING", "")

    @property
    def configured_containers(self):
        raw = config.get(self.instance_id, "AZURE_BLOB_CONTAINERS", "")
        return [c.strip() for c in raw.split(",") if c.strip()]

    @property
    def account(self):
        return _parse_account_name(self.connection_string)

    def _service(self):
        from azure.storage.blob import BlobServiceClient
        return BlobServiceClient.from_connection_string(self.connection_string)

    def _containers_for(self, svc) -> list[str]:
        """Return either the explicitly configured containers or every container
        the credential can list."""
        if self.configured_containers:
            return self.configured_containers
        return [c.name for c in svc.list_containers()]

    async def test_connection(self) -> ConnectionStatus:
        if not self.connection_string:
            return ConnectionStatus(connected=False, detail="Missing Azure connection string")
        try:
            def _check() -> str:
                svc = self._service()
                containers = self._containers_for(svc)
                if not containers:
                    raise RuntimeError("No containers found for this account")
                # touch each configured container so a typo / missing container is reported
                if self.configured_containers:
                    for c in containers:
                        svc.get_container_client(c).get_container_properties()
                return f"{len(containers)} container(s) reachable"
            detail = await asyncio.to_thread(_check)
            return ConnectionStatus(connected=True, detail=detail)
        except Exception as e:
            return ConnectionStatus(connected=False, detail=str(e))

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        if not self.connection_string:
            return []

        def _do_search() -> list[EvidenceItem]:
            results: list[EvidenceItem] = []
            svc = self._service()
            account = self.account
            n = 0
            for container in self._containers_for(svc):
                client = svc.get_container_client(container)
                for blob in client.list_blobs():
                    if len(results) >= q.limit:
                        return results
                    name = blob.name
                    if not name.lower().endswith(SUPPORTED):
                        continue
                    body = client.download_blob(name).readall()
                    text = textutil.extract_text(name, body)
                    if not (textutil.matches(text, q) or textutil.matches(name, q)):
                        continue
                    n += 1
                    results.append(EvidenceItem(
                        id=f"{self.instance_id}-{n}",
                        source=self.id,
                        source_label=self.label,
                        record_id=f"{container}/{name}",
                        title=name.split("/")[-1],
                        snippet=textutil.make_snippet(text, q),
                        content=text,
                        author=None,
                        timestamp=blob.last_modified.isoformat() if getattr(blob, "last_modified", None) else None,
                        link=f"https://{account}.blob.core.windows.net/{container}/{name}" if account else None,
                        metadata={"container": container, "size_bytes": getattr(blob, "size", None)},
                    ))
            return results

        return await asyncio.to_thread(_do_search)
