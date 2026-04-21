#!/usr/bin/env python3
"""Tencent Cloud COS temporary file hosting MCP server.

Provides upload and delete tools for using COS as a temporary URL bridge
(e.g., passing local files to HAP attachment fields or other systems
that require a URL rather than a local path).
"""

import os
import sys
import time
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from qcloud_cos import CosConfig, CosS3Client


def _load_creds(path: str) -> dict:
    creds: dict = {}
    try:
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                creds[k.strip()] = v.strip().strip("'\"")
    except Exception:
        pass
    return creds


_cred_file = os.environ.get(
    "COS_CREDENTIALS_FILE",
    str(Path.home() / ".config/cos-mcp/credentials"),
)
_creds = _load_creds(_cred_file)


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key) or _creds.get(key) or default


SECRET_ID = _get("COS_SECRET_ID")
SECRET_KEY = _get("COS_SECRET_KEY")
BUCKET = _get("COS_BUCKET")
REGION = _get("COS_REGION", "ap-shanghai")
PREFIX = _get("COS_PREFIX", "tmp")

if not SECRET_ID or not SECRET_KEY or not BUCKET:
    print(
        f"COS credentials not configured (checked {_cred_file}). "
        "Run /cos-mcp:setup first.",
        file=sys.stderr,
    )
    sys.exit(1)

mcp = FastMCP("cos")


def _client() -> CosS3Client:
    config = CosConfig(Region=REGION, SecretId=SECRET_ID, SecretKey=SECRET_KEY)
    return CosS3Client(config)


@mcp.tool()
def cos_upload_temp(file_path: str) -> str:
    """Upload a local file to COS temporary storage and return its public URL.

    Args:
        file_path: Absolute path to the local file to upload.

    Returns:
        Public HTTPS URL of the uploaded file.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ts = int(time.time())
    key = f"{PREFIX}/{ts}_{path.name}"

    client = _client()
    with open(file_path, "rb") as f:
        client.put_object(Bucket=BUCKET, Body=f, Key=key, EnableMD5=False)

    url = f"https://{BUCKET}.cos.{REGION}.myqcloud.com/{key}"
    return url


@mcp.tool()
def cos_delete_temp(url: str) -> str:
    """Delete a previously uploaded temporary file from COS by its URL.

    Args:
        url: The full COS URL returned by cos_upload_temp.

    Returns:
        Confirmation message.
    """
    prefix = f"https://{BUCKET}.cos.{REGION}.myqcloud.com/"
    if not url.startswith(prefix):
        raise ValueError(f"URL does not belong to configured bucket: {url}")

    key = url[len(prefix):]
    client = _client()
    client.delete_object(Bucket=BUCKET, Key=key)
    return f"Deleted: {key}"


if __name__ == "__main__":
    mcp.run()
