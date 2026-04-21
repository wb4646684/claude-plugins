# Claude Code Plugins

一组 [Claude Code](https://claude.com/claude-code) 插件，把日常工作里高频用到的能力（明道云 HAP、腾讯云 COS、邮件收发、上下文审计）打包成可一键安装的插件。

---

## 快速安装（三步）

```
# 第一步：添加插件市场（只做一次）
/plugin marketplace add wb4646684/claude-plugins

# 第二步：安装需要的插件
/plugin install hap-mcp@wb4646684-plugins
/plugin install cos-mcp@wb4646684-plugins
/plugin install email-mcp@wb4646684-plugins
/plugin install oldoa-mcp@wb4646684-plugins
/plugin install context-optimize@wb4646684-plugins

# 第三步：初始化各插件（Claude 会在聊天里问你凭据）
/hap-mcp:setup
/cos-mcp:setup
/email-mcp:setup
/oldoa-mcp:setup
# context-optimize 无需初始化，装完即用
```

安装后运行 `/reload-plugins`，再用 `/mcp` 确认连接状态。

> **设计原则**：所有插件的 MCP 注册、token 刷新均通过插件自身机制完成，**不修改你现有的 `~/.claude.json` 配置**，凭据独立存放在 `~/.config/<插件名>/` 目录下。

---

## 插件一览

### 🔗 hap-mcp — 明道云 HAP 连接器

在 Claude Code 里直接操作 HAP（超级应用平台）里的任意工作表——任务看板、CRM、服务清单、审批流程等。

**典型用法**
- 「帮我记一个任务：周五前跟进 xxx」→ 自动写入 HAP 任务表
- 「上周有哪些付款申请？」→ 查 HAP OA 表
- 「这个客户最近一次续费是什么时候？」→ 查 HAP CRM

**需要**：明道云账号（`feng.zhang@mingdao.com` 或手机号）和登录密码

👉 [详细文档](./plugins/hap-mcp/README.md)

---

### ☁️ cos-mcp — 腾讯云 COS 文件中转

把本地文件变成公网 URL，传给需要 URL 的系统（HAP 附件字段、外部系统等）。用完即删。

**典型用法**
- 上传本地 PDF/图片 → 拿到 URL → 塞进 HAP 附件字段
- 给 Claude 生成的报告/图表拿一个可分享链接

**工具**：`cos_upload_temp` / `cos_delete_temp`

**需要**：腾讯云账号 + COS bucket + 子账号 SecretId/SecretKey

👉 [详细文档](./plugins/cos-mcp/README.md)

---

### ✉️ email-mcp — 通用 SMTP/IMAP 邮件

让 Claude 直接收发邮件、读附件、搜邮件。支持 QQ / 163 / 企业邮 / Gmail / Outlook。

**典型用法**
- 「把这份报告发给 xxx@公司.com，附上 PDF」
- 「列一下今天收到的未读邮件」
- 「把刚才那封邮件的附件存到 ~/Downloads」

**工具**：`send_email` / `list_emails` / `get_email` / `search_emails` / `save_attachment` / `mark_email` 等 8 个

**需要**：邮箱的授权码（不是登录密码）

👉 [详细文档](./plugins/email-mcp/README.md)

---

### 📅 oldoa-mcp — 明道协作（动态 + 日程）

让 Claude 操作明道协作的动态和日程。

**典型用法**
- 「发一条动态：今天把 Gitlab 14 升级完了」
- 「帮我建明天下午 2 点的日程，和 A/B 讨论 xxx」
- 「这周有哪些待确认日程」

**工具**：动态 6 个 + 日程 10 个

**需要**：明道云账号（OAuth2 授权，setup 会引导）

👉 [详细文档](./plugins/oldoa-mcp/README.md)

---

### 🧹 context-optimize — Claude 上下文审计

审查你的 memory + skills 结构，指出哪些内容太肿、哪些该拆分、哪些该下沉按需加载。

**什么时候用**：感觉 Claude 响应变慢 / MEMORY.md 超 150 行 / SKILL.md 超 100 行

**触发**：`/context-optimize:context-optimize` 或说「审计下我的 memory」

无需凭据，装完即用。

👉 [详细文档](./plugins/context-optimize/README.md)

---

## 给同事的安装建议

| 优先级 | 插件 | 说明 |
|--------|------|------|
| ★★★ | `hap-mcp` | 直连 HAP，最常用 |
| ★★☆ | `cos-mcp` | 需要腾讯云账号，有了之后文件传输顺滑很多 |
| ★★☆ | `email-mcp` | 需要邮箱授权码，5 分钟搞定 |
| ★☆☆ | `oldoa-mcp` | OAuth 流程略繁琐，按需装 |
| ★☆☆ | `context-optimize` | 用久了再装，优化 Claude 工作记忆 |

---

## 常用命令

```bash
/plugin                                        # 查看已安装插件
/mcp                                           # 查看 MCP 连接状态
/reload-plugins                                # 重新加载插件（装完或改配置后用）
/plugin disable <name>@wb4646684-plugins       # 暂时禁用
/plugin uninstall <name>@wb4646684-plugins     # 完全卸载
/plugin marketplace update wb4646684-plugins   # 更新到最新版
```

---

## License

[MIT](./LICENSE)
