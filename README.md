# Jeffrey's Claude Code Plugins

Jeffrey 自用的 [Claude Code](https://claude.com/claude-code) 插件集合，逐步开放到此仓库。

## 安装市场

```bash
# 在 Claude Code 里
/plugin marketplace add wb4646684/claude-plugins
```

## 可用插件

| 插件 | 类型 | 说明 |
|------|------|------|
| [`hap-mcp`](./plugins/hap-mcp) | MCP | 明道云 HAP MCP 连接器，含 session token 自动刷新脚本 |
| [`cos-mcp`](./plugins/cos-mcp) | MCP | 腾讯云 COS 临时文件中转（本地文件 → 公网 URL） |
| [`email-mcp`](./plugins/email-mcp) | MCP | 通用 SMTP/IMAP 邮件 MCP（QQ/163/企业邮/Gmail 等） |
| [`context-optimize`](./plugins/context-optimize) | Skill | 审查并优化 memory 和 skills 结构，避免 context 臃肿 |

## 安装示例

```bash
/plugin install hap-mcp@claude-plugins
/plugin install cos-mcp@claude-plugins
/plugin install email-mcp@claude-plugins
/plugin install context-optimize@claude-plugins
```

## 贡献

这是个人工具仓库，暂不接受外部 PR。欢迎 fork。

## License

[MIT](./LICENSE)
