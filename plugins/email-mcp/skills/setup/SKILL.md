---
name: setup
description: 初始化 email-mcp：交互配置 SMTP/IMAP，支持多邮箱。用户输入 /email-mcp:setup 或说"初始化邮件"时触发。
---

# email-mcp 初始化

## 步骤

1. 在聊天里直接问用户：
   - 邮箱类型（QQ/163/企业邮/Gmail/Outlook/自定义）
   - 邮箱地址
   - 授权码 / 应用专用密码（**不是登录密码**）
   - MCP 实例名称（如 `qqmail`、`workmail`，默认 `email`）
   - 发件人昵称

   **授权码获取方式（提醒用户提前准备）：**
   - QQ 邮箱：mail.qq.com → 设置 → 账户 → POP3/IMAP/SMTP → 开启并生成授权码
   - Gmail：账户 → 安全性 → 两步验证 → 应用专用密码

2. 用 Bash 工具找到脚本路径：
   ```bash
   find ~/.claude -name setup.js -path '*email-mcp*' 2>/dev/null | head -1
   ```
   找不到则提示用户先运行 `/plugin install email-mcp@wb4646684-plugins`，然后 `/reload-plugins`。

3. 用 Bash 工具直接运行脚本，把信息作为参数传入：
   ```bash
   node <上一步的路径> \
     --mcp-name <实例名> \
     --display-name <昵称> \
     --user <邮箱地址> \
     --pass <授权码> \
     --preset <1-6>
   ```
   preset 对应：1=QQ邮箱 2=163邮箱 3=企业邮(163) 4=Gmail 5=Outlook 6=自定义

4. 脚本输出 `✅ email-mcp 配置完成` 后，提示用户运行 `/reload-plugins` 让 MCP 生效。

## 注意

- 如需配置多个邮箱，可多次运行脚本（不同 `--mcp-name`），每次只写入/覆盖对应实例
- 自定义 preset 需额外传 `--smtp-host`、`--smtp-port`、`--imap-host`、`--imap-port`
