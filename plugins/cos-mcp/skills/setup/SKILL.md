---
name: setup
description: 初始化 cos-mcp：收集腾讯云 COS 凭据，写入 MCP 配置。用户输入 /cos-mcp:setup 或说"初始化 cos"时触发。
---

# cos-mcp 初始化

## 步骤

1. 用 Bash 工具找到脚本路径：
   ```bash
   find ~/.claude -name setup.js -path '*cos-mcp*' 2>/dev/null | head -1
   ```
   找不到则提示用户先运行 `/plugin install cos-mcp@wb4646684-plugins`，然后 `/reload-plugins`。

2. 直接用 Bash 工具运行脚本：
   ```bash
   node <上一步的路径>
   ```

3. 脚本完成后提示用户运行 `/reload-plugins` 让 MCP 生效。

## 前置提示

运行前告知用户需要准备：腾讯云子账号 SecretId / SecretKey + COS bucket 名称（需设置为**公有读私有写**）。
