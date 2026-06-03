"""
connectors/aws_s3.py
--------------------
Treats one or more AWS S3 buckets like a cloud fileshare.

It lists the objects in the bucket(s), downloads each document, extracts its text
with the SAME helper the local Fileshare connector uses, and turns matches into
EvidenceItems. So "search documents on AWS" reuses almost all the Fileshare logic.

Auth note: AWS uses an ACCESS KEY ID + SECRET ACCESS KEY + REGION. (You called these
"client id / key / secret" — they map to the same idea.)

Config (.env):
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_REGION=us-east-1
  AWS_S3_BUCKETS=my-bucket,another-bucket     (comma-separated)
"""

from core.connector import Connector, SearchQuery, ConnectionStatus
from core.models import EvidenceItem
from core import textutil, config

SUPPORTED = (".pdf", ".docx", ".txt", ".csv", ".md", ".json", ".log")


class S3Connector(Connector):
    id = "s3"
    name = "AWS S3"
    icon = "🪣"
    fields = [
        {"key": "AWS_ACCESS_KEY_ID", "label": "Access key ID", "type": "text", "placeholder": "AKIA..."},
        {"key": "AWS_SECRET_ACCESS_KEY", "label": "Secret access key", "type": "password", "placeholder": "..."},
        {"key": "AWS_REGION", "label": "Region", "type": "text", "placeholder": "us-east-1"},
        {"key": "AWS_S3_BUCKETS", "label": "Buckets (comma-separated)", "type": "text", "placeholder": "my-bucket"},
    ]

    @property
    def key_id(self): return config.get(self.instance_id, "AWS_ACCESS_KEY_ID", "")
    @property
    def secret(self): return config.get(self.instance_id, "AWS_SECRET_ACCESS_KEY", "")
    @property
    def region(self): return config.get(self.instance_id, "AWS_REGION", "us-east-1")
    @property
    def buckets(self):
        raw = config.get(self.instance_id, "AWS_S3_BUCKETS", "")
        return [b.strip() for b in raw.split(",") if b.strip()]

    def _client(self):
        import boto3
        return boto3.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=self.key_id,
            aws_secret_access_key=self.secret,
        )

    async def test_connection(self) -> ConnectionStatus:
        if not (self.key_id and self.secret):
            return ConnectionStatus(connected=False, detail="Missing AWS credentials")
        if not self.buckets:
            return ConnectionStatus(connected=False, detail="No AWS_S3_BUCKETS configured")
        try:
            s3 = self._client()
            for b in self.buckets:
                s3.head_bucket(Bucket=b)  # raises if we can't reach it
            return ConnectionStatus(connected=True, detail=f"{len(self.buckets)} bucket(s) reachable")
        except Exception as e:
            return ConnectionStatus(connected=False, detail=str(e))

    async def search(self, q: SearchQuery) -> list[EvidenceItem]:
        results: list[EvidenceItem] = []
        s3 = self._client()
        n = 0
        for bucket in self.buckets:
            paginator = s3.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket):
                for obj in page.get("Contents", []):
                    if len(results) >= q.limit:
                        return results
                    key = obj["Key"]
                    if not key.lower().endswith(SUPPORTED):
                        continue
                    body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
                    text = textutil.extract_text(key, body)
                    if not (textutil.matches(text, q) or textutil.matches(key, q)):
                        continue
                    n += 1
                    results.append(EvidenceItem(
                        id=f"{self.instance_id}-{n}",
                        source=self.id,
                        source_label=self.label,
                        record_id=f"{bucket}/{key}",
                        title=key.split("/")[-1],
                        snippet=textutil.make_snippet(text, q),
                        content=text,
                        author=obj.get("Owner", {}).get("DisplayName"),
                        timestamp=obj["LastModified"].isoformat() if obj.get("LastModified") else None,
                        link=f"s3://{bucket}/{key}",
                        metadata={"bucket": bucket, "size_bytes": obj.get("Size")},
                    ))
        return results
