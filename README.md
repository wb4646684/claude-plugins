# Claude Code Plugins

一组 [Claude Code](https://claude.com/claude-code) 插件，把日常工作里高频用到的能力（明道云 HAP、腾讯云 COS、邮件收发、上下文审计）打包成可一键安装的插件。

适合明道/Nocoly 团队、以及任何想集成这些工具的 Claude Code 用户。

---

## 快速安装

```
# 1. 添加市场（只需一次）
/plugin marketplace add wb4646684/claude-plugins

# 2. 按需安装 + 初始化（三步完成）
/plugin install hap-mcp@wb4646684-plugins
/hap-mcp:setup

/plugin install cos-mcp@wb4646684-plugins
/cos-mcp:setup

/plugin install email-mcp@wb4646684-plugins
/email-mcp:setup

/plugin install oldoa-mcp@wb4646684-plugins
/oldoa-mcp:setup

/plugin install context-optimize@wb4646684-plugins
# context-optimize 无需初始化，装完即用
```

每个插件安装完后运行对应的 `/xxx:setup`，Claude 会引导你完成凭据配置。

---

## 插件一览

### 🔗 hap-mcp — 明道云 HAP 连接器

**能做什么**：在 Claude Code 里直接操作 HAP（超级应用平台）里的任意工作表数据——任务看板、CRM、服务清单、审批流程等。

**典型场景**：
- 「帮我记一个任务：周五前跟进 xxx」→ 自动写入 HAP 任务表
- 「上周有哪些付款申请？」→ 查 HAP OA 表
- 「这个客户最近一次续费？」→ 查 HAP CRM

**亮点**：自带 session token **自动刷新脚本**——绑 shell alias 后每次启动 Claude 自动续 token，不会中途 10001 报错。

**需要**：明道云账号、加密登录 payload（从浏览器抓）

👉 [详细安装文档](./plugins/hap-mcp/README.md)

---

### ☁️ cos-mcp — 腾讯云 COS 文件中转

**能做什么**：把**本地文件**变成一个**公网 URL**。上传后 Claude 能把 URL 传给其他只认 URL 的系统（比如 HAP 附件字段、只能贴链接的群消息）。用完即删，不囤文件。

**典型场景**：
- 上传本地 PDF/图片 → 拿到 URL → 塞进 HAP 附件字段
- 给 Claude 生成的报告/图表拿一个可分享链接
- 任何「手上是文件路径，但对方要 URL」的场景

**工具**：`cos_upload_temp(path)` / `cos_delete_temp(url)`

**需要**：腾讯云账号、COS bucket、子账号 AK/SK（SecretId + SecretKey）

👉 [详细安装文档](./plugins/cos-mcp/README.md)

---

### ✉️ email-mcp — 通用 SMTP/IMAP 邮件

**能做什么**：让 Claude 直接收发邮件、读附件、搜邮件。一套代码，换 env 就能切 QQ 邮箱 / 163 / 企业邮 / Gmail / Outlook。

**典型场景**：
- 「把这份报告发给 xxx@公司.com」→ 带附件发送
- 「列一下今天收到的未读邮件」→ 自动拉 IMAP
- 「把刚才那封邮件的附件存到 ~/Downloads」→ 自动下载

**工具**：`send_email` / `list_emails` / `get_email` / `search_emails` / `save_attachment` / `mark_email` / `list_folders` / `get_email_html`

**支持多邮箱**：README 里给了在 `~/.claude.json` 追加第二个实例的模板，可以同时接 qqmail + workmail。

**需要**：邮箱的**授权码 / 应用专用密码**（不是登录密码）

👉 [详细安装文档](./plugins/email-mcp/README.md)

---

### 📅 oldoa-mcp — 明道协作（动态 + 日程）

**能做什么**：让 Claude 直接操作明道协作的**动态**和**日程**两块功能。

**典型场景**：
- 「发一条动态：今天把 Gitlab 14 升级完了」→ 自动发布
- 「帮我建明天下午 2 点的日程，和 A/B 讨论 xxx」→ 创建日程 + 邀请成员
- 「这周有哪些待确认日程」→ 列出未回复邀请

**工具**：动态 6 个 + 日程 10 个（新增/编辑/删除/查询/成员管理/搜索）

**需要**：[明道开放平台](https://open.mingdao.com/) 注册应用拿 APP_KEY/SECRET，OAuth2 首次授权（README 有完整流程）

👉 [详细安装文档](./plugins/oldoa-mcp/README.md)

---

### 🧹 context-optimize — Claude 上下文审计

**能做什么**：审查你积累的 memory + skills 结构，指出哪些内容太肿、哪些该拆、哪些该下沉到 `data/` 目录按需加载。

**什么时候用**：
- 用 Claude 几周后感觉响应变慢 / 答非所问
- `MEMORY.md` 超过 150 行（系统会截断）
- 某个 SKILL.md 超过 100 行
- 想把一条记忆整理得更合理但不知道放哪层

**触发方式**：`/context-optimize:context-optimize` 或自然语言「审计下我的 memory 和 skills」

**不需要凭据**，是纯 Skill 插件。

👉 [详细安装文档](./plugins/context-optimize/README.md)

---

## 给同事推荐的安装顺序

| 顺序 | 插件 | 门槛 | 说明 |
|------|------|------|------|
| 1 | `context-optimize` | 低 | 没有凭据配置，装完即用 |
| 2 | `email-mcp` | 中 | 只需邮箱授权码，5 分钟能跑通 |
| 3 | `hap-mcp` | 中 | 需要浏览器抓 payload，但脚本一次配好受用很久 |
| 4 | `oldoa-mcp` | 中高 | OAuth2 首次授权略繁琐（浏览器登录 + exchange code），之后自动 refresh |
| 5 | `cos-mcp` | 高 | 需要腾讯云账号和 bucket，第一次会花点时间 |

**新人建议**：先装 `context-optimize` 感受一下插件机制，再按实际需求装剩下的。没用到的就别装，`/plugin install` 随时可以补。

---

## 卸载 / 禁用

```bash
/plugin                                  # 查看已装插件
/plugin disable <name>@claude-plugins    # 暂时禁用，保留配置
/plugin uninstall <name>@claude-plugins  # 完全卸载
```

## 更新

```bash
/plugin marketplace update claude-plugins   # 拉最新版
```

## 贡献

这是个人工具仓库，暂不接受外部 PR。欢迎 fork 成自己的市场。

## License

[MIT](./LICENSE)
