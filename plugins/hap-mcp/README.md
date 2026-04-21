# hap-mcp

明道云 HAP（超级应用平台）MCP 连接器，附带 session token 自动刷新。

装完后，在 Claude Code 里用自然语言就能操作 HAP 里的任意工作表——任务、审批、CRM、知识库等。

---

## 前置要求

- Claude Code（桌面版或 CLI）
- Node.js 18+（跑 setup.js）
- Python 3.8+（跑 reauth 脚本）
- curl（系统自带）
- 一个明道云账号，且该账号有权访问你要操作的 HAP 应用

---

## 安装步骤

**第一步：安装插件**

在 Claude Code 里依次执行：

```
/plugin marketplace add wb4646684/claude-plugins
/plugin install hap-mcp@wb4646684-plugins
/reload-plugins
```

**第二步：初始化凭据**

```
/hap-mcp:setup
```

Claude 会在聊天里问你明道账号和密码，填入后自动完成验证和凭据写入。密码在本地加密，不会上传或落盘。

**第三步：验证**

```
/mcp
```

看到 `hap: connected` 即成功。

---

## 工作原理

```
Claude Code 启动
  └─ SessionStart hook → hap_reauth.sh
       ├─ 检查 token 是否 30 分钟内刷过（是则静默跳过）
       ├─ 读 ~/.config/hap-mcp/credentials（加密凭据）
       ├─ POST mingdao.com/api/Login/MDAccountLogin
       └─ 写 ~/.config/hap-mcp/token（新 sessionId）

MCP 进程（stdio）
  └─ hap_start.sh → 读 token → mcp-remote https://api2.mingdao.com/mcp?Authorization=...
```

**插件不修改 `~/.claude.json`**。MCP 注册由插件系统通过 `plugin.json` 完成。凭据和 token 均存放在 `~/.config/hap-mcp/`，与其他工具配置隔离。

---

## setup 做了什么

1. 在聊天里收集明道账号 + 密码（不经过任何网络）
2. 用**明道前端同款 RSA-1024 公钥**在本地加密账号密码
3. 向 `MDAccountLogin` API 验证，确认能换出 sessionId
4. 加密后的凭据写入 `~/.config/hap-mcp/credentials`（权限 600）
5. 初始 sessionId 写入 `~/.config/hap-mcp/token`
6. 明文密码只在内存中使用，绝不落盘

以下情况才需要重跑 `/hap-mcp:setup`：
- 改了明道密码
- 凭据文件被删除
- 明道前端更新了 RSA 公钥（极少）

---

## 配置文件说明

| 文件 | 内容 |
|------|------|
| `~/.config/hap-mcp/credentials` | 加密后的账号密码（setup 写入，600 权限） |
| `~/.config/hap-mcp/token` | 当前 sessionId（每次启动 Claude 自动刷新） |
| `~/.config/hap-mcp/account_id` | 当前账号的 accountId（首次登录自动写入） |
| `~/.config/hap-mcp/.last_refresh` | 上次刷新时间戳（避免频繁刷新） |

`account_id` 可在 skill / 脚本中直接读取，用作 HAP 记录的默认负责人：

```bash
ACCOUNT_ID=$(cat ~/.config/hap-mcp/account_id)
```

---

## 环境变量（可选调整）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HAP_MCP_CREDENTIALS` | `~/.config/hap-mcp/credentials` | 凭据文件路径 |
| `HAP_MCP_TOKEN` | `~/.config/hap-mcp/token` | token 文件路径 |
| `HAP_MCP_FRESH_SECS` | `1800`（30 分钟）| token 刷新冷却时间 |
| `HAP_MCP_QUIET` | `1` | 静默模式（设 `0` 可看刷新日志） |

---

## 故障排查

| 症状 | 解决方法 |
|------|---------|
| `/mcp` 显示 `hap: error (10001)` | token 过期。手动触发：`HAP_MCP_QUIET=0 <plugin-path>/scripts/hap_reauth.sh` |
| `hap: error (430024)` 用户不在应用内 | 账号没有该 HAP 应用权限，确认用了正确的工作账号 |
| setup 报"鉴权失败" | 账号密码错误；或触发了验证码（先去网页手动登录一次再重试） |
| token 不自动刷新 | `/plugin` 确认 hap-mcp 处于启用状态；hook 未被禁用 |

手动触发刷新（调试用）：

```bash
HAP_MCP_QUIET=0 \
  $(find ~/.claude/plugins/cache/wb4646684-plugins/hap-mcp -name hap_reauth.sh | head -1)
```

---

## 安全说明

- `credentials` 文件存的是 RSA 加密后的 payload，不是明文，但泄漏后仍可被用于登录
- 文件权限默认 600，不要改宽
- 不要把 credentials 提交到 git
- 怀疑泄漏：去明道 Web 端退出所有会话 → 改密码 → 重跑 `/hap-mcp:setup`

---

## License

[MIT](../../LICENSE)
