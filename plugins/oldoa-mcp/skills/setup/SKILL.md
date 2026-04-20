---
name: setup
description: 初始化 oldoa-mcp：建应用、OAuth 授权、写凭据。用户输入 /oldoa-mcp:setup 或说"初始化 oldoa"时触发。
---

# oldoa-mcp 初始化

定位并运行 create_app.js 完成全部配置。

## 步骤

1. 找到脚本路径：
   ```bash
   find ~/.claude -name create_app.js -path '*oldoa-mcp*' 2>/dev/null | head -1
   ```

2. 用 Bash 工具运行（需要交互式终端，告知用户在终端里执行）：
   ```bash
   node <上一步找到的路径>
   ```
   如果 find 没有结果，说明插件未安装，提示用户先运行：
   `/plugin install oldoa-mcp@wb4646684-plugins`

3. 脚本会引导用户：
   - 检测已有配置 → 提示选择新建或复用
   - 登录明道账号、创建应用、OAuth 浏览器授权（自动捕获 code）
   - 自检：发动态 → 查详情 → 删动态

4. 全部完成后提示用户重启 Claude Code 让 MCP 生效。

## 注意

脚本需要交互式终端（读密码、等浏览器回调），直接在 Claude Code 终端里运行。
