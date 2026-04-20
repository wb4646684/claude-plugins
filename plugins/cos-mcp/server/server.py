#!/usr/bin/env python3
"""Tencent Cloud COS temporary file hosting MCP server.

Provides upload and delete tools for using COS as a temporary URL bridge
(e.g., passing local files to HAP attachment fields or other systems
that require a URL rather than a local path).
"""

import os
import time
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from qcloud_cos import CosConfig, CosS3Client

SECRET_ID = os.environ["COS_SECRET_ID"]
SECRET_KEY = os.environ["COS_SECRET_KEY"]
BUCKET = os.environ["COS_BUCKET"]
REGION = os.environ.get("COS_REGION", "ap-shanghai")
PREFIX = os.environ.get("COS_PREFIX", "tmp")

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
