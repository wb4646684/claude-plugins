# email-mcp

通用 SMTP/IMAP 邮件 MCP server。支持 QQ 邮箱、163、企业邮、Gmail、Outlook 等任意标准邮件服务。

---

## 工具列表

| 工具 | 作用 |
|------|------|
| `send_email` | 发邮件，支持 HTML 正文、抄送、密送、附件（本地文件路径） |
| `list_folders` | 列出邮箱所有文件夹 |
| `list_emails` | 列出指定文件夹的邮件（uid/主题/发件人/日期） |
| `get_email` | 读取一封邮件的文本正文 + 附件列表 |
| `get_email_html` | 读取邮件的 HTML 正文 |
| `save_attachment` | 把邮件附件保存到本地 |
| `search_emails` | 按发件人 / 主题 / 日期范围搜索 |
| `mark_email` | 标记邮件为已读 / 未读 |

---

## 前置要求

- Claude Code（桌面版或 CLI）
- Node.js 18+
- 一个支持 SMTP + IMAP 的邮箱账号
- 邮箱的**授权码**（不是登录密码，见下方各邮箱说明）

---

## 安装步骤

**第一步：安装插件**

```
/plugin marketplace add https://github.com/wb4646684/claude-plugins.git
/plugin install email-mcp@wb4646684-plugins
/reload-plugins
```

**第二步：安装 npm 依赖**

```bash
cd $(find ~/.claude/plugins/cache/wb4646684-plugins/email-mcp -name package.json | head -1 | xargs dirname)
npm install
```

**第三步：初始化凭据**

```
/email-mcp:setup
```

Claude 会在聊天里问你邮箱地址和授权码，选择邮箱类型后自动填充 SMTP/IMAP 参数。

**第四步：验证**

```
/mcp
# 看到 email: connected 即成功
```

---

## 各邮箱授权码申请

### QQ 邮箱
登录 [mail.qq.com](https://mail.qq.com/) → 设置 → 账户 → POP3/IMAP/SMTP → 开启服务 → 生成授权码（16 位）

### 163 邮箱
登录 163 → 设置 → POP3/SMTP/IMAP → 开启服务 → 生成客户端授权密码

### 企业邮（163）
SMTP: `smtphz.qiye.163.com:465` / IMAP: `imaphz.qiye.163.com:993`，授权密码在企业邮管理台生成

### Gmail
Google 账户 → 安全性 → 两步验证 → 应用专用密码（需先开两步验证）

### Outlook / Hotmail
使用账户密码（或应用专用密码）；企业 Microsoft 365 需 IT 开启 SMTP AUTH

---

## 工作原理

插件通过 `plugin.json` 注册 MCP，**不修改 `~/.claude.json`**。

凭据存放在 `~/.config/email-mcp/credentials`（权限 600），server 启动时从该文件读取。

```
~/.config/email-mcp/credentials
  SMTP_HOST=smtp.qq.com
  SMTP_PORT=465
  SMTP_USER=xxx@qq.com
  SMTP_PASS=<授权码>
  DISPLAY_NAME=你的昵称
  IMAP_HOST=imap.qq.com
  IMAP_PORT=993
  IMAP_USER=xxx@qq.com
  IMAP_PASS=<授权码>
```

---

## 多邮箱（进阶）

插件默认注册一个名为 `email` 的 MCP 实例。如需同时使用多个邮箱，可在 `~/.claude.json` 的 `mcpServers` 里手动追加额外实例：

```json
"qqmail": {
  "type": "stdio",
  "command": "node",
  "args": ["/path/to/email-mcp/server/index.js"],
  "env": {
    "EMAIL_CREDENTIALS_FILE": "/Users/you/.config/email-mcp/qqmail/credentials"
  }
},
"workmail": {
  "type": "stdio",
  "command": "node",
  "args": ["/path/to/email-mcp/server/index.js"],
  "env": {
    "EMAIL_CREDENTIALS_FILE": "/Users/you/.config/email-mcp/workmail/credentials"
  }
}
```

每个账号建一个凭据文件，`EMAIL_CREDENTIALS_FILE` 指向对应路径。server 路径用 `find ~/.claude/plugins/cache/wb4646684-plugins/email-mcp -name index.js` 查。

---

## 故障排查

| 症状 | 解决方法 |
|------|---------|
| `/mcp` 显示 `email: disconnected` | npm 依赖未安装（见第二步） |
| 发送报 `535 Authentication failed` | 用了登录密码而非授权码；或授权码已被吊销 |
| 发送报 `Connection timeout` | SMTP 端口被防火墙拦截；尝试改用 587（STARTTLS） |
| IMAP 报错 | 邮箱后台未开启 IMAP 服务 |
| 重跑 setup 后不生效 | 运行 `/reload-plugins` |

---

## 安全说明

- 授权码 ≠ 登录密码；泄漏后去邮箱服务商后台吊销并重新生成
- 不要把 credentials 文件提交到 git
- 多设备同步 dotfiles 时，凭据文件不要进公开仓库

---

## License

[MIT](../../LICENSE)
