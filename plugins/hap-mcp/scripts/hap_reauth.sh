#!/bin/bash
# HAP MCP — session token 自动刷新脚本
#
# 作用：
#   调用 mingdao.com 登录接口，获取新的 sessionId，
#   写入 ~/.claude.json 的 mcpServers.hap.url，
#   避免 token 过期导致 HAP MCP 报 error_code: 10001。
#
# 使用方式：
#   1. 复制 credentials.example 到 ~/.config/hap-mcp/credentials 并填入加密凭据
#   2. 在 shell alias 里于 claude 启动前调用本脚本
#
# 凭据文件位置：
#   默认 $HOME/.config/hap-mcp/credentials
#   可通过环境变量 HAP_MCP_CREDENTIALS 覆盖

set -uo pipefail

# ---------- 配色 ----------
ORANGE='\033[38;5;208m'
CYAN='\033[38;5;117m'
GREEN='\033[38;5;114m'
RED='\033[38;5;203m'
GRAY='\033[38;5;245m'
DARK='\033[38;5;238m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ---------- 配置 ----------
CRED_FILE="${HAP_MCP_CREDENTIALS:-$HOME/.config/hap-mcp/credentials}"
CLAUDE_CONFIG="${CLAUDE_CONFIG:-$HOME/.claude.json}"
LOGIN_URL="https://www.mingdao.com/api/Login/MDAccountLogin"
MCP_BASE_URL="https://api2.mingdao.com/mcp"

# ---------- 工具函数 ----------
header() {
    local color="$1"
    echo ""
    echo -e "  ${color}${BOLD}◆ HAP${RESET}  ${BOLD}Token Refresh${RESET}  ${DARK}·  $(date '+%H:%M:%S')${RESET}"
    echo -e "  ${DARK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
}

die() {
    echo -e "  ${RED}✘${RESET}  ${BOLD}$1${RESET}" >&2
    [ $# -ge 2 ] && echo -e "  ${DARK}$2${RESET}" >&2
    echo ""
    exit 1
}

spinner() {
    local pid=$1
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${ORANGE}${frames[$i]}${RESET}  ${GRAY}正在连接 mingdao.com ...${RESET}"
        i=$(( (i+1) % ${#frames[@]} ))
        sleep 0.08
    done
    printf "\r\033[K"
}

# ---------- 主流程 ----------

# 1. 检测已有 claude 会话，有就跳过（避免覆盖正在用的 token）
RUNNING=$(pgrep -x claude 2>/dev/null | wc -l | tr -d ' ')
if [ "${RUNNING:-0}" -gt 0 ]; then
    header "$CYAN"
    echo -e "  ${CYAN}⏭${RESET}  ${DIM}检测到 ${RUNNING} 个活跃会话，跳过刷新${RESET}"
    echo ""
    exit 0
fi

header "$ORANGE"

# 2. 加载凭据
if [ ! -f "$CRED_FILE" ]; then
    die "凭据文件不存在" "路径：$CRED_FILE
  请从插件目录复制 credentials.example 到该位置并填入加密凭据：
      mkdir -p \"$(dirname "$CRED_FILE")\"
      cp <plugin>/scripts/credentials.example \"$CRED_FILE\"
      chmod 600 \"$CRED_FILE\""
fi

# shellcheck disable=SC1090
source "$CRED_FILE"

: "${HAP_LOGIN_ACCOUNT:?凭据文件缺字段 HAP_LOGIN_ACCOUNT}"
: "${HAP_LOGIN_PASSWORD:?凭据文件缺字段 HAP_LOGIN_PASSWORD}"

if [ -z "$HAP_LOGIN_ACCOUNT" ] || [ -z "$HAP_LOGIN_PASSWORD" ]; then
    die "凭据为空" "请在 $CRED_FILE 里填入 HAP_LOGIN_ACCOUNT 和 HAP_LOGIN_PASSWORD"
fi

# 3. 调用登录接口
TMP_RESP=$(mktemp -t hap_resp.XXXXXX)
trap 'rm -f "$TMP_RESP"' EXIT

PAYLOAD=$(python3 -c "
import json, os
print(json.dumps({
    'account': os.environ['HAP_LOGIN_ACCOUNT'],
    'password': os.environ['HAP_LOGIN_PASSWORD'],
    'isCookie': False,
    'captchaType': 0,
}))
")

curl -s -X POST "$LOGIN_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    > "$TMP_RESP" &
CURL_PID=$!
spinner "$CURL_PID"
wait "$CURL_PID" || die "登录请求失败（网络不通？）"

RESPONSE=$(cat "$TMP_RESP")

SESSION_ID=$(python3 -c "
import json, sys
try:
    d = json.loads(sys.argv[1])
    print(d.get('data', {}).get('sessionId', ''))
except Exception:
    pass
" "$RESPONSE" 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
    die "鉴权失败" "响应：$RESPONSE
  常见原因：凭据过期（明道前端加密参数已更新）→ 重新抓取 MDAccountLogin payload"
fi

# 4. 写入 ~/.claude.json，若无 mcpServers.hap 则自动创建
if [ ! -f "$CLAUDE_CONFIG" ]; then
    die "Claude 配置文件不存在" "路径：$CLAUDE_CONFIG
  请先启动一次 claude 生成该文件"
fi

python3 - <<PYEOF "$CLAUDE_CONFIG" "$SESSION_ID" "$MCP_BASE_URL"
import json, sys, urllib.parse

cfg_path, session_id, base_url = sys.argv[1:4]
auth_param = urllib.parse.quote(f"md_pss_id {session_id}")
new_url = f"{base_url}?Authorization={auth_param}"

with open(cfg_path) as f:
    cfg = json.load(f)

cfg.setdefault("mcpServers", {})
cfg["mcpServers"].setdefault("hap", {"type": "http"})
cfg["mcpServers"]["hap"]["type"] = "http"
cfg["mcpServers"]["hap"]["url"] = new_url

with open(cfg_path, "w") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)
PYEOF

if [ $? -ne 0 ]; then
    die "写入 Claude 配置失败" "$CLAUDE_CONFIG"
fi

echo -e "  ${GREEN}✔${RESET}  ${BOLD}Token 已更新${RESET}  ${GRAY}${SESSION_ID:0:12}...${RESET}"
echo ""
