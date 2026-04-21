---
name: setup
description: 管理 email-mcp 账号：新增/更新/删除邮箱。用户输入 /email-mcp:setup 或说"添加邮箱""配置邮件"时触发。
---

# email-mcp 账号管理

所有账号保存在 `~/.config/email-mcp/accounts.json`，单个 MCP 实例支持多账号。

## 新增或更新账号

1. 在聊天里收集以下信息：
   - 账号名称（如 `mdmail`、`nocolymail`，用于工具调用时区分）
   - 邮箱类型（选 preset：1=QQ 2=163 3=企业邮163 4=Gmail 5=Outlook/365 6=自定义）
   - 邮箱地址
   - 授权码（不是登录密码）
   - 发件人昵称（可选，默认用账号名）

   **授权码获取提示（根据类型告知用户）：**
   - QQ：mail.qq.com → 设置 → 账户 → POP3/IMAP/SMTP → 生成授权码
   - Gmail：账户 → 安全性 → 两步验证 → 应用专用密码
   - Outlook：使用账户密码或应用专用密码

2. 找到脚本路径：
   ```bash
   find ~/.claude -name setup.js -path '*email-mcp*' 2>/dev/null | head -1
   ```

3. 运行脚本：
   ```bash
   node <路径> \
     --name <账号名> \
     --display-name <昵称> \
     --user <邮箱地址> \
     --pass <授权码> \
     --preset <1-6>
   ```
   Outlook 用 `--preset 5`；自定义需额外传 `--smtp-host`、`--smtp-port`、`--imap-host`、`--imap-port`。

4. 输出 `✅ 账号 "xxx" 已新增/更新` 后，提示用户运行 `/reload-plugins`。

## 查看现有账号

```bash
node <路径> --list
```

## 删除账号

```bash
node <路径> --name <账号名> --delete
```

## 注意

- 重复传相同 `--name` 会覆盖更新该账号，不影响其他账号
- 工具调用时通过 `account` 参数指定使用哪个账号，不填则用第一个
