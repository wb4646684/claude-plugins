# hap-mcp

明道云 HAP（超级应用平台）MCP 连接器 + session token 自动刷新。

装完后，Claude Code 能通过自然语言操作 HAP 应用里的任务、工作表、CRM、知识库等数据。

## 前置要求

- **明道云账号**，工作台已开通 HAP MCP 能力
- **Node.js 18+**（跑 setup.js 用）
- **Python 3.8+**（跑 reauth 脚本用）
- `curl`（系统自带）

## 极简安装

```bash
# 1. 装插件（在 Claude Code 里）
/plugin marketplace add wb4646684/claude-plugins
/plugin install hap-mcp@claude-plugins

# 2. 跑一次 setup（在终端里，插件路径可能略有差异）
node ~/.claude/plugins/cache/claude-plugins/plugins/hap-mcp/scripts/setup.js
# 交互输入你的明道账号和密码 → 自动加密验证 → 写入 ~/.config/hap-mcp/credentials

# 3. 重启 Claude Code 一次
```

就这些。之后每次启动 Claude，插件的 `SessionStart` hook 会自动调用 reauth 脚本刷新 sessionId，你**不用配 shell alias**、不用记命令。

验证：

```
/mcp
# hap 条目为 connected 即成功
```

## 工作原理

```
Claude Code 启动
     └─ SessionStart hook
          └─ hap_reauth.sh
               ├─ 检查 token 是否 30 分钟内刷过（是则跳过）
               ├─ 读 ~/.config/hap-mcp/credentials
               ├─ POST mingdao.com/api/Login/MDAccountLogin
               └─ 写 ~/.claude.json 的 mcpServers.hap.url

MCP 加载后用最新 sessionId 连接 api2.mingdao.com/mcp
```

## setup.js 做了什么

1. 交互式收集明文账号 + 密码（密码输入不回显）
2. 用**明道前端同款的 RSA-1024 公钥**（从 login bundle 提取）在本地加密
3. POST 到 `MDAccountLogin` API 验证加密结果能换出 sessionId
4. 成功则把加密后的 payload 写入 `~/.config/hap-mcp/credentials`，权限 `600`
5. 明文密码**只在内存里用过**，绝不落盘、不打日志

之后只有以下情况才需要重跑 setup：
- 改了明道密码
- 明道前端更新了 RSA 公钥（极少发生）

## 环境变量

| 变量 | 默认值 | 作用 |
|------|--------|------|
| `HAP_MCP_CREDENTIALS` | `$HOME/.config/hap-mcp/credentials` | 凭据文件路径 |
| `CLAUDE_CONFIG` | `$HOME/.claude.json` | Claude MCP 配置文件 |
| `HAP_MCP_FRESH_SECS` | `1800`（30 分钟）| token 新鲜阈值 —— 距上次刷新不到这个秒数时跳过刷新 |
| `HAP_MCP_QUIET` | `1` | 静默模式（SessionStart hook 里用），设 `0` 可看详细日志 |

## 故障排查

| 症状 | 排查 |
|------|------|
| `/mcp` 显示 `hap: authentication failed (10001)` | 手动跑 reauth 看输出；或 setup 重新生成凭据 |
| setup.js 报"鉴权失败" | 账号或密码错；或明道前端 RSA 公钥换了（极少） |
| 每次会话启动都卡 1-2 秒 | Hook 正在网络请求；可把 `HAP_MCP_FRESH_SECS` 调大 |
| 不想用 hook 想手动控制 | 在 `/plugin` 菜单里禁用这个插件的 hook |

手动跑 reauth（排查用）：

```bash
HAP_MCP_QUIET=0 ~/.claude/plugins/cache/claude-plugins/plugins/hap-mcp/scripts/hap_reauth.sh
```

## 安全提示

- `~/.config/hap-mcp/credentials` 里存的是**加密后的 payload**，不是明文——但任何能拿到它的人都能以你身份登录
- 文件权限默认 600（只有自己可读），别手贱 chmod 666
- 不要把 credentials 提交到 git
- 怀疑泄漏：去明道 Web 端退出所有会话 → 改密码 → 重跑 setup

## 手动安装（不用 setup.js）

老方法依然支持：用浏览器 F12 自己抓 `MDAccountLogin` 请求的 Payload，把 `account` 和 `password` 两个加密字段粘到 credentials 文件里：

```bash
mkdir -p ~/.config/hap-mcp
cp ~/.claude/plugins/cache/claude-plugins/plugins/hap-mcp/scripts/credentials.example \
   ~/.config/hap-mcp/credentials
chmod 600 ~/.config/hap-mcp/credentials
vim ~/.config/hap-mcp/credentials
```

## License

[MIT](../../LICENSE)
