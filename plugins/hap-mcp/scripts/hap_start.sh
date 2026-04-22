#!/bin/bash
# HAP MCP stdio wrapper
# 读取 token 文件，通过 mcp-remote 桥接到 HAP HTTP MCP。
# 由 setup.js 复制到 ~/.config/hap-mcp/hap_start.sh，路径固定不随插件版本变化。

TOKEN_FILE="${HAP_MCP_TOKEN:-$HOME/.config/hap-mcp/token}"
MCP_BASE_URL="https://api.mingdao.com/mcp"

if ! command -v node &>/dev/null; then
    echo "hap-mcp 需要 Node.js 18+，未检测到 node，请先安装：https://nodejs.org/" >&2
    exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])" 2>/dev/null)
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ]; then
    echo "hap-mcp 需要 Node.js 18+，当前版本 $(node --version)，请升级后重新运行 /hap-mcp:setup" >&2
    echo "  macOS: brew install node  或  https://nodejs.org/" >&2
    exit 1
fi

if ! command -v npx &>/dev/null; then
    echo "hap-mcp 需要 Node.js 18+（npx），请先安装：https://nodejs.org/" >&2
    exit 1
fi

if [ ! -f "$TOKEN_FILE" ]; then
    echo "HAP token not found at $TOKEN_FILE. Run /hap-mcp:setup first." >&2
    exit 1
fi

TOKEN=$(cat "$TOKEN_FILE")
if [ -z "$TOKEN" ]; then
    echo "HAP token is empty. Run /hap-mcp:setup first." >&2
    exit 1
fi

AUTH=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote('md_pss_id '+sys.argv[1]))" "$TOKEN")
exec npx --yes mcp-remote "${MCP_BASE_URL}?Authorization=${AUTH}"
