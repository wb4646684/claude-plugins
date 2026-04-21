# Claude Code Plugins

一组 [Claude Code](https://claude.com/claude-code) 插件，把明道云 HAP、腾讯云 COS、邮件收发、明道协作等能力打包成可一键安装的插件。

---

## 添加插件市场（只做一次）

```
/plugin marketplace add https://github.com/wb4646684/claude-plugins.git
```

---

## 插件列表

| 插件 | 说明 | 安装文档 |
|------|------|---------|
| **hap-mcp** | 明道云 HAP 工作表连接器（任务/审批/CRM 等），session token 自动刷新 | [→ 安装说明](./plugins/hap-mcp/README.md) |
| **email-mcp** | 通用 SMTP/IMAP 邮件（收发/附件/搜索），单实例支持多账号 | [→ 安装说明](./plugins/email-mcp/README.md) |
| **cos-mcp** | 腾讯云 COS 文件中转，本地文件 → 公网 URL，用完即删 | [→ 安装说明](./plugins/cos-mcp/README.md) |
| **oldoa-mcp** | 明道协作动态 + 日程（发动态/建日程/邀请成员） | [→ 安装说明](./plugins/oldoa-mcp/README.md) |
| **context-optimize** | Claude 上下文审计，防止 memory/skills 越积越肿 | [→ 安装说明](./plugins/context-optimize/README.md) |
| **plugin-builder** | 交互式插件脚手架，新建插件时自动生成完整目录结构 | [→ 安装说明](./plugins/plugin-builder/README.md) |

---

## 更新 / 卸载

```
/plugin marketplace update wb4646684-plugins   # 拉最新版
/plugin uninstall <name>@wb4646684-plugins     # 卸载
```

---

## License

[MIT](./LICENSE)
