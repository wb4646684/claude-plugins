---
name: setup
description: 初始化 email-mcp：交互配置 SMTP/IMAP，支持多邮箱。用户输入 /email-mcp:setup 或说"初始化邮件"时触发。
---

# email-mcp 初始化

定位并运行 setup.js 完成配置。

## 步骤

1. 找到脚本：
   ```bash
   find ~/.claude -name setup.js -path '*email-mcp*' 2>/dev/null | head -1
   ```

2. 告知用户在终端执行：
   ```bash
   node <上一步找到的路径>
   ```
   未找到则提示先安装：
   `/plugin install email-mcp@wb4646684-plugins`

3. 脚本支持的邮箱类型：QQ 邮箱、163、企业邮（163）、Gmail、Outlook、自定义。
   可一次配置多个邮箱（如同时配 qqmail + workmail）。

4. 凭据写入 `~/.claude.json` mcpServers，重启 Claude Code 生效。

## 注意

- 需要**授权码 / 应用专用密码**，不是登录密码
- QQ 邮箱：mail.qq.com → 设置 → 账户 → POP3/IMAP/SMTP → 开启并生成授权码
- Gmail：需先开两步验证，再生成应用专用密码
