# hap-mcp

明道云 HAP（超级应用平台）MCP 连接器 + session token 自动刷新脚本。

装完后，Claude Code 就能通过自然语言操作 HAP 应用里的任务、工作表、CRM、知识库等数据。

## 前置要求

- 你有一个**明道云账号**，且账号绑定的工作台里已经开通 HAP MCP 能力
- 本地安装了 `python3` 和 `curl`（macOS / 多数 Linux 自带）

## 安装步骤

### 1. 安装插件

```bash
# 在 Claude Code 里
/plugin marketplace add wb4646684/claude-plugins
/plugin install hap-mcp@claude-plugins
```

> 安装完成后，插件脚本位于
> `~/.claude/plugins/cache/claude-plugins/plugins/hap-mcp/scripts/`
> （具体路径视 Claude Code 版本可能略有差异，可用 `find ~/.claude -name hap_reauth.sh` 定位）

### 2. 获取你自己的加密凭据

明道登录接口使用的是**前端加密后的 payload**，不是明文账号密码——每个人必须抓自己的：

1. Chrome 打开 <https://www.mingdao.com/>
2. 按 `F12` 打开 DevTools → 切到 **Network** 面板 → 勾选 **Preserve log**
3. 用你自己的账号正常登录
4. 在 Network 请求列表里找 `MDAccountLogin` → 右侧 **Payload**
5. 复制 `account` 和 `password` 两个字段的**完整加密字符串**

### 3. 填入凭据文件

```bash
mkdir -p ~/.config/hap-mcp
cp ~/.claude/plugins/cache/claude-plugins/plugins/hap-mcp/scripts/credentials.example \
   ~/.config/hap-mcp/credentials
chmod 600 ~/.config/hap-mcp/credentials

# 用编辑器打开，把上一步复制的两段字符串填进去
vim ~/.config/hap-mcp/credentials
```

凭据文件格式：

```bash
HAP_LOGIN_ACCOUNT='<粘贴 Payload 里的 account 字段值>'
HAP_LOGIN_PASSWORD='<粘贴 Payload 里的 password 字段值>'
```

### 4. 首次刷新 token

```bash
bash ~/.claude/plugins/cache/claude-plugins/plugins/hap-mcp/scripts/hap_reauth.sh
```

看到绿色 `✔  Token 已更新` 即成功。脚本会自动在 `~/.claude.json` 里创建 / 更新 `mcpServers.hap` 条目。

### 5. 绑定到 shell 别名（推荐）

HAP 的 session token 会过期（一般几小时到 1 天），每次启动 Claude 前跑一次 reauth 最稳妥。把它写进 `~/.zshrc`（或 `~/.bashrc`）：

```bash
# 先做一个稳定路径的软链，避免插件路径变动
mkdir -p ~/.claude/scripts
ln -sf ~/.claude/plugins/cache/claude-plugins/plugins/hap-mcp/scripts/hap_reauth.sh \
       ~/.claude/scripts/hap_reauth.sh

# ~/.zshrc 里加别名
alias c="clear; ~/.claude/scripts/hap_reauth.sh; claude"
```

之后直接输 `c` 就会：刷 token → 启动 Claude。

> 如果你也在用代理访问 Anthropic，可以在 alias 里顺手 export：
>
> ```bash
> alias c="clear; ~/.claude/scripts/hap_reauth.sh; \
> export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897; \
> claude"
> ```

### 6. 验证

```bash
# 重启 claude 后，在 Claude Code 里输入：
/mcp

# 看到 hap 条目为 connected 即成功
```

## 工作原理

```
shell alias
   └─ hap_reauth.sh
        ├─ 读 ~/.config/hap-mcp/credentials
        ├─ POST mingdao.com/api/Login/MDAccountLogin → 拿 sessionId
        └─ 更新 ~/.claude.json 里 mcpServers.hap.url
              └─ URL: https://api2.mingdao.com/mcp?Authorization=md_pss_id%20<sessionId>

Claude Code 启动时读 ~/.claude.json，HAP MCP 用最新 token 连接
```

## 环境变量

| 变量 | 默认值 | 作用 |
|------|--------|------|
| `HAP_MCP_CREDENTIALS` | `$HOME/.config/hap-mcp/credentials` | 凭据文件路径 |
| `CLAUDE_CONFIG` | `$HOME/.claude.json` | Claude MCP 配置文件路径 |

## 故障排查

| 症状 | 排查 |
|------|------|
| Claude 里 `/mcp` 显示 `hap: authentication failed (10001)` | 跑一次 reauth 脚本 |
| 脚本报"鉴权失败" | 明道前端更新了加密算法 → 按步骤 2 重新抓 Payload |
| 脚本报"凭据文件不存在" | 确认 `~/.config/hap-mcp/credentials` 存在且非空 |
| 脚本显示"检测到 N 个活跃会话，跳过刷新" | 先关掉所有 claude 进程再跑 |

## 安全提示

- **绝对不要把 `~/.config/hap-mcp/credentials` 提交到 git**
- 脚本里的凭据占位符来自模板 `credentials.example`，本仓库 `.gitignore` 已屏蔽真实凭据文件
- 如果怀疑凭据泄漏：在明道云 Web 端退出所有会话 → 重新登录 → 按步骤 2 重抓 Payload

## License

[MIT](../../LICENSE)
