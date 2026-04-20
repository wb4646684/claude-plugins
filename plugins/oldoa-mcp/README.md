# oldoa-mcp

明道协作（老版 OA）精简版 MCP server，只保留**动态（post）**和**日程（calendar）**两块最常用功能。

## 能做什么

### 动态（post）
- 发动态 / 回复动态
- 查询自己或某人的动态列表
- 读取动态详情和回复

### 日程（calendar）
- 创建 / 修改 / 删除日程
- 查询日程列表、日程详情
- 添加 / 移除日程成员
- 查看待确认日程、确认参会
- 按关键字搜索日程

## 前置要求

- **Python 3.10+**
- **Node.js 18+**（跑 create_app.js 用，如果走手动路径可省）
- 一个**明道账号**

> **不需要自己去 open.mingdao.com 手动建应用**——create_app.js 会帮你建好。

## 极简安装（推荐）

```bash
# 1. 装插件
/plugin marketplace add wb4646684/claude-plugins
/plugin install oldoa-mcp@claude-plugins

# 2. 装 Python 依赖
pip3 install 'mcp[cli]>=1.0.0'

# 3. OAuth 授权（首次输入 APP_SECRET，后续自动跳过）
node ~/.claude/plugins/cache/claude-plugins/plugins/oldoa-mcp/scripts/create_app.js
#   交互：首次输入 APP_SECRET → 浏览器里点"同意授权" → 复制 code 粘回终端
#   完事：~/.config/oldoa/{.env, .secrets.json} 全部写好

# 4. 重启 Claude Code
```

插件路径随 Claude Code 版本略有差异，用
`find ~/.claude -name create_app.js -path '*oldoa*'` 定位。

验证：

```
/mcp
# oldoa 条目为 connected 即成功
```

## 使用示例

在 Claude Code 里：

```
# 动态
发一条动态：刚更新了 Moodle 到新版

# 日程
帮我建一个明天下午 2 点的日程，主题"运维周会"，邀请 A 和 B
这周哪些日程待确认
```

## 工具列表

| 分类 | 工具 |
|------|------|
| 动态 | `post_add_post`, `post_delete_post`, `post_get_all_posts`, `post_get_post_detail`, `post_add_post_reply`, `post_get_post_reply` |
| 日程 | `calendar_create_event`, `calendar_edit_event`, `calendar_remove_event`, `calendar_get_events`, `calendar_get_event_details`, `calendar_add_members`, `calendar_remove_member`, `calendar_confirm_invitation`, `calendar_get_unconfirmed_events`, `calendar_search` |

## create_app.js 做了什么

使用内置的共享应用 **Claude-etz**（APP_KEY 已固定），无需自建应用。

1. 检查 `~/.config/oldoa/.env` 是否已有凭据
2. 首次运行：提示输入 `APP_SECRET`，写入 `.env`（权限 600）
3. 打开浏览器走 OAuth 授权，提示粘贴 `code`
4. 换取 `access_token`，写入 `.secrets.json`

`APP_SECRET` **只存本机**，不上传不打日志。

只在以下情况重跑：
- 新电脑/新机器首次配置
- `refresh_token` 过期（很久没用）

## OAuth Token 自动刷新

`access_token` 有过期时间（未发布应用 1 天、已发布 7 天）。auth.py 会自动用 `refresh_token` 续约，你**平时无感**。

只有很久（超过 refresh_token 周期，一般几周）没用过 oldoa 时，`refresh_token` 也会失效——那就重跑步骤 4 的 OAuth 授权即可（应用本身不用重建，APP_KEY/SECRET 不变）。

## 环境变量

| 变量 | 默认 | 作用 |
|------|------|------|
| `OLDOA_CONFIG_DIR` | `$HOME/.config/oldoa` | `.env` 和 `.secrets.json` 的目录 |
| `PYTHONPATH` | `${CLAUDE_PLUGIN_ROOT}/server/src` | Python 能找到 `oldoa` 包 |

## 手动安装（不想用 create_app.js）

如果不想跑脚本，直接写配置文件：

```bash
mkdir -p ~/.config/oldoa
cat > ~/.config/oldoa/.env <<EOF
MINGDAO_APP_KEY=D1C31A867CAA
MINGDAO_APP_SECRET=<向管理员索取>
MINGDAO_REDIRECT_URI=http://localhost/callback
EOF
chmod 600 ~/.config/oldoa/.env
```

然后跑脚本完成 OAuth 授权（脚本检测到 .env 存在会直接跳过输入步骤）。

## 故障排查

| 症状 | 排查 |
|------|------|
| create_app.js 报"登录失败" | 账号密码错；或明道前端 RSA 公钥换了（极少发生） |
| create_app.js 报"ApplyApp failed" | 明道改了表单字段；告诉作者更新 |
| create_app.js 报"无法提取 APP_KEY" | 明道改了应用详情页 HTML；告诉作者更新 |
| `/mcp` 显示 `oldoa: disconnected` | PYTHONPATH / OLDOA_CONFIG_DIR 没对；或 mcp 依赖没装 |
| 调用报 `Token expired and cannot be refreshed` | refresh_token 失效，重跑 OAuth 授权 |

## 安全提示

- `.env` 和 `.secrets.json` **不要进 git**
- `APP_SECRET` 泄漏：去 open.mingdao.com 重置，再重跑 OAuth 授权
- `access_token` 泄漏：重新授权即作废旧 token

## License

[MIT](../../LICENSE)
