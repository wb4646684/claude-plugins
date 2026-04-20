---
name: setup
description: 初始化 cos-mcp：收集腾讯云 COS 凭据，写入 MCP 配置。用户输入 /cos-mcp:setup 或说"初始化 cos"时触发。
---

# cos-mcp 初始化

定位并运行 setup.js 完成配置。

## 步骤

1. 找到脚本：
   ```bash
   find ~/.claude -name setup.js -path '*cos-mcp*' 2>/dev/null | head -1
   ```

2. 告知用户在终端执行：
   ```bash
   node <上一步找到的路径>
   ```
   未找到则提示先安装：
   `/plugin install cos-mcp@wb4646684-plugins`

3. 脚本交互收集：
   - COS_SECRET_ID / COS_SECRET_KEY（子账号凭据，不要用主账号）
   - COS_BUCKET（bucket 全名含 appid）
   - COS_REGION（默认 ap-shanghai）

4. 凭据直接写入 `~/.claude.json` mcpServers.cos.env，重启 Claude Code 生效。

## 注意

bucket 需设置为**公有读私有写**，否则上传后 URL 无法访问。
