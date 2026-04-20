# email-mcp

通用 SMTP / IMAP 邮件 MCP server。一套代码，通过环境变量切换支持 QQ 邮箱、163 企业邮、Gmail、Outlook 等任意标准邮件服务。

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

## 前置要求

- **Node.js 18+**
- 一个支持 **SMTP + IMAP** 的邮箱账号
- 邮箱的**应用专用密码 / 授权码**（大多数邮箱不让普通密码走 SMTP，必须申请专用授权码）

## 安装

### 1. 安装插件

```
/plugin marketplace add wb4646684/claude-plugins
/plugin install email-mcp@claude-plugins
```

### 2. 装 npm 依赖

```bash
cd ~/.claude/plugins/cache/claude-plugins/plugins/email-mcp/server
npm install
```

> 路径随 Claude Code 版本可能有微差，用 `find ~/.claude -name package.json -path '*email-mcp*'` 定位

### 3. 配置你的邮箱

插件默认使用 **shell 环境变量**读取配置（便于多邮箱切换、避免凭据写入文件）。在 `~/.zshrc` 或 `~/.bashrc` 里 export：

#### QQ 邮箱

```bash
export SMTP_HOST=smtp.qq.com
export SMTP_PORT=465
export SMTP_USER='your@qq.com'
export SMTP_PASS='<QQ 邮箱授权码>'   # 非登录密码！
export DISPLAY_NAME='你的昵称'
export IMAP_HOST=imap.qq.com
export IMAP_PORT=993
export IMAP_USER='your@qq.com'
export IMAP_PASS='<QQ 邮箱授权码>'
```

> 授权码申请：登录 <https://mail.qq.com/> → 设置 → 账户 → "POP3/IMAP/SMTP..." 开启并获取授权码（16 位）。

#### 163 / 网易企业邮

```bash
export SMTP_HOST=smtp.163.com                # 个人 163
# 企业邮改成 smtphz.qiye.163.com 或你域名的 SMTP 地址
export SMTP_PORT=465
export SMTP_USER='your@163.com'
export SMTP_PASS='<客户端授权密码>'
export DISPLAY_NAME='你的昵称'
export IMAP_HOST=imap.163.com                # 企业邮 imaphz.qiye.163.com
export IMAP_PORT=993
export IMAP_USER='your@163.com'
export IMAP_PASS='<客户端授权密码>'
```

> 授权密码申请：163 设置 → POP3/SMTP/IMAP → 开启服务并生成客户端授权密码。

#### Gmail

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=465
export SMTP_USER='your@gmail.com'
export SMTP_PASS='<Google 应用专用密码>'
export DISPLAY_NAME='你的昵称'
export IMAP_HOST=imap.gmail.com
export IMAP_PORT=993
export IMAP_USER='your@gmail.com'
export IMAP_PASS='<Google 应用专用密码>'
```

> 应用专用密码：Google 账户 → 安全性 → 两步验证 → 应用专用密码（需先开两步验证）。

### 4. 重启 Claude Code 验证

```bash
source ~/.zshrc    # 让 export 生效
# 重启 claude
```

```
/mcp
# email 条目显示 connected 即成功
```

## 多邮箱场景：同时用 QQ + 163 / 企业邮

插件默认只注册一个 `email` 实例。如果要同时用多个邮箱：

**方案 A（推荐）**：在 `~/.claude.json` 里手动追加第二个实例，硬编码 env（绕过 shell 变量）：

```json
{
  "mcpServers": {
    "qqmail": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/you/.claude/plugins/cache/claude-plugins/plugins/email-mcp/server/index.js"],
      "env": {
        "SMTP_HOST": "smtp.qq.com", "SMTP_PORT": "465", "SMTP_SSL": "true",
        "SMTP_USER": "you@qq.com",  "SMTP_PASS": "xxxxxxxxxxxxxxxx",
        "DISPLAY_NAME": "昵称",
        "IMAP_HOST": "imap.qq.com", "IMAP_PORT": "993", "IMAP_SSL": "true",
        "IMAP_USER": "you@qq.com",  "IMAP_PASS": "xxxxxxxxxxxxxxxx"
      }
    },
    "workmail": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/you/.claude/plugins/cache/claude-plugins/plugins/email-mcp/server/index.js"],
      "env": {
        "SMTP_HOST": "smtphz.qiye.163.com", "SMTP_PORT": "465", "SMTP_SSL": "true",
        "SMTP_USER": "you@company.com",     "SMTP_PASS": "xxxxxxxxxxxxxxxx",
        "DISPLAY_NAME": "实名",
        "IMAP_HOST": "imaphz.qiye.163.com", "IMAP_PORT": "993", "IMAP_SSL": "true",
        "IMAP_USER": "you@company.com",     "IMAP_PASS": "xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

这样 Claude 能同时调用 `mcp__qqmail__send_email` 和 `mcp__workmail__send_email`，不冲突。

**注意**：插件自己的 `.mcp.json` 里的 `email` 实例和你手动加的实例会并存。如果不想要默认 `email`，在 `/plugin` 菜单里禁用该插件提供的 MCP，只保留你手动配置的。

## 安全提示

- **授权码 ≠ 登录密码**，别直接用登录密码
- 授权码丢了：去邮箱服务商后台吊销并重新生成
- 不要把授权码提交到 git
- 跨设备同步 shell 配置时，授权码这几行**不要**进公开的 dotfiles 仓库

## 故障排查

| 症状 | 排查 |
|------|------|
| `/mcp` 显示 `email: disconnected` | 环境变量没导入；`env | grep SMTP_` 确认；source 过没 |
| 发送报 `535 Authentication failed` | 用的是登录密码而非授权码；或授权码被吊销了 |
| 发送报 `EAUTH` / `Connection timeout` | SMTP 端口被防火墙挡；检查 465 或 587 端口；或尝试 SSL=false + 端口 587 (STARTTLS) |
| 收取 IMAP 报错 | IMAP 服务未开启；回邮箱后台勾选 IMAP 服务 |
| 中文主题乱码 | 正常，nodemailer 会自动编码；如客户端仍显示乱码，可能是对端邮件客户端问题 |

## License

[MIT](../../LICENSE)
