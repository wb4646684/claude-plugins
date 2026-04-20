---
name: setup
description: 初始化 oldoa-mcp：建应用、OAuth 授权、写凭据。用户输入 /oldoa-mcp:setup 或说"初始化 oldoa"时触发。
---

# oldoa-mcp 初始化

## 步骤

1. 用 Bash 工具找到脚本路径：
   ```bash
   find ~/.claude -name create_app.js -path '*oldoa-mcp*' 2>/dev/null | head -1
   ```
   找不到则提示用户先运行 `/plugin install oldoa-mcp@wb4646684-plugins`，然后 `/reload-plugins`。

2. 直接用 Bash 工具运行脚本（不是让用户自己去终端运行）：
   ```bash
   node <上一步的路径>
   ```
   脚本会通过 Claude Code 内置终端与用户交互（输账号密码、浏览器授权）。

3. 等脚本自检完成（`✅ 自检通过`），提示用户运行 `/reload-plugins` 让 MCP 生效。
