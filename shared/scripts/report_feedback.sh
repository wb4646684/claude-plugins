#!/bin/bash
# 插件安装错误自动上报（公开表单，无需鉴权）
# 用法：source 本文件，在 die() 里调用 report_plugin_error

FEEDBACK_API="https://www.mingdao.com/api/PublicWorksheet/AddRow"
FEEDBACK_WORKSHEET="69e7045f9513a27f83d3ccbd"
FEEDBACK_CLIENT="05a01d0920df02d09d0d10970140db06c0660bb07d0a20a0"
FEEDBACK_ORIGIN="https://d557778d685be9b5.share.mingdao.net"

# report_plugin_error <plugin> <version> <step> <error_msg>
report_plugin_error() {
    command -v python3 &>/dev/null || return 0
    command -v curl   &>/dev/null || return 0

    local PLUGIN="$1" VERSION="$2" STEP="$3" MSG="$4"

    local OS_VER
    OS_VER=$(sw_vers -productVersion 2>/dev/null || uname -sr 2>/dev/null || echo "unknown")

    local AI_VER
    AI_VER=$(claude --version 2>/dev/null | head -1 || echo "unknown")

    local BODY
    BODY=$(python3 - "$PLUGIN" "$VERSION" "$STEP" "$MSG" "$(uname -s)" "$OS_VER" "$AI_VER" <<'PYEOF'
import json, sys

plugin_name, version, step, msg, uname, os_ver, ai_ver = sys.argv[1:]

PLUGIN_KEYS = {
    "hap-mcp":         "4ad4726b-2d82-4f22-8f4f-a02cd8489ef8",
    "cos-mcp":         "91e88e2a-7e9d-4da8-846d-add419852f4b",
    "email-mcp":       "9683cffe-3c1a-4c57-9c5f-1829ca258f6b",
    "oldoa-mcp":       "249b8cb4-67a6-4a27-82d0-463f5b603709",
    "plugin-builder":  "7f6818de-a11d-48cf-ac7d-c0eeba78a5b0",
    "context-optimize":"10e345d3-0ac9-4f2d-885e-8b6b716c1f1d",
}
OS_KEYS = {
    "Darwin":  "2970e8ef-1a7c-4060-b97b-12221ed8919c",
    "Linux":   "3ed18664-4e5d-4ff7-9356-3f323d147d21",
}
plugin_key = PLUGIN_KEYS.get(plugin_name)
if not plugin_key:
    sys.exit(0)
os_key = OS_KEYS.get(uname, "3ed18664-4e5d-4ff7-9356-3f323d147d21")

print(json.dumps({
    "worksheetId": "69e7045f9513a27f83d3ccbd",
    "receiveControls": [
        {"controlId": "69e7045ff93dd47d496c0ece", "type": 2,
         "value": f"{plugin_name} 安装报错：{step}", "controlName": "标题", "dot": 0},
        {"controlId": "69e7045ff93dd47d496c0ecf", "type": 9,
         "value": json.dumps([plugin_key]), "controlName": "插件名", "dot": 0},
        {"controlId": "69e7045ff93dd47d496c0ed0", "type": 2,
         "value": version, "controlName": "版本号", "dot": 0},
        {"controlId": "69e7045ff93dd47d496c0ed1", "type": 2,
         "value": step, "controlName": "步骤", "dot": 0},
        {"controlId": "69e7045ff93dd47d496c0ed2", "type": 2,
         "value": msg, "controlName": "报错内容", "dot": 0},
        {"controlId": "69e7045ff93dd47d496c0ed3", "type": 9,
         "value": json.dumps([os_key]), "controlName": "操作系统", "dot": 0},
        {"controlId": "69e7045ff93dd47d496c0ed4", "type": 9,
         "value": json.dumps(["2c33893a-bbe3-4c18-b678-a847e7e8a43a"]),
         "controlName": "类型", "dot": 0},
        {"controlId": "69e7063a9513a27f83d3cd09", "type": 2,
         "value": ai_ver, "controlName": "AI版本", "dot": 0},
        {"controlId": "69e7063a9513a27f83d3cd0a", "type": 2,
         "value": os_ver, "controlName": "系统版本", "dot": 0},
    ]
}))
PYEOF
    ) || return 0

    curl -s --max-time 5 -X POST "$FEEDBACK_API" \
        -H 'content-type: application/json' \
        -H 'authorization;' \
        -H "clientid: ${FEEDBACK_CLIENT}" \
        -H "origin: ${FEEDBACK_ORIGIN}" \
        -H 'x-requested-with: XMLHttpRequest' \
        --data-raw "$BODY" >/dev/null 2>&1 || true
}
