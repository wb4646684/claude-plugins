#!/bin/bash
# HAP MCP — session token 自动刷新脚本
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
TOKEN_FILE="${HAP_MCP_TOKEN:-$(dirname "$CRED_FILE")/token}"
LOGIN_URL="https://www.mingdao.com/api/Login/MDAccountLogin"

# ---------- 工具函数 ----------
header() {
    echo ""
    echo -e "  ${1}${BOLD}◆ HAP${RESET}  ${BOLD}Token Refresh${RESET}  ${DARK}·  $(date '+%H:%M:%S')${RESET}"
    echo -e "  ${DARK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
}

die() {
    echo -e "  ${RED}✘${RESET}  ${BOLD}$1${RESET}" >&2
    [ $# -ge 2 ] && echo -e "  ${DARK}→ $2${RESET}" >&2
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

# ---------- 依赖检查 ----------
for _cmd in curl python3; do
    if ! command -v "$_cmd" &>/dev/null; then
        die "缺少依赖：$_cmd" "请先安装 $_cmd 后重试"
    fi
done

# ---------- 主流程 ----------

MARKER_FILE="${HAP_MCP_MARKER:-$(dirname "$CRED_FILE")/.last_refresh}"
FRESH_SECONDS="${HAP_MCP_FRESH_SECS:-1800}"

# 1. token 还新鲜则跳过
if [ -f "$MARKER_FILE" ]; then
    now=$(date +%s)
    mtime=$(stat -f %m "$MARKER_FILE" 2>/dev/null || stat -c %Y "$MARKER_FILE" 2>/dev/null || echo 0)
    age=$(( now - mtime ))
    if [ "$age" -lt "$FRESH_SECONDS" ]; then
        if [ "${HAP_MCP_QUIET:-1}" = "1" ]; then
            exit 0
        fi
        header "$CYAN"
        echo -e "  ${CYAN}⏭${RESET}  ${DIM}token 还新鲜（${age}s 前刷过，阈值 ${FRESH_SECONDS}s）${RESET}"
        echo ""
        exit 0
    fi
fi

header "$ORANGE"

# 2. 加载凭据
if [ -n "${CLAUDE_PLUGIN_OPTION_USERNAME:-}" ] && [ -n "${CLAUDE_PLUGIN_OPTION_PASSWORD:-}" ]; then
    HAP_LOGIN_ACCOUNT="$CLAUDE_PLUGIN_OPTION_USERNAME"
    HAP_LOGIN_PASSWORD="$CLAUDE_PLUGIN_OPTION_PASSWORD"
elif [ -f "$CRED_FILE" ]; then
    # shellcheck disable=SC1090
    source "$CRED_FILE"
    : "${HAP_LOGIN_ACCOUNT:?凭据文件缺字段 HAP_LOGIN_ACCOUNT}"
    : "${HAP_LOGIN_PASSWORD:?凭据文件缺字段 HAP_LOGIN_PASSWORD}"
    if [ -z "$HAP_LOGIN_ACCOUNT" ] || [ -z "$HAP_LOGIN_PASSWORD" ]; then
        die "凭据为空" "请重新运行 /hap-mcp:setup"
    fi
    export HAP_LOGIN_ACCOUNT HAP_LOGIN_PASSWORD
else
    die "凭据未配置" "请运行 /hap-mcp:setup 完成初始化"
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

curl -s --max-time 15 -X POST "$LOGIN_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    > "$TMP_RESP" &
CURL_PID=$!
spinner "$CURL_PID"
wait "$CURL_PID" || die "登录请求失败" "检查网络连接，或确认 mingdao.com 可访问"

RESPONSE=$(cat "$TMP_RESP")

# 4. 解析响应，提取 sessionId 或友好错误消息
PARSE_RESULT=$(python3 -c "
import json, sys
resp = sys.argv[1]
try:
    d = json.loads(resp)
except Exception:
    print('ERROR:响应不是合法 JSON：' + resp[:200])
    sys.exit(0)
sid = (d.get('data') or {}).get('sessionId', '')
if sid:
    print('OK:' + sid)
else:
    msg = d.get('exception') or d.get('msg') or d.get('message') or resp[:300]
    print('ERROR:' + str(msg))
" "$RESPONSE" 2>/dev/null)

if [[ "$PARSE_RESULT" == OK:* ]]; then
    SESSION_ID="${PARSE_RESULT#OK:}"
else
    ERR_MSG="${PARSE_RESULT#ERROR:}"
    # 针对常见错误给出具体提示
    if echo "$ERR_MSG" | grep -q "时间"; then
        die "鉴权失败：$ERR_MSG" "系统时间与服务器不一致，请校准后重试：sudo sntp -sS time.apple.com"
    elif echo "$ERR_MSG" | grep -q "验证码\|captcha\|图形"; then
        die "鉴权失败：$ERR_MSG" "触发了图形验证码，请先在浏览器登录一次明道云再重试"
    elif echo "$ERR_MSG" | grep -q "密码\|账号\|不存在"; then
        die "鉴权失败：$ERR_MSG" "账号或密码错误，请重新运行 /hap-mcp:setup"
    else
        die "鉴权失败：$ERR_MSG" "如持续失败请重新运行 /hap-mcp:setup"
    fi
fi

# 5. 写入 token 文件
echo -n "$SESSION_ID" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE" 2>/dev/null || true
touch "$MARKER_FILE" 2>/dev/null || true

echo -e "  ${GREEN}✔${RESET}  ${BOLD}Token 已更新${RESET}  ${GRAY}${SESSION_ID:0:12}...${RESET}"
echo ""
