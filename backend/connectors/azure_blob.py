"""
connectors/azure_blob.py
------------------------
Treats one or more Azure Storage containers like a cloud fileshare.

It lists the blobs in the configured container(s), downloads each document,
extracts text with the same helper the local Fileshare/S3 connectors use, and
turns matches into EvidenceItems.

Auth: classic account name + account key. (Microsoft also supports connection
strings and SAS tokens; we keep this simple and consistent with the S3 pattern.)

Config (.env or popup):
  AZURE_STORAGE_ACCOUNT=mystorageacct
  AZURE_STORAGE_KEY=...
  AZURE_BLOB_CONTAINERS=container-a,container-b
"""

import asyncio

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import textutil, config

SUPPORTED = (".pdf", ".docx", ".txt", ".csv", ".md", ".json", ".log")


class AzureBlobConnector(Connector):
    id = "azure_blob"
    name = "Azure Blob"
    icon = "☁️"
    fields = [
        {"key": "AZURE_STORAGE_ACCOUNT", "label": "Storage account", "type": "text", "placeholder": "mystorageacct"},
        {"key": "AZURE_STORAGE_KEY", "label": "Account key", "type": "password", "placeholder": "..."},
        {"key": "AZURE_BLOB_CONTAINERS", "label": "Containers (comma-separated)", "type": "text", "placeholder": "documents,uploads"},
    ]

    @property
    def account(self): return config.get(self.instance_id, "AZURE_STORAGE_ACCOUNT", "")
    @property
    def account_key(self): return config.get(self.instance_id, "AZURE_STORAGE_KEY", "")
    @property
    def containers(self):
        raw = config.get(self.instance_id, "AZURE_BLOB_CONTAINERS", "")
        return [c.strip() for c in raw.split(",") if c.strip()]

    def _service(self):
        from azure.storage.blob import BlobServiceClient
        return BlobServiceClient(
            account_url=f"https://{self.account}.blob.core.windows.net",
            credential=self.account_key,
        )

    async def test_connection(self) -> ConnectionStatus:
        if not (self.account and self.account_key):
            return ConnectionStatus(connected=False, detail="Missing Azure storage credentials")
        if not self.containers:
            return ConnectionStatus(connected=False, detail="No AZURE_BLOB_CONTAINERS configured")
        try:
            def _check():
                svc = self._service()
                for c in self.containers:
                    # raises if the container is unreachable / not found / forbidden
                    svc.get_container_client(c).get_container_properties()
            await asyncio.to_thread(_check)
            return ConnectionStatus(connected=True, detail=f"{len(self.containers)} container(s) reachable")
        except Exception as e:
            return ConnectionStatus(connected=False, detail=str(e))

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        if not (self.account and self.account_key and self.containers):
            return []

        def _do_search() -> list[EvidenceItem]:
            results: list[EvidenceItem] = []
            svc = self._service()
            n = 0
            for container in self.containers:
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
                        link=f"https://{self.account}.blob.core.windows.net/{container}/{name}",
                        metadata={"container": container, "size_bytes": getattr(blob, "size", None)},
                    ))
            return results

        return await asyncio.to_thread(_do_search)
