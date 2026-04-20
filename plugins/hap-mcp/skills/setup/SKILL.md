---
name: setup
description: 初始化 hap-mcp：收集明道账号密码、写入本地加密凭据、配置 MCP server。用户输入 /hap-mcp:setup 或说"初始化 hap"时触发。
---

# hap-mcp 初始化

定位并运行 setup.js 完成全部配置。

## 步骤

1. 找到脚本路径：
   ```bash
   find ~/.claude -name setup.js -path '*hap-mcp*' 2>/dev/null | head -1
   ```

2. 告知用户在终端执行：
   ```bash
   node <上一步找到的路径>
   ```
   如果 find 没有结果，提示用户先安装：
   `/plugin install hap-mcp@wb4646684-plugins`

3. 脚本会引导用户输入明道账号和密码（密码本地 RSA 加密，不落盘），自动：
   - 登录获取 sessionId
   - 写入 `~/.config/hap-mcp/credentials`
   - 在 `~/.claude.json` 里注册 hap MCP server

4. 完成后提示重启 Claude Code。

## 注意

密码只在内存里用于加密，不会存储明文。
