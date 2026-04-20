"""MCP Server entry point for oldoa (slimmed Mingdao v1 API)."""

from __future__ import annotations

import sys

from mcp.server.fastmcp import FastMCP

from . import tools_post, tools_calendar

mcp = FastMCP(
    "oldoa",
    instructions=(
        "明道协作时代精简版：动态(post)+日程(calendar)。"
        "日期参数格式：YYYY-MM-DD 或 YYYY-MM-DD HH:MM（北京时间）。"
    ),
)

tools_post.register(mcp)
tools_calendar.register(mcp)


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "exchange-code":
        from .auth import exchange_code, get_env_config
        if len(sys.argv) < 3:
            print("Usage: oldoa exchange-code <code>")
            sys.exit(1)
        config = get_env_config()
        result = exchange_code(
            app_key=config["app_key"],
            app_secret=config["app_secret"],
            redirect_uri=config["redirect_uri"],
            code=sys.argv[2],
        )
        if result.get("success"):
            print("Token saved to .secrets.json")
        else:
            print(f"Error: {result}")
            sys.exit(1)
    elif len(sys.argv) > 1 and sys.argv[1] == "authorize-url":
        from .auth import build_authorize_url, get_env_config
        config = get_env_config()
        url = build_authorize_url(config["app_key"], config["redirect_uri"])
        print(f"Open this URL in your browser:\n{url}")
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
