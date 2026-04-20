---
name: setup
description: 初始化 email-mcp：交互配置 SMTP/IMAP，支持多邮箱。用户输入 /email-mcp:setup 或说"初始化邮件"时触发。
---

# email-mcp 初始化

## 步骤

1. 用 Bash 工具找到脚本路径：
   ```bash
   find ~/.claude -name setup.js -path '*email-mcp*' 2>/dev/null | head -1
   ```
   找不到则提示用户先运行 `/plugin install email-mcp@wb4646684-plugins`，然后 `/reload-plugins`。

2. 直接用 Bash 工具运行脚本：
   ```bash
   node <上一步的路径>
   ```

3. 脚本完成后提示用户运行 `/reload-plugins` 让 MCP 生效。

## 前置提示

运行前告知用户需要准备：邮箱的**授权码 / 应用专用密码**（不是登录密码）。
- QQ 邮箱：mail.qq.com → 设置 → 账户 → POP3/IMAP/SMTP → 开启并生成授权码
- Gmail：需先开两步验证，再生成应用专用密码
